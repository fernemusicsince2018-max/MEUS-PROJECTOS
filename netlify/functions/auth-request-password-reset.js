import { randomBytes, randomUUID } from "node:crypto";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import { buildPasswordResetLink, isEmailDeliveryConfigured, sendPasswordResetEmail } from "./_email.js";
import {
  formatRateLimitMessage,
  getActiveRateLimit,
  getRequestIp,
  hashValue,
  normalizeEmail,
  recordRateLimitAttempt,
  shouldExposeResetCode,
} from "./_security.js";

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const payload = JSON.parse(event.body || "{}");
    const email = normalizeEmail(payload.email);

    if (!email || !email.includes("@")) {
      return jsonResponse(400, { error: "Indica um email valido." });
    }

    const pool = getPool();
    const requestIp = getRequestIp(event);
    const ipLimit = await getActiveRateLimit(pool, "passwordResetRequest", "ip", requestIp);
    const emailLimit = await getActiveRateLimit(pool, "passwordResetRequest", "email", email);

    if (ipLimit.blocked || emailLimit.blocked) {
      return jsonResponse(429, {
        error: formatRateLimitMessage(Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds)),
      });
    }

    await recordRateLimitAttempt(pool, "passwordResetRequest", "ip", requestIp);
    await recordRateLimitAttempt(pool, "passwordResetRequest", "email", email);

    const userResult = await pool.query(
      `select id, email
       from catalog_users
       where email = $1
         and deleted_at is null
       limit 1`,
      [email],
    );

    const user = userResult.rows[0];
    let resetSecret = "";
    let resetLink = "";

    if (user && !isEmailDeliveryConfigured() && !shouldExposeResetCode()) {
      return jsonResponse(500, { error: "O envio de email de recuperacao ainda nao esta configurado." });
    }

    if (user) {
      resetSecret = randomBytes(24).toString("base64url");
      resetLink = buildPasswordResetLink(event, email, resetSecret);
      const connection = await pool.connect();

      try {
        await connection.query("begin");
        await connection.query(
          `delete from catalog_password_reset_tokens
           where user_id = $1
              or expires_at <= now()
              or used_at is not null`,
          [user.id],
        );

        await connection.query(
          `insert into catalog_password_reset_tokens (
             id, user_id, email, code_hash, requested_ip, expires_at
           ) values ($1, $2, $3, $4, $5, now() + interval '30 minutes')`,
          [randomUUID(), user.id, email, hashValue(resetSecret), requestIp],
        );

        await connection.query("commit");
      } catch (error) {
        await connection.query("rollback");
        throw error;
      } finally {
        connection.release();
      }

      if (isEmailDeliveryConfigured()) {
        try {
          await sendPasswordResetEmail({
            event,
            toEmail: email,
            resetLink,
          });
        } catch (error) {
          await pool.query(
            `delete from catalog_password_reset_tokens
             where user_id = $1
               and code_hash = $2`,
            [user.id, hashValue(resetSecret)],
          );
          return jsonResponse(500, { error: "Nao foi possivel enviar o email de recuperacao agora." });
        }
      }
    }

    return jsonResponse(200, {
      ok: true,
      message: "Se existir uma conta com este email, enviamos um link de recuperacao para a caixa de entrada.",
      ...(shouldExposeResetCode() && resetSecret
        ? { resetCode: resetSecret, resetLink }
        : {}),
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
