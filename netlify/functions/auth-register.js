import { randomUUID } from "node:crypto";
import { createSession, getEffectiveUserRole, hashPassword, sessionPayload } from "./_auth.js";
import {
  buildRegistrationApprovalLink,
  isEmailDeliveryConfigured,
  sendRegistrationApprovalEmail,
} from "./_email.js";
import { getCatalogIdentityConflictMessage } from "./_identity-errors.js";
import { lockCatalogIdentities } from "./_identity-locks.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import {
  PENDING_STORE_REGISTRATION_TABLE,
  REGISTRATION_APPROVAL_LINK_TTL_HOURS,
  buildEmailConflictMessage,
  buildPhoneConflictMessage,
  ensurePendingStoreRegistrationSchema,
  findRegistrationIdentityConflicts,
  normalizeRegistrationStoreName,
  validateRegistrationEmail,
  validateRegistrationPhone,
} from "./_registration.js";
import { getSystemSettings } from "./_settings.js";
import {
  clearRateLimit,
  formatRateLimitMessage,
  getActiveRateLimit,
  getRequestIp,
  hashValue,
  recordRateLimitAttempt,
  shouldExposeResetCode,
  validatePasswordStrength,
} from "./_security.js";

async function handle(event) {
  try {
    await ensureDatabaseReady();
    await ensurePendingStoreRegistrationSchema(getPool());
    const payload = JSON.parse(event.body || "{}");
    const emailResult = validateRegistrationEmail(payload.email, "O email");
    const email = emailResult.normalized || "";
    const password = String(payload.password || "");
    const fullName = String(payload.fullName || "").trim();
    const requestedStoreName = String(payload.storeName || "").trim();
    const requestedPhone = String(payload.phone || "").trim();

    if (emailResult.error) {
      return jsonResponse(400, { error: emailResult.error });
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

    let normalizedPhone = "";
    let normalizedStoreName = "";
    if (effectiveRole !== "super_admin") {
      const phoneResult = validateRegistrationPhone(requestedPhone, "O numero de telemovel");
      if (phoneResult.error) {
        return jsonResponse(400, { error: phoneResult.error });
      }
      normalizedPhone = phoneResult.normalized;
      normalizedStoreName = normalizeRegistrationStoreName(requestedStoreName, email);
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
    let approvalToken = "";
    let approvalLink = "";
    let pendingRegistrationId = "";
    let approvalDeliveryWarning = "";

    try {
      await connection.query("begin");

      const userId = randomUUID();
      const passwordHash = await hashPassword(password);

      if (effectiveRole !== "super_admin") {
        if (!isEmailDeliveryConfigured() && !shouldExposeResetCode()) {
          await connection.query("rollback");
          return jsonResponse(500, {
            error: "O envio de email para aprovar a loja ainda nao esta configurado.",
          });
        }

        await lockCatalogIdentities(connection, [
          { scope: "email", value: email },
          { scope: "phone", value: normalizedPhone },
        ]);

        const conflicts = await findRegistrationIdentityConflicts(connection, {
          email,
          phone: normalizedPhone,
        });

        if (conflicts.email) {
          await connection.query("rollback");
          await recordRateLimitAttempt(pool, "register", "ip", requestIp);
          await recordRateLimitAttempt(pool, "register", "email", email);
          return jsonResponse(409, { error: buildEmailConflictMessage(conflicts.email) });
        }

        if (conflicts.phone) {
          await connection.query("rollback");
          await recordRateLimitAttempt(pool, "register", "ip", requestIp);
          await recordRateLimitAttempt(pool, "register", "email", email);
          return jsonResponse(409, { error: buildPhoneConflictMessage(conflicts.phone) });
        }

        approvalToken = randomUUID().replace(/-/g, "");
        approvalLink = buildRegistrationApprovalLink(event, email, approvalToken);
        pendingRegistrationId = randomUUID();

        await connection.query(
          `delete from ${PENDING_STORE_REGISTRATION_TABLE}
           where used_at is not null
              or expires_at <= now()`,
        );

        await connection.query(
          `insert into ${PENDING_STORE_REGISTRATION_TABLE} (
             id, email, phone, full_name, store_name, password_hash, code_hash, requested_ip, expires_at
           ) values ($1, $2, $3, $4, $5, $6, $7, $8, now() + ($9 * interval '1 hour'))`,
          [
            pendingRegistrationId,
            email,
            normalizedPhone,
            fullName,
            normalizedStoreName,
            passwordHash,
            hashValue(approvalToken),
            requestIp,
            REGISTRATION_APPROVAL_LINK_TTL_HOURS,
          ],
        );

        await connection.query("commit");

        if (isEmailDeliveryConfigured()) {
          try {
            await sendRegistrationApprovalEmail({
              event,
              toEmail: email,
              fullName,
              storeName: normalizedStoreName,
              approvalLink,
            });
          } catch (error) {
            if (!shouldExposeResetCode()) {
              await pool.query(
                `delete from ${PENDING_STORE_REGISTRATION_TABLE}
                 where id = $1`,
                [pendingRegistrationId],
              );
              return jsonResponse(500, {
                error: "Nao foi possivel enviar o email de aprovacao da loja agora.",
              });
            }

            approvalDeliveryWarning =
              "Nao foi possivel enviar o email agora neste ambiente. Usa o link de aprovacao mostrado abaixo para concluir o teste local.";
          }
        }

        await clearRateLimit(pool, "register", "ip", requestIp);
        await clearRateLimit(pool, "register", "email", email);
        return jsonResponse(200, {
          ok: true,
          pendingApproval: true,
          message:
            approvalDeliveryWarning
            || "Quase pronto. Enviamos um link para confirmares o email e criares a tua loja.",
          ...(shouldExposeResetCode() ? { approvalLink } : {}),
        });
      }

      await lockCatalogIdentities(connection, [{ scope: "email", value: email }]);
      const superAdminConflicts = await findRegistrationIdentityConflicts(connection, { email });
      if (superAdminConflicts.email) {
        await connection.query("rollback");
        await recordRateLimitAttempt(pool, "register", "ip", requestIp);
        await recordRateLimitAttempt(pool, "register", "email", email);
        return jsonResponse(409, { error: buildEmailConflictMessage(superAdminConflicts.email) });
      }

      await connection.query(
        `insert into catalog_users (id, email, password_hash, full_name, role)
         values ($1, $2, $3, $4, $5)`,
        [userId, email, passwordHash, fullName, effectiveRole],
      );

      await clearRateLimit(connection, "register", "ip", requestIp);
      await clearRateLimit(connection, "register", "email", email);

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
