import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import {
  buildRegisterAvailability,
  ensurePendingStoreRegistrationSchema,
  findRegistrationIdentityConflicts,
  validateRegistrationEmail,
  validateRegistrationPhone,
} from "./_registration.js";

async function handle(event) {
  try {
    await ensureDatabaseReady();
    await ensurePendingStoreRegistrationSchema(getPool());
    const payload = JSON.parse(event.body || "{}");
    const requestedEmail = String(payload.email || "").trim();
    const requestedPhone = String(payload.phone || "").trim();

    let normalizedEmail = "";
    let normalizedPhone = "";
    let emailError = "";
    let phoneError = "";

    if (requestedEmail) {
      const emailResult = validateRegistrationEmail(requestedEmail, "O email");
      if (emailResult.error) {
        emailError = emailResult.error;
      } else {
        normalizedEmail = emailResult.normalized;
      }
    }

    if (requestedPhone) {
      const phoneResult = validateRegistrationPhone(requestedPhone, "O numero de telemovel");
      if (phoneResult.error) {
        phoneError = phoneResult.error;
      } else {
        normalizedPhone = phoneResult.normalized;
      }
    }

    let conflicts = {};
    if (normalizedEmail || normalizedPhone) {
      conflicts = await findRegistrationIdentityConflicts(getPool(), {
        email: normalizedEmail,
        phone: normalizedPhone,
      });
    }

    return jsonResponse(200, {
      ok: true,
      ...buildRegisterAvailability({
        email: normalizedEmail,
        phone: normalizedPhone,
        emailError,
        phoneError,
        conflicts,
      }),
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
