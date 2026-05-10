import assert from "node:assert/strict";
import { buildPublicCatalogResponse } from "../netlify/functions/_catalog-cache.js";
import { handler } from "../netlify/functions/catalog-get.js";

export async function runPublicCatalogAccessTests() {
  const postgresState = globalThis.__catalogPostgresState;
  const publicCacheState = globalThis.__catalogPublicCacheState;
  const systemSettingsState = globalThis.__catalogSystemSettingsState;

  const previousPool = postgresState.pool;
  const previousDatabaseReadyPromise = postgresState.databaseReadyPromise;
  const previousColumnPresenceCache = postgresState.columnPresenceCache;
  const previousTablePresenceCache = postgresState.tablePresenceCache;
  const previousPublicCatalogById = publicCacheState.publicCatalogById;
  const previousSystemSettingsCache = systemSettingsState.cache;

  try {
    postgresState.pool = {
      async query(sql) {
        const normalizedSql = String(sql || "");

        if (normalizedSql.includes("select 1")) {
          return { rows: [{ "?column?": 1 }], rowCount: 1 };
        }

        if (normalizedSql.includes("from public.catalog_settings")) {
          return { rows: [], rowCount: 0 };
        }

        if (normalizedSql.includes("from public.catalog_stores stores")) {
          return {
            rows: [
              {
                id: "store-1",
                name: "Loja Bloqueada",
                description: "",
                whatsapp: "244911111111",
                logo: "",
                color: "#16a34a",
                currency_code: "AOA",
                pickup_note: "",
                public_enabled: true,
                whatsapp_order_format: "text_only",
                plan_status: "canceled",
                plan_expires_at: null,
                public_slug: "loja-bloqueada",
                custom_domain: "",
                public_snapshot_response_body: null,
              },
            ],
            rowCount: 1,
          };
        }

        throw new Error(`Unexpected query during public catalog access test: ${normalizedSql}`);
      },
    };
    postgresState.databaseReadyPromise = null;
    postgresState.columnPresenceCache = new Map();
    postgresState.tablePresenceCache = new Map();
    systemSettingsState.cache = null;
    publicCacheState.publicCatalogById = new Map([
      [
        "store-1",
        {
          expiresAt: Date.now() + 60_000,
          response: buildPublicCatalogResponse({
            id: "store-1",
            store: { name: "Cached Store" },
            products: [],
          }),
        },
      ],
    ]);

    const response = await handler({
      httpMethod: "GET",
      headers: {},
      queryStringParameters: {
        id: "store-1",
      },
    });

    assert.equal(response.statusCode, 403);

    const payload = JSON.parse(response.body);
    assert.match(payload.error, /plano foi cancelado|Ativa um plano/i);
    assert.equal(payload.store?.name, "Loja Bloqueada");
  } finally {
    postgresState.pool = previousPool;
    postgresState.databaseReadyPromise = previousDatabaseReadyPromise;
    postgresState.columnPresenceCache = previousColumnPresenceCache;
    postgresState.tablePresenceCache = previousTablePresenceCache;
    publicCacheState.publicCatalogById = previousPublicCatalogById;
    systemSettingsState.cache = previousSystemSettingsCache;
  }
}
