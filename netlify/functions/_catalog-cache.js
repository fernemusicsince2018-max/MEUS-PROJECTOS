import { createHash } from "node:crypto";

const GLOBAL_STATE_KEY = "__catalogPublicCacheState";
const globalState = globalThis[GLOBAL_STATE_KEY] || (globalThis[GLOBAL_STATE_KEY] = {
  publicCatalogById: new Map(),
});

if (!(globalState.publicCatalogById instanceof Map)) {
  globalState.publicCatalogById = new Map();
}

function parsePositiveInt(value, fallback, minimum = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.floor(numeric);
  if (rounded < minimum) return fallback;
  return rounded;
}

function getPublicCatalogCacheTtlMs() {
  return parsePositiveInt(process.env.PUBLIC_CATALOG_CACHE_TTL_MS, 45000, 1000);
}

function getPublicCatalogStaleWhileRevalidateSeconds() {
  return parsePositiveInt(process.env.PUBLIC_CATALOG_CACHE_STALE_WHILE_REVALIDATE_SECONDS, 180, 1);
}

function getPublicCatalogCacheControl() {
  const ttlSeconds = Math.max(1, Math.floor(getPublicCatalogCacheTtlMs() / 1000));
  const staleSeconds = getPublicCatalogStaleWhileRevalidateSeconds();
  return `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=${staleSeconds}`;
}

function createPublicCatalogEtag(body) {
  return `"${createHash("sha1").update(String(body || "")).digest("base64url")}"`;
}

function readHeader(headers = {}, name) {
  const lowered = String(name || "").toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (String(key || "").toLowerCase() === lowered) {
      return Array.isArray(value) ? value[0] || "" : value || "";
    }
  }
  return "";
}

function requestAcceptsEtag(event, etag) {
  const ifNoneMatch = readHeader(event?.headers, "if-none-match");
  if (!ifNoneMatch || !etag) return false;

  return ifNoneMatch
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .some((entry) => entry === "*" || entry === etag);
}

function buildPublicCatalogResponse(payload, options = {}) {
  const body =
    typeof payload === "string"
      ? payload
      : JSON.stringify(payload);
  const etag = String(options.etag || "").trim() || createPublicCatalogEtag(body);
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": getPublicCatalogCacheControl(),
    ETag: etag,
    Vary: "Accept-Encoding",
  };

  return {
    statusCode: 200,
    headers,
    body,
  };
}

function buildNotModifiedResponse(response) {
  return {
    statusCode: 304,
    headers: {
      "Cache-Control": response?.headers?.["Cache-Control"] || getPublicCatalogCacheControl(),
      ETag: response?.headers?.ETag || "",
      Vary: response?.headers?.Vary || "Accept-Encoding",
    },
    body: "",
  };
}

function getCachedPublicCatalogResponse(catalogId) {
  const cacheKey = String(catalogId || "").trim();
  if (!cacheKey) return null;

  const cached = globalState.publicCatalogById.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    globalState.publicCatalogById.delete(cacheKey);
    return null;
  }

  return cached.response || null;
}

function setCachedPublicCatalogResponse(catalogId, response) {
  const cacheKey = String(catalogId || "").trim();
  if (!cacheKey || !response) return;

  globalState.publicCatalogById.set(cacheKey, {
    expiresAt: Date.now() + getPublicCatalogCacheTtlMs(),
    response,
  });
}

function invalidatePublicCatalogCache(catalogId = "") {
  const cacheKey = String(catalogId || "").trim();
  if (!cacheKey) {
    globalState.publicCatalogById.clear();
    return;
  }

  globalState.publicCatalogById.delete(cacheKey);
}

export {
  buildNotModifiedResponse,
  buildPublicCatalogResponse,
  createPublicCatalogEtag,
  getCachedPublicCatalogResponse,
  invalidatePublicCatalogCache,
  requestAcceptsEtag,
  setCachedPublicCatalogResponse,
};
