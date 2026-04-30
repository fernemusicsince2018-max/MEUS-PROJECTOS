import { buildExpiredSessionCookie, deleteSessionByEvent } from "./_auth.js";
import { jsonResponse, withCors } from "./_postgres.js";

async function handle(event) {
  try {
    await deleteSessionByEvent(event);

    return jsonResponse(
      200,
      { ok: true },
      {
        "Set-Cookie": buildExpiredSessionCookie(),
      },
    );
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
