import { getSessionContext, sessionPayload } from "./_auth.js";
import { jsonResponse, withCors } from "./_postgres.js";

async function handle(event) {
  try {
    const session = await getSessionContext(event);
    if (!session) {
      return jsonResponse(401, { authenticated: false, error: "Sessao invalida." });
    }

    return jsonResponse(200, sessionPayload(session));
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["GET"] });
