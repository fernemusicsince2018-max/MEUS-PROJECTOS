import { randomUUID } from "node:crypto";
import {
  canManageSuperAdminUsers,
  deleteSessionsByUser,
  getEffectiveUserRole,
  getResolvedSuperAdminAccess,
  getSuperAdminSession,
  hashPassword,
  isPrimarySuperAdminEmail,
  normalizeSuperAdminAccess,
  normalizeAccountStatus,
  requireSuperAdminAccess,
} from "./_auth.js";
import { getCatalogIdentityConflictMessage } from "./_identity-errors.js";
import { lockCatalogIdentities } from "./_identity-locks.js";
import { getPool, hasColumn, jsonResponse, withCors } from "./_postgres.js";
import { normalizeEmail, validatePasswordStrength } from "./_security.js";

function toAdminUserPayload(row) {
  return {
    userId: row.id,
    email: row.email,
    fullName: row.full_name || "",
    avatarUrl: row.avatar_url || "",
    superAdminAccess: getResolvedSuperAdminAccess(row),
    role: getEffectiveUserRole(row),
    accountStatus: normalizeAccountStatus(row.account_status),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    isProtected: isPrimarySuperAdminEmail(row.email),
  };
}

async function hasBusinessEmailConflict(connection, email, ignoredUserId = "") {
  if (!email) return false;

  const result = await connection.query(
    `select stores.id
       from catalog_stores stores
      where stores.deleted_at is null
        and lower(stores.business_email) = $1
        and ($2 = '' or stores.owner_user_id <> $2)
      limit 1`,
    [email, ignoredUserId],
  );

  return result.rows.length > 0;
}

async function handle(event) {
  try {
    const session = await getSuperAdminSession(event);
    requireSuperAdminAccess(session, "equipa", "Nao tens permissao para gerir a equipa do super admin.");
    if (!canManageSuperAdminUsers(session)) {
      return jsonResponse(403, {
        error: "So a conta principal do super admin pode criar ou gerir admins auxiliares.",
      });
    }

    const payload = JSON.parse(event.body || "{}");
    const userId = String(payload.userId || "").trim();
    const fullName = String(payload.fullName || "").trim().slice(0, 160);
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");
    const accountStatus = normalizeAccountStatus(payload.accountStatus);
    const superAdminAccess = normalizeSuperAdminAccess(payload.superAdminAccess);

    if (!email || !email.includes("@")) {
      return jsonResponse(400, { error: "Indica um email valido." });
    }

    if (!userId) {
      const passwordError = validatePasswordStrength(password);
      if (passwordError) {
        return jsonResponse(400, { error: passwordError });
      }
    }

    const pool = getPool();
    const connection = await pool.connect();

    try {
      await connection.query("begin");
      await lockCatalogIdentities(connection, [{ scope: "email", value: email }]);
      const hasSuperAdminAccessColumn = await hasColumn(connection, "catalog_users", "super_admin_access");
      const superAdminAccessSelectSql = hasSuperAdminAccessColumn
        ? "users.super_admin_access,"
        : "null::jsonb as super_admin_access,";
      const superAdminAccessReturningSql = hasSuperAdminAccessColumn
        ? "super_admin_access,"
        : "null::jsonb as super_admin_access,";

      if (!userId) {
        const existingUserResult = await connection.query(
          `select id, deleted_at
             from catalog_users
            where lower(email) = $1
            limit 1`,
          [email],
        );

        if (existingUserResult.rows.length) {
          await connection.query("rollback");
          return jsonResponse(409, {
            error: existingUserResult.rows[0].deleted_at
              ? "Ja existe uma conta desativada com este email. Atualiza ou remove essa conta antes de criar outra."
              : "Ja existe uma conta com este email.",
          });
        }

        if (await hasBusinessEmailConflict(connection, email)) {
          await connection.query("rollback");
          return jsonResponse(409, {
            error: "Este email comercial ja esta a ser usado noutra empresa.",
          });
        }

        const createdUserId = randomUUID();
        const passwordHash = await hashPassword(password);
        const createdUserResult = hasSuperAdminAccessColumn
          ? await connection.query(
              `insert into catalog_users (
                 id,
                 email,
                 password_hash,
                 full_name,
                 super_admin_access,
                 role,
                 account_status
               )
               values ($1, $2, $3, $4, $5, 'super_admin', $6)
               returning id, email, full_name, avatar_url, ${superAdminAccessReturningSql} role, account_status, created_at, updated_at`,
              [createdUserId, email, passwordHash, fullName, JSON.stringify(superAdminAccess), accountStatus],
            )
          : await connection.query(
              `insert into catalog_users (
                 id,
                 email,
                 password_hash,
                 full_name,
                 role,
                 account_status
               )
               values ($1, $2, $3, $4, 'super_admin', $5)
               returning id, email, full_name, avatar_url, ${superAdminAccessReturningSql} role, account_status, created_at, updated_at`,
              [createdUserId, email, passwordHash, fullName, accountStatus],
            );

        await connection.query("commit");
        return jsonResponse(200, {
          ok: true,
          adminUser: toAdminUserPayload(createdUserResult.rows[0]),
        });
      }

      const existingUserResult = await connection.query(
        `select
           users.id,
           users.email,
           users.full_name,
           users.avatar_url,
           ${superAdminAccessSelectSql}
           users.role,
           users.account_status,
           users.deleted_at,
           users.created_at,
           users.updated_at,
           stores.id as store_id
          from catalog_users users
          left join catalog_stores stores on stores.owner_user_id = users.id
         where users.id = $1
         limit 1`,
        [userId],
      );

      const existingUser = existingUserResult.rows[0];
      if (!existingUser) {
        await connection.query("rollback");
        return jsonResponse(404, { error: "Admin nao encontrado." });
      }

      if (existingUser.deleted_at) {
        await connection.query("rollback");
        return jsonResponse(400, { error: "Esta conta foi removida e nao pode ser alterada agora." });
      }

      if (getEffectiveUserRole(existingUser) !== "super_admin") {
        await connection.query("rollback");
        return jsonResponse(400, { error: "Esta conta nao pertence a equipa do super admin." });
      }

      if (isPrimarySuperAdminEmail(existingUser.email) && session.userId !== userId) {
        await connection.query("rollback");
        return jsonResponse(403, {
          error: "Contas principais de super admin so podem ser editadas no proprio perfil.",
        });
      }

      if (session.userId === userId && accountStatus !== "active") {
        await connection.query("rollback");
        return jsonResponse(400, { error: "Nao podes suspender a tua propria conta." });
      }

      const duplicateUserResult = await connection.query(
        `select id
           from catalog_users
          where lower(email) = $1
            and id <> $2
          limit 1`,
        [email, userId],
      );

      if (duplicateUserResult.rows.length) {
        await connection.query("rollback");
        return jsonResponse(409, { error: "Ja existe uma conta com este email." });
      }

      if (await hasBusinessEmailConflict(connection, email, userId)) {
        await connection.query("rollback");
        return jsonResponse(409, {
          error: "Este email comercial ja esta a ser usado noutra empresa.",
        });
      }

      let passwordHash = "";
      if (password) {
        const passwordError = validatePasswordStrength(password);
        if (passwordError) {
          await connection.query("rollback");
          return jsonResponse(400, { error: passwordError });
        }

        passwordHash = await hashPassword(password);
      }

      const updateValues = hasSuperAdminAccessColumn
        ? [userId, email, fullName, accountStatus, JSON.stringify(superAdminAccess)]
        : [userId, email, fullName, accountStatus];
      const passwordIndex = updateValues.length + 1;
      const passwordClause = passwordHash
        ? `,
               password_hash = $${passwordIndex}`
        : "";
      const superAdminAccessUpdateClause = hasSuperAdminAccessColumn
        ? `,
                super_admin_access = $5`
        : "";

      if (passwordHash) {
        updateValues.push(passwordHash);
      }

      const updatedUserResult = await connection.query(
        `update catalog_users
            set email = $2,
                full_name = $3,
                account_status = $4${superAdminAccessUpdateClause},
                role = 'super_admin'${passwordClause},
                updated_at = now()
          where id = $1
          returning id, email, full_name, avatar_url, ${superAdminAccessReturningSql} role, account_status, created_at, updated_at`,
        updateValues,
      );

      if (passwordHash) {
        await connection.query(
          `delete from catalog_password_reset_tokens
            where user_id = $1`,
          [userId],
        );
      }

      if (passwordHash || accountStatus !== "active") {
        await deleteSessionsByUser(connection, userId);
      }

      await connection.query("commit");
      return jsonResponse(200, {
        ok: true,
        adminUser: toAdminUserPayload(updatedUserResult.rows[0]),
      });
    } catch (error) {
      try {
        await connection.query("rollback");
      } catch (rollbackError) {}

      const identityConflictMessage = getCatalogIdentityConflictMessage(error);
      if (identityConflictMessage) {
        return jsonResponse(409, { error: identityConflictMessage });
      }

      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(error.status || 500, {
      error: error.message || "Nao foi possivel guardar o admin auxiliar.",
    });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
