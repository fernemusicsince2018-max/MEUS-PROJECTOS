import { randomUUID } from "node:crypto";
import { createSession, getEffectiveUserRole, hashPassword, sessionPayload } from "./_auth.js";
import { getCatalogIdentityConflictMessage } from "./_identity-errors.js";
import { lockCatalogIdentities } from "./_identity-locks.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import { getSystemSettings } from "./_settings.js";
import {
  clearRateLimit,
  formatRateLimitMessage,
  getActiveRateLimit,
  getRequestIp,
  normalizeEmail,
  recordRateLimitAttempt,
  validatePasswordStrength,
} from "./_security.js";

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const payload = JSON.parse(event.body || "{}");
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");
    const fullName = String(payload.fullName || "").trim();

    if (!email || !email.includes("@")) {
      return jsonResponse(400, { error: "Indica um email valido." });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return jsonResponse(400, { error: passwordError });
    }

    const effectiveRole = getEffectiveUserRole({ email, role: "merchant" });
    const pool = getPool();
    const systemSettings = await getSystemSettings(pool);

    if (effectiveRole !== "super_admin" && !systemSettings.merchantRegistrationEnabled) {
      return jsonResponse(403, {
        error: "O cadastro publico de lojistas esta desativado. Contacta o administrador para criar a tua conta.",
      });
    }

    const requestIp = getRequestIp(event);
    const ipLimit = await getActiveRateLimit(pool, "register", "ip", requestIp);
    const emailLimit = await getActiveRateLimit(pool, "register", "email", email);

    if (ipLimit.blocked || emailLimit.blocked) {
      return jsonResponse(429, {
        error: formatRateLimitMessage(Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds)),
      });
    }

    const connection = await pool.connect();

    try {
      await connection.query("begin");
      await lockCatalogIdentities(connection, [{ scope: "email", value: email }]);

      const existingUser = await connection.query(
        `select id, deleted_at
         from catalog_users
         where lower(email) = lower($1)
         limit 1`,
        [email],
      );

      if (existingUser.rows.length) {
        await connection.query("rollback");
        await recordRateLimitAttempt(pool, "register", "ip", requestIp);
        await recordRateLimitAttempt(pool, "register", "email", email);
        return jsonResponse(409, {
          error: existingUser.rows[0].deleted_at
            ? "Ja existe uma empresa no lixo com este email. Recupera-a no super admin ou elimina-a de vez antes de criar outra."
            : "Ja existe uma conta com este email.",
        });
      }

      const existingBusinessEmail = await connection.query(
        `select id
         from catalog_stores
         where deleted_at is null
           and lower(business_email) = lower($1)
         limit 1`,
        [email],
      );

      if (existingBusinessEmail.rows.length) {
        await connection.query("rollback");
        await recordRateLimitAttempt(pool, "register", "ip", requestIp);
        await recordRateLimitAttempt(pool, "register", "email", email);
        return jsonResponse(409, {
          error: "Este email ja esta associado a outra empresa no sistema.",
        });
      }

      const userId = randomUUID();
      const passwordHash = await hashPassword(password);

      await connection.query(
        `insert into catalog_users (id, email, password_hash, full_name, role)
         values ($1, $2, $3, $4, $5)`,
        [userId, email, passwordHash, fullName, effectiveRole],
      );

      await clearRateLimit(connection, "register", "ip", requestIp);
      await clearRateLimit(connection, "register", "email", email);

      if (effectiveRole !== "super_admin") {
        await connection.query("commit");
        return jsonResponse(200, {
          ok: true,
          pendingStoreSetup: true,
          message:
            "Conta criada com sucesso. A loja nao sera criada automaticamente. O super admin precisa criar ou ativar a loja antes do primeiro acesso.",
        });
      }

      const session = await createSession(connection, userId);
      await connection.query("commit");

      return jsonResponse(
        200,
        {
          ok: true,
          ...sessionPayload({
            userId,
            email,
            fullName,
            role: effectiveRole,
            accountStatus: "active",
            storeId: "",
            storeName: "",
          }),
        },
        {
          "Set-Cookie": session.cookie,
        },
      );
    } catch (error) {
      await connection.query("rollback");
      const identityConflictMessage = getCatalogIdentityConflictMessage(error);
      if (identityConflictMessage) {
        return jsonResponse(409, { error: identityConflictMessage });
      }
      return jsonResponse(500, { error: error.message || "Falha ao criar a conta." });
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
