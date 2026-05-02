import { randomUUID } from "node:crypto";
import { ensureStoreForUser } from "./_auth.js";
import { getCatalogIdentityConflictMessage } from "./_identity-errors.js";
import { lockCatalogIdentities } from "./_identity-locks.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import {
  PENDING_STORE_REGISTRATION_TABLE,
  buildEmailConflictMessage,
  buildPhoneConflictMessage,
  ensurePendingStoreRegistrationSchema,
  findRegistrationIdentityConflicts,
} from "./_registration.js";
import {
  clearRateLimit,
  formatRateLimitMessage,
  getActiveRateLimit,
  getRequestIp,
  hashValue,
  normalizeEmail,
  recordRateLimitAttempt,
} from "./_security.js";

async function handle(event) {
  try {
    await ensureDatabaseReady();
    await ensurePendingStoreRegistrationSchema(getPool());
    const payload = JSON.parse(event.body || "{}");
    const email = normalizeEmail(payload.email);
    const token = String(payload.token || "").trim();

    if (!email || !email.includes("@")) {
      return jsonResponse(400, { error: "Indica um email valido." });
    }

    if (!token) {
      return jsonResponse(400, { error: "Indica o link de aprovacao enviado por email." });
    }

    const pool = getPool();
    const requestIp = getRequestIp(event);
    const ipLimit = await getActiveRateLimit(pool, "registrationApproval", "ip", requestIp);
    const emailLimit = await getActiveRateLimit(pool, "registrationApproval", "email", email);

    if (ipLimit.blocked || emailLimit.blocked) {
      return jsonResponse(429, {
        error: formatRateLimitMessage(Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds)),
      });
    }

    const connection = await pool.connect();

    try {
      await connection.query("begin");
      const pendingResult = await connection.query(
        `select id, email, phone, full_name, store_name, password_hash
         from ${PENDING_STORE_REGISTRATION_TABLE}
         where lower(email) = lower($1)
           and code_hash = $2
           and used_at is null
           and expires_at > now()
         order by created_at desc
         limit 1
         for update`,
        [email, hashValue(token)],
      );

      const pendingRegistration = pendingResult.rows[0];
      if (!pendingRegistration) {
        await connection.query("rollback");
        await recordRateLimitAttempt(pool, "registrationApproval", "ip", requestIp);
        await recordRateLimitAttempt(pool, "registrationApproval", "email", email);
        return jsonResponse(400, { error: "Link de aprovacao invalido ou expirado." });
      }

      await lockCatalogIdentities(connection, [
        { scope: "email", value: pendingRegistration.email },
        { scope: "phone", value: pendingRegistration.phone },
      ]);

      const conflicts = await findRegistrationIdentityConflicts(connection, {
        email: pendingRegistration.email,
        phone: pendingRegistration.phone,
        excludePendingId: pendingRegistration.id,
      });

      if (conflicts.email) {
        await connection.query("rollback");
        return jsonResponse(409, { error: buildEmailConflictMessage(conflicts.email) });
      }

      if (conflicts.phone) {
        await connection.query("rollback");
        return jsonResponse(409, { error: buildPhoneConflictMessage(conflicts.phone) });
      }

      const userId = randomUUID();
      await connection.query(
        `insert into catalog_users (id, email, password_hash, full_name, role)
         values ($1, $2, $3, $4, 'merchant')`,
        [
          userId,
          pendingRegistration.email,
          pendingRegistration.password_hash,
          pendingRegistration.full_name || "",
        ],
      );

      const store = await ensureStoreForUser(
        connection,
        userId,
        pendingRegistration.store_name || "",
      );

      await connection.query(
        `update catalog_stores
         set
           name = $2,
           business_email = $3,
           business_phone = $4,
           whatsapp = $4
         where id = $1`,
        [
          store.id,
          pendingRegistration.store_name || store.name || "",
          pendingRegistration.email,
          pendingRegistration.phone,
        ],
      );

      await connection.query(
        `update ${PENDING_STORE_REGISTRATION_TABLE}
         set used_at = now()
         where id = $1`,
        [pendingRegistration.id],
      );

      await connection.query(
        `delete from ${PENDING_STORE_REGISTRATION_TABLE}
         where id <> $1
           and (lower(email) = lower($2) or phone = $3 or expires_at <= now() or used_at is not null)`,
        [pendingRegistration.id, pendingRegistration.email, pendingRegistration.phone],
      );

      await clearRateLimit(connection, "registrationApproval", "ip", requestIp);
      await clearRateLimit(connection, "registrationApproval", "email", email);
      await connection.query("commit");

      return jsonResponse(200, {
        ok: true,
        approved: true,
        storeName: pendingRegistration.store_name || "",
        message:
          "Loja aprovada com sucesso. Entra agora com o teu email e a tua palavra-passe.",
      });
    } catch (error) {
      await connection.query("rollback");
      const identityConflictMessage = getCatalogIdentityConflictMessage(error);
      if (identityConflictMessage) {
        return jsonResponse(409, { error: identityConflictMessage });
      }
      return jsonResponse(error.status || 500, {
        error: error.message || "Nao foi possivel aprovar a loja.",
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
