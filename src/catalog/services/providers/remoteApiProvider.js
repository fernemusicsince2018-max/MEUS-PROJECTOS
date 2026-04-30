import { readProviderCache, writeProviderCache } from "../../utils/providerCache.js";

const PUBLIC_CACHE_PREFIX = "cat:cache:public:";
const ADMIN_CACHE_PREFIX = "cat:cache:admin:";

function extractCatalogId(key) {
  return key.startsWith("cat:") ? key.slice(4) : key;
}

function buildPublicCacheKey(catalogId) {
  return `${PUBLIC_CACHE_PREFIX}${catalogId}`;
}

function buildAdminCacheKey(catalogId) {
  return `${ADMIN_CACHE_PREFIX}${catalogId}`;
}

async function readCachedCatalogSnapshot(fallbackProvider, cacheKey) {
  const cached = await readProviderCache(fallbackProvider, cacheKey);
  if (!cached) return null;

  const value =
    typeof cached.payload === "string"
      ? cached.payload
      : JSON.stringify(cached.payload || { s: {}, p: [] });

  return {
    value,
    cachedAt: cached.updatedAt || "",
    offlineFallback: true,
  };
}

async function writeCachedCatalogSnapshot(fallbackProvider, cacheKey, value) {
  return writeProviderCache(fallbackProvider, cacheKey, value);
}

async function parseFailure(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  const failure = new Error(payload.error || fallbackMessage);
  failure.status = response.status;
  failure.payload = payload;
  throw failure;
}

export function createRemoteApiProvider(config, fallbackProvider) {
  const base = (config.apiBaseUrl || "").replace(/\/$/, "");
  const requestCredentials = config.requestCredentials || "same-origin";

  return {
    available: Boolean(base),
    async get(key) {
      if (!base || key === "cat:aid") return fallbackProvider.get(key);

      const catalogId = extractCatalogId(key);
      let response;

      try {
        response = await fetch(`${base}/catalog-get?id=${encodeURIComponent(catalogId)}`, {
          credentials: requestCredentials,
        });
      } catch (error) {
        const cached = await readCachedCatalogSnapshot(fallbackProvider, buildPublicCacheKey(catalogId));
        if (cached) return cached;
        throw error;
      }

      if (response.status === 404) return null;
      if (!response.ok) {
        await parseFailure(response, "Nao foi possivel carregar o catalogo remoto.");
      }

      const data = await response.json();
      const value = JSON.stringify({
        s: data.store || {},
        p: data.products || [],
      });
      const syncedAt = await writeCachedCatalogSnapshot(
        fallbackProvider,
        buildPublicCacheKey(catalogId),
        value,
      );

      return {
        value,
        syncedAt,
      };
    },
    async getAdmin(key) {
      if (!base || key === "cat:aid") return fallbackProvider.get(key);

      const catalogId = extractCatalogId(key);
      let response;

      try {
        response = await fetch(`${base}/catalog-admin-get?id=${encodeURIComponent(catalogId)}`, {
          credentials: requestCredentials,
        });
      } catch (error) {
        const cached = await readCachedCatalogSnapshot(fallbackProvider, buildAdminCacheKey(catalogId));
        if (cached) return cached;
        throw error;
      }

      if (!response.ok) {
        await parseFailure(response, "Nao foi possivel carregar os dados privados da empresa.");
      }

      const data = await response.json();
      const value = JSON.stringify({
        s: data.store || {},
        p: data.products || [],
      });
      const syncedAt = await writeCachedCatalogSnapshot(
        fallbackProvider,
        buildAdminCacheKey(catalogId),
        value,
      );

      return {
        value,
        syncedAt,
      };
    },
    async set(key, value) {
      if (!base || key === "cat:aid") return fallbackProvider.set(key, value);

      const catalogId = extractCatalogId(key);
      const payload = JSON.parse(value);
      const response = await fetch(`${base}/catalog-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify({
          id: catalogId,
          store: payload.s || {},
          products: payload.p || [],
        }),
      });

      if (!response.ok) {
        await parseFailure(response, "Nao foi possivel gravar o catalogo remoto.");
      }

      const savedPayload = await response.json();
      const snapshotValue = JSON.stringify({
        s: savedPayload.store || savedPayload?.data?.store || {},
        p: savedPayload.products || savedPayload?.data?.products || [],
      });
      const syncedAt = await Promise.all([
        writeCachedCatalogSnapshot(fallbackProvider, buildPublicCacheKey(catalogId), snapshotValue),
        writeCachedCatalogSnapshot(fallbackProvider, buildAdminCacheKey(catalogId), snapshotValue),
      ]).then((results) => results.find(Boolean) || "");

      return {
        ...savedPayload,
        syncedAt,
      };
    },
  };
}
