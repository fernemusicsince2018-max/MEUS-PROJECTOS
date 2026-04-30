import { getSuperAdminSession, requireSuperAdminAccess } from "./_auth.js";
import { invalidatePublicCatalogCache } from "./_catalog-cache.js";
import { getPool, jsonResponse, withCors } from "./_postgres.js";
import { invalidateSystemSettingsCache } from "./_settings.js";

async function handle(event) {
  try {
    const session = await getSuperAdminSession(event);
    requireSuperAdminAccess(session, "configuracoes", "Nao tens permissao para alterar as configuracoes globais.");
    const payload = JSON.parse(event.body || "{}"); // { key, value }

    if (!payload.key) return jsonResponse(400, { error: "Chave de configuracao ausente." });

    const pool = getPool();
    await pool.query(
      `insert into catalog_settings (key, value)
       values ($1, $2)
       on conflict (key) do update set
         value = excluded.value,
         updated_at = now()`,
      [payload.key, String(payload.value)]
    );

    invalidateSystemSettingsCache();
    invalidatePublicCatalogCache();

    return jsonResponse(200, { ok: true });
  } catch (error) {
    return jsonResponse(error.status || 500, {
      error: error.message || "Falha ao gravar configuracao.",
    });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
