import { deleteSessionsByUser, hashPassword } from "./_auth.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import {
  clearRateLimit,
  formatRateLimitMessage,
  getActiveRateLimit,
  getRequestIp,
  hashValue,
  normalizeEmail,
  recordRateLimitAttempt,
  validatePasswordStrength,
} from "./_security.js";

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const payload = JSON.parse(event.body || "{}");
    const email = normalizeEmail(payload.email);
    const code = String(payload.code || "").trim();
    const token = String(payload.token || "").trim();
    const password = String(payload.password || "");
    const secret = token || code;

    if (!email || !email.includes("@")) {
      return jsonResponse(400, { error: "Indica um email valido." });
    }

    if (!secret) {
      return jsonResponse(400, { error: "Indica o link ou codigo de recuperacao." });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return jsonResponse(400, { error: passwordError });
    }

    const pool = getPool();
    const requestIp = getRequestIp(event);
    const ipLimit = await getActiveRateLimit(pool, "passwordResetConfirm", "ip", requestIp);
    const emailLimit = await getActiveRateLimit(pool, "passwordResetConfirm", "email", email);

    if (ipLimit.blocked || emailLimit.blocked) {
      return jsonResponse(429, {
        error: formatRateLimitMessage(Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds)),
      });
    }

    const connection = await pool.connect();

    try {
      await connection.query("begin");

      const resetResult = await connection.query(
        `select tokens.id, tokens.user_id
         from catalog_password_reset_tokens tokens
         join catalog_users users on users.id = tokens.user_id
         where tokens.email = $1
           and tokens.code_hash = $2
           and tokens.used_at is null
           and tokens.expires_at > now()
           and users.deleted_at is null
         order by tokens.created_at desc
         limit 1
         for update`,
        [email, hashValue(secret)],
      );

      const resetToken = resetResult.rows[0];
      if (!resetToken) {
        await connection.query("rollback");
        await recordRateLimitAttempt(pool, "passwordResetConfirm", "ip", requestIp);
        await recordRateLimitAttempt(pool, "passwordResetConfirm", "email", email);
        return jsonResponse(400, { error: "Link ou codigo invalido ou expirado." });
      }

      const passwordHash = await hashPassword(password);
      await connection.query(
        `update catalog_users
         set password_hash = $2
         where id = $1`,
        [resetToken.user_id, passwordHash],
      );

      await connection.query(
        `update catalog_password_reset_tokens
         set used_at = now()
         where id = $1`,
        [resetToken.id],
      );

      await connection.query(
        `delete from catalog_password_reset_tokens
         where user_id = $1
           and id <> $2`,
        [resetToken.user_id, resetToken.id],
      );

      await deleteSessionsByUser(connection, resetToken.user_id);
      await clearRateLimit(connection, "passwordResetConfirm", "ip", requestIp);
      await clearRateLimit(connection, "passwordResetConfirm", "email", email);
      await connection.query("commit");

      return jsonResponse(200, {
        ok: true,
        message: "Palavra-passe atualizada com sucesso. Entra novamente com a nova credencial.",
      });
    } catch (error) {
      await connection.query("rollback");
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
