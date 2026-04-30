import { createSession, getEffectiveUserRole, normalizeAccountStatus, sessionPayload, verifyPassword } from "./_auth.js";
import { ensureDatabaseReady, getPool, hasColumn, jsonResponse, withCors } from "./_postgres.js";
import {
  clearRateLimit,
  formatRateLimitMessage,
  getActiveRateLimit,
  getRequestIp,
  normalizeEmail,
  recordRateLimitAttempt,
} from "./_security.js";

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const payload = JSON.parse(event.body || "{}");
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || "");

    if (!email || !password) {
      return jsonResponse(400, { error: "Email e palavra-passe sao obrigatorios." });
    }

    const pool = getPool();
    const requestIp = getRequestIp(event);
    const ipLimit = await getActiveRateLimit(pool, "login", "ip", requestIp);
    const emailLimit = await getActiveRateLimit(pool, "login", "email", email);

    if (ipLimit.blocked || emailLimit.blocked) {
      return jsonResponse(429, {
        error: formatRateLimitMessage(Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds)),
      });
    }

    const connection = await pool.connect();
    let transactionStarted = false;

    try {
      const hasSuperAdminAccessColumn = await hasColumn(connection, "catalog_users", "super_admin_access");
      const superAdminAccessSelectSql = hasSuperAdminAccessColumn
        ? "users.super_admin_access,"
        : "null::jsonb as super_admin_access,";
      const userResult = await connection.query(
        `select
           users.id,
           users.email,
           users.full_name,
           users.avatar_url,
           users.password_hash,
           users.role,
           ${superAdminAccessSelectSql}
           users.account_status,
           users.deleted_at,
           stores.id as store_id,
           stores.name as store_name,
           stores.deleted_at as store_deleted_at
          from catalog_users users
          left join catalog_stores stores on stores.owner_user_id = users.id
          where users.email = $1
          limit 1`,
        [email],
      );

      const user = userResult.rows[0];
      if (!user) {
        await recordRateLimitAttempt(pool, "login", "ip", requestIp);
        await recordRateLimitAttempt(pool, "login", "email", email);
        return jsonResponse(401, { error: "Credenciais invalidas." });
      }

      if (user.deleted_at) {
        return jsonResponse(403, { error: "Esta empresa esta no lixo. Recupera-a no super admin para voltar a entrar." });
      }

      const passwordOk = await verifyPassword(password, user.password_hash);
      if (!passwordOk) {
        await recordRateLimitAttempt(pool, "login", "ip", requestIp);
        await recordRateLimitAttempt(pool, "login", "email", email);
        return jsonResponse(401, { error: "Credenciais invalidas." });
      }

      const accountStatus = normalizeAccountStatus(user.account_status);
      if (accountStatus !== "active") {
        return jsonResponse(403, { error: "A tua conta esta suspensa. Contacta o suporte para reativar o acesso." });
      }

      const role = getEffectiveUserRole(user);
      if (user.store_deleted_at) {
        return jsonResponse(403, { error: "Esta empresa esta no lixo. Recupera-a no super admin para voltar a entrar." });
      }

      if (role !== "super_admin" && !user.store_id) {
        return jsonResponse(403, { error: "Nao existe loja associada a esta conta. Ativa ou cria a loja no super admin antes de iniciar sessao." });
      }

      await connection.query("begin");
      transactionStarted = true;
      const session = await createSession(connection, user.id);
      await clearRateLimit(connection, "login", "ip", requestIp);
      await clearRateLimit(connection, "login", "email", email);
      await connection.query("commit");
      transactionStarted = false;

      return jsonResponse(
        200,
        {
          ok: true,
          ...sessionPayload({
            userId: user.id,
            email: user.email,
            fullName: user.full_name || "",
            avatarUrl: user.avatar_url || "",
            role,
            superAdminAccess: user.super_admin_access,
            accountStatus,
            storeId: user.store_id || "",
            storeName: user.store_name || "",
          }),
        },
        {
          "Set-Cookie": session.cookie,
        },
      );
    } catch (error) {
      if (transactionStarted) {
        await connection.query("rollback");
      }
      return jsonResponse(error.status || 500, { error: error.message || "Falha ao iniciar sessao." });
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
