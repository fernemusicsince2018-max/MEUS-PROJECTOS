import { getPlanAccessState } from "./_auth.js";
import {
  buildNotModifiedResponse,
  buildPublicCatalogResponse,
  getCachedPublicCatalogResponse,
  requestAcceptsEtag,
  setCachedPublicCatalogResponse,
} from "./_catalog-cache.js";
import {
  hydratePublicCatalogSnapshotBody,
  upsertPublicCatalogSnapshot,
} from "./_public-catalog-snapshots.js";
import { ensureDatabaseReady, getPool, jsonResponse, mapProduct, mapStore, withCors } from "./_postgres.js";
import { getSystemSettings } from "./_settings.js";

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const id = event.queryStringParameters?.id;
    if (!id) return jsonResponse(400, { error: "Parametro id e obrigatorio." });

    const pool = getPool();
    const systemSettings = await getSystemSettings(pool);
    if (systemSettings.maintenanceMode) {
      return jsonResponse(503, {
        error: "O catalogo esta temporariamente em manutencao. Tenta novamente mais tarde.",
      });
    }

    const cachedResponse = getCachedPublicCatalogResponse(id);
    if (cachedResponse) {
      if (requestAcceptsEtag(event, cachedResponse.headers?.ETag)) {
        return buildNotModifiedResponse(cachedResponse);
      }

      return cachedResponse;
    }

    const stores = await pool.query(
      `select
         stores.id,
         stores.name,
         stores.description,
         stores.whatsapp,
         stores.logo,
         stores.color,
         stores.currency_code,
         stores.pickup_note,
         stores.public_enabled,
         stores.whatsapp_order_format,
         stores.plan_status,
         stores.plan_expires_at,
         stores.public_slug,
         stores.custom_domain,
         snapshots.response_body as public_snapshot_response_body
        from public.catalog_stores stores
        left join public.catalog_public_snapshots snapshots on snapshots.store_id = stores.id
       where stores.id = $1
         and stores.deleted_at is null
       limit 1`,
      [id],
    );

    if (!stores.rows.length) {
      return jsonResponse(404, { error: "Catalogo nao encontrado." });
    }

    const storeRow = stores.rows[0];
    if (!storeRow.public_enabled) {
      return jsonResponse(404, { error: "Catalogo nao encontrado." });
    }

    const planAccess = getPlanAccessState(storeRow.plan_status, storeRow.plan_expires_at);
    if (!planAccess.allowed) {
      return jsonResponse(403, {
        error: planAccess.message || "Este catalogo esta temporariamente indisponivel.",
        planStatus: storeRow.plan_status || "",
        planExpiresAt: storeRow.plan_expires_at || null,
        store: {
          ...mapStore(storeRow),
          supportWhatsApp: systemSettings.supportWhatsApp,
        },
      });
    }

    if (storeRow.public_snapshot_response_body) {
      try {
        const snapshotPayload = hydratePublicCatalogSnapshotBody(
          storeRow.public_snapshot_response_body,
          systemSettings.supportWhatsApp,
        );
        if (snapshotPayload) {
          const response = buildPublicCatalogResponse(snapshotPayload);
          setCachedPublicCatalogResponse(id, response);

          if (requestAcceptsEtag(event, response.headers?.ETag)) {
            return buildNotModifiedResponse(response);
          }

          return response;
        }
      } catch (error) {
        // If the persisted snapshot is malformed, we rebuild it from source tables below.
      }
    }

    const products = await pool.query(
      `select id, catalog_id, name, description, price, compare_at, image, images, category, stock, featured, on_promotion, available
       from public.catalog_products
       where catalog_id = $1
       order by category asc, name asc`,
      [id],
    );

    const mappedStore = mapStore(storeRow);
    const mappedProducts = products.rows.map(mapProduct);

    await upsertPublicCatalogSnapshot(pool, {
      id,
      store: mappedStore,
      products: mappedProducts,
    });

    const response = buildPublicCatalogResponse({
      id,
      store: {
        ...mappedStore,
        supportWhatsApp: systemSettings.supportWhatsApp,
      },
      products: mappedProducts,
    });

    setCachedPublicCatalogResponse(id, response);

    if (requestAcceptsEtag(event, response.headers?.ETag)) {
      return buildNotModifiedResponse(response);
    }

    return response;
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["GET"] });
