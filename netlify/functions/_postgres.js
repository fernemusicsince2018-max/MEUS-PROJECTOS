import { AsyncLocalStorage } from "node:async_hooks";
import { Pool } from "pg";

const GLOBAL_STATE_KEY = "__catalogPostgresState";
const RESPONSE_CONTEXT_STATE_KEY = "__catalogHttpResponseContext";
const globalState = globalThis[GLOBAL_STATE_KEY] || (globalThis[GLOBAL_STATE_KEY] = {
  pool: null,
  databaseReadyPromise: null,
  columnPresenceCache: new Map(),
});
const responseContextStorage =
  globalThis[RESPONSE_CONTEXT_STATE_KEY] || (globalThis[RESPONSE_CONTEXT_STATE_KEY] = new AsyncLocalStorage());

const DEFAULT_CORS_ALLOW_HEADERS = "Content-Type, Authorization, X-Requested-With";
const DEFAULT_CORS_EXPOSE_HEADERS = "ETag";
const DEFAULT_CORS_MAX_AGE_SECONDS = 86400;

if (!("pool" in globalState)) {
  globalState.pool = null;
}

if (!("databaseReadyPromise" in globalState)) {
  globalState.databaseReadyPromise = null;
}

if (!(globalState.columnPresenceCache instanceof Map)) {
  globalState.columnPresenceCache = new Map();
}

function normalizeHttpMethod(value, fallback = "") {
  return String(value || fallback).trim().toUpperCase();
}

function normalizeHttpMethods(methods = [], fallback = ["GET"]) {
  const normalized = new Set();
  const source = Array.isArray(methods) ? methods : [methods];

  for (const method of source) {
    const upper = normalizeHttpMethod(method);
    if (upper) {
      normalized.add(upper);
    }
  }

  if (!normalized.size) {
    fallback.forEach((method) => {
      const upper = normalizeHttpMethod(method);
      if (upper) {
        normalized.add(upper);
      }
    });
  }

  return [...normalized];
}

function splitHeaderValues(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mergeHeaderValueLists(...values) {
  const merged = [];

  for (const value of values) {
    for (const entry of splitHeaderValues(value)) {
      const alreadyAdded = merged.some(
        (existing) => existing.toLowerCase() === entry.toLowerCase(),
      );
      if (!alreadyAdded) {
        merged.push(entry);
      }
    }
  }

  return merged.join(", ");
}

function mergeHeaders(baseHeaders = {}, extraHeaders = {}) {
  const merged = {
    ...(baseHeaders || {}),
    ...(extraHeaders || {}),
  };

  const mergeableHeaderNames = [
    "Vary",
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Methods",
    "Access-Control-Expose-Headers",
  ];

  for (const headerName of mergeableHeaderNames) {
    const leftValue = baseHeaders?.[headerName];
    const rightValue = extraHeaders?.[headerName];
    const mergedValue = mergeHeaderValueLists(leftValue, rightValue);

    if (mergedValue) {
      merged[headerName] = mergedValue;
    } else {
      delete merged[headerName];
    }
  }

  return merged;
}

function readEventHeader(event, name) {
  const loweredName = String(name || "").trim().toLowerCase();
  if (!loweredName) return "";

  const headers = event?.headers || {};
  for (const [key, value] of Object.entries(headers)) {
    if (String(key || "").trim().toLowerCase() !== loweredName) continue;

    if (Array.isArray(value)) {
      return String(value.find(Boolean) || "").trim();
    }

    return String(value || "").trim();
  }

  return "";
}

function normalizeOrigin(value) {
  const origin = String(value || "").trim();
  if (!origin || origin.toLowerCase() === "null") return "";
  return origin;
}

function parseAllowedCorsOrigins() {
  return String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseUrlOrNull(value) {
  try {
    return new URL(String(value || ""));
  } catch (error) {
    return null;
  }
}

function getEventRequestOrigin(event) {
  const rawUrlOrigin = parseUrlOrNull(event?.rawUrl)?.origin;
  if (rawUrlOrigin) {
    return rawUrlOrigin;
  }

  const host =
    readEventHeader(event, "x-forwarded-host")
    || readEventHeader(event, "host");
  if (!host) return "";

  const protocolHeader = readEventHeader(event, "x-forwarded-proto");
  const protocol = String(protocolHeader || "https")
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (!protocol) return "";
  return `${protocol}://${host}`;
}

function matchesWildcardOrigin(origin, pattern) {
  const originUrl = parseUrlOrNull(origin);
  if (!originUrl) return false;

  const schemeWildcardMatch = String(pattern || "")
    .trim()
    .match(/^([a-z][a-z0-9+.-]*):\/\/\*\.([^/:]+)$/i);
  if (schemeWildcardMatch) {
    const [, scheme, hostSuffix] = schemeWildcardMatch;
    const normalizedSuffix = String(hostSuffix || "").trim().toLowerCase();
    const normalizedHostname = String(originUrl.hostname || "").trim().toLowerCase();

    return (
      originUrl.protocol === `${String(scheme || "").trim().toLowerCase()}:`
      && (
        normalizedHostname === normalizedSuffix
        || normalizedHostname.endsWith(`.${normalizedSuffix}`)
      )
    );
  }

  const hostnameWildcardMatch = String(pattern || "").trim().match(/^\*\.([^/:]+)$/i);
  if (hostnameWildcardMatch) {
    const [, hostSuffix] = hostnameWildcardMatch;
    const normalizedSuffix = String(hostSuffix || "").trim().toLowerCase();
    const normalizedHostname = String(originUrl.hostname || "").trim().toLowerCase();

    return (
      normalizedHostname === normalizedSuffix
      || normalizedHostname.endsWith(`.${normalizedSuffix}`)
    );
  }

  return false;
}

function isOriginAllowed(origin, event) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  const requestOrigin = normalizeOrigin(getEventRequestOrigin(event));
  if (requestOrigin && requestOrigin.toLowerCase() === normalizedOrigin.toLowerCase()) {
    return true;
  }

  return parseAllowedCorsOrigins().some((allowedOrigin) => {
    if (allowedOrigin === "*") {
      return true;
    }

    if (allowedOrigin.toLowerCase() === normalizedOrigin.toLowerCase()) {
      return true;
    }

    return matchesWildcardOrigin(normalizedOrigin, allowedOrigin);
  });
}

function buildCorsHeaders(event, options = {}) {
  const allowMethods = normalizeHttpMethods(options.allowMethods, ["GET"]);
  const requestOrigin = normalizeOrigin(readEventHeader(event, "origin"));
  const requestHeaders = readEventHeader(event, "access-control-request-headers");
  const allowedOrigin = isOriginAllowed(requestOrigin, event) ? requestOrigin : "";

  if (!allowedOrigin) {
    return {
      allowMethods,
      allowedOrigin: "",
      headers: requestOrigin ? { Vary: "Origin" } : {},
    };
  }

  return {
    allowMethods,
    allowedOrigin,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": mergeHeaderValueLists(allowMethods.join(", "), "OPTIONS"),
      "Access-Control-Allow-Headers": requestHeaders || DEFAULT_CORS_ALLOW_HEADERS,
      "Access-Control-Expose-Headers": DEFAULT_CORS_EXPOSE_HEADERS,
      Vary: "Origin",
    },
  };
}

function getResponseContext() {
  return responseContextStorage.getStore() || null;
}

function getResponseContextHeaders() {
  return getResponseContext()?.headers || {};
}

function applyResponseContextToResponse(response) {
  if (!response || typeof response !== "object") {
    return response;
  }

  return {
    ...response,
    headers: mergeHeaders(getResponseContextHeaders(), response.headers || {}),
  };
}

function createHttpResponse(statusCode, body = "", headers = {}, options = {}) {
  const resolvedHeaders = options.applyContext === false
    ? { ...(headers || {}) }
    : mergeHeaders(getResponseContextHeaders(), headers || {});

  return {
    statusCode,
    headers: resolvedHeaders,
    body: body == null ? "" : String(body),
  };
}

function jsonResponse(statusCode, payload, extraHeaders = {}, options = {}) {
  return createHttpResponse(
    statusCode,
    JSON.stringify(payload),
    {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    options,
  );
}

function methodNotAllowed(allowMethods, message = "Metodo nao permitido.") {
  const normalizedMethods = normalizeHttpMethods(allowMethods, ["GET"]);
  return jsonResponse(
    405,
    { error: message },
    {
      Allow: mergeHeaderValueLists(normalizedMethods.join(", "), "OPTIONS"),
    },
  );
}

function buildCorsPreflightResponse(event, options = {}) {
  if (normalizeHttpMethod(event?.httpMethod) !== "OPTIONS") {
    return null;
  }

  const corsState = buildCorsHeaders(event, options);
  const varyHeader = mergeHeaderValueLists(
    corsState.headers?.Vary,
    "Access-Control-Request-Method, Access-Control-Request-Headers",
  );

  if (!corsState.allowedOrigin && normalizeOrigin(readEventHeader(event, "origin"))) {
    return createHttpResponse(
      403,
      JSON.stringify({ error: "Origem nao autorizada para esta API." }),
      {
        "Content-Type": "application/json",
        Vary: varyHeader,
      },
      { applyContext: false },
    );
  }

  return createHttpResponse(
    204,
    "",
    {
      ...corsState.headers,
      Allow: mergeHeaderValueLists(corsState.allowMethods.join(", "), "OPTIONS"),
      "Access-Control-Max-Age": String(DEFAULT_CORS_MAX_AGE_SECONDS),
      Vary: varyHeader,
    },
    { applyContext: false },
  );
}

function withCors(requestHandler, options = {}) {
  const allowMethods = normalizeHttpMethods(options.allowMethods, ["GET"]);

  return async function corsWrappedHandler(event, context) {
    const preflightResponse = buildCorsPreflightResponse(event, { allowMethods });
    if (preflightResponse) {
      return preflightResponse;
    }

    const corsState = buildCorsHeaders(event, { allowMethods });

    return responseContextStorage.run(
      {
        allowMethods,
        headers: corsState.headers,
      },
      async () => {
        if (!allowMethods.includes(normalizeHttpMethod(event?.httpMethod))) {
          return methodNotAllowed(allowMethods);
        }

        const response = await requestHandler(event, context);
        return applyResponseContextToResponse(response);
      },
    );
  };
}

function shouldUseSsl(value) {
  if (!value) return false;
  return ["1", "true", "yes", "on", "require"].includes(String(value).toLowerCase());
}

function parsePositiveIntegerEnv(value, fallback, minimum = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.floor(numeric);
  if (rounded < minimum) return fallback;
  return rounded;
}

function parseBooleanEnv(value, fallback = false) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function shouldUsePooler() {
  return parseBooleanEnv(process.env.POSTGRES_USE_POOLER || process.env.POSTGRES_POOLER, false)
    || Boolean(String(process.env.POSTGRES_POOLER_URL || "").trim());
}

function getPostgresConfig() {
  const connectionString =
    process.env.POSTGRES_POOLER_URL
    || process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || "";
  const sslEnabled = shouldUseSsl(process.env.POSTGRES_SSL || process.env.PGSSL);
  const ssl = sslEnabled ? { rejectUnauthorized: false } : undefined;
  const usePooler = shouldUsePooler();
  const poolMax = parsePositiveIntegerEnv(
    process.env.POSTGRES_POOL_MAX,
    usePooler ? 3 : 5,
  );
  const idleTimeoutMillis = parsePositiveIntegerEnv(process.env.POSTGRES_IDLE_TIMEOUT_MS, 10000, 1000);
  const connectionTimeoutMillis = parsePositiveIntegerEnv(
    process.env.POSTGRES_CONNECTION_TIMEOUT_MS,
    10000,
    1000,
  );
  const queryTimeoutMillis = parsePositiveIntegerEnv(process.env.POSTGRES_QUERY_TIMEOUT_MS, 0, 0);
  const statementTimeoutMillis = parsePositiveIntegerEnv(process.env.POSTGRES_STATEMENT_TIMEOUT_MS, 0, 0);
  const keepAliveInitialDelayMillis = parsePositiveIntegerEnv(
    process.env.POSTGRES_KEEPALIVE_INITIAL_DELAY_MS,
    0,
    0,
  );
  const maxUses = parsePositiveIntegerEnv(process.env.POSTGRES_POOL_MAX_USES, 0, 0);
  const baseConfig = {
    ssl,
    max: poolMax,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    keepAlive: parseBooleanEnv(process.env.POSTGRES_KEEPALIVE, true),
    allowExitOnIdle: parseBooleanEnv(process.env.POSTGRES_ALLOW_EXIT_ON_IDLE, false),
  };

  if (queryTimeoutMillis > 0) {
    baseConfig.query_timeout = queryTimeoutMillis;
  }

  if (statementTimeoutMillis > 0) {
    baseConfig.statement_timeout = statementTimeoutMillis;
  }

  if (keepAliveInitialDelayMillis > 0) {
    baseConfig.keepAliveInitialDelayMillis = keepAliveInitialDelayMillis;
  }

  if (maxUses > 0) {
    baseConfig.maxUses = maxUses;
  }

  const applicationName = String(
    process.env.POSTGRES_APPLICATION_NAME
    || process.env.PGAPPNAME
    || "kastrozap",
  ).trim();

  if (applicationName) {
    baseConfig.application_name = applicationName;
  }

  if (connectionString) {
    return {
      ...baseConfig,
      connectionString,
    };
  }

  const host = process.env.POSTGRES_HOST || process.env.PGHOST;
  const database = process.env.POSTGRES_DATABASE || process.env.PGDATABASE;
  const user = process.env.POSTGRES_USER || process.env.PGUSER;
  const password = process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error(
      "Configura POSTGRES_POOLER_URL, DATABASE_URL ou POSTGRES_HOST, POSTGRES_DATABASE, POSTGRES_USER e POSTGRES_PASSWORD.",
    );
  }

  return {
    ...baseConfig,
    host,
    port: Number(process.env.POSTGRES_PORT || process.env.PGPORT || 5432),
    database,
    user,
    password,
  };
}

function getPool() {
  if (!globalState.pool) {
    globalState.pool = new Pool(getPostgresConfig());
  }

  return globalState.pool;
}

async function ensureDatabaseReady() {
  if (!globalState.databaseReadyPromise) {
    globalState.databaseReadyPromise = (async () => {
      await getPool().query("select 1");
    })().catch((error) => {
      globalState.databaseReadyPromise = null;
      throw error;
    });
  }

  return globalState.databaseReadyPromise;
}

async function hasColumn(queryable, tableName, columnName, schemaName = "public", options = {}) {
  const refresh = Boolean(options && options.refresh);
  const cacheMissing = Boolean(options && options.cacheMissing);
  const cacheKey = `${schemaName}.${tableName}.${columnName}`;
  if (!refresh && globalState.columnPresenceCache.has(cacheKey)) {
    return globalState.columnPresenceCache.get(cacheKey);
  }

  const result = await queryable.query(
    `select 1
       from information_schema.columns
      where table_schema = $1
        and table_name = $2
        and column_name = $3
      limit 1`,
    [schemaName, tableName, columnName],
  );

  const present = result.rowCount > 0;
  if (present || cacheMissing) {
    globalState.columnPresenceCache.set(cacheKey, present);
  } else {
    globalState.columnPresenceCache.delete(cacheKey);
  }
  return present;
}

function mapStore(row, options = {}) {
  const store = {
    name: row.name || "",
    description: row.description || "",
    whatsapp: row.whatsapp || "",
    logo: row.logo || "",
    color: row.color || "#16a34a",
    currencyCode: row.currency_code || "AOA",
    pickupNote: row.pickup_note || "",
    whatsappOrderFormat: row.whatsapp_order_format || "text_only",
    publicEnabled: Boolean(row.public_enabled),
    publicSlug: row.public_slug || "",
    customDomain: row.custom_domain || "",
  };

  if (options.includeBusinessData) {
    return {
      ...store,
      legalName: row.legal_name || "",
      taxId: row.tax_id || "",
      businessEmail: row.business_email || "",
      businessPhone: row.business_phone || "",
      addressLine: row.address_line || "",
      city: row.city || "",
      country: row.country || "",
    };
  }

  return store;
}

function mapProduct(row) {
  let rawImages = [];
  if (Array.isArray(row.images)) {
    rawImages = row.images;
  } else if (typeof row.images === "string" && row.images.trim()) {
    try {
      const parsed = JSON.parse(row.images);
      rawImages = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      rawImages = [];
    }
  }

  const images = rawImages.filter((entry) => typeof entry === "string" && entry.trim());

  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    price: Number(row.price || 0),
    compareAt: Number(row.compare_at || 0),
    image: row.image || images[0] || "",
    images,
    category: row.category || "",
    stock: row.stock == null ? "" : Number(row.stock),
    featured: Boolean(row.featured),
    onPromotion: Boolean(row.on_promotion),
    available: Boolean(row.available),
  };
}

export {
  applyResponseContextToResponse,
  buildCorsPreflightResponse,
  createHttpResponse,
  ensureDatabaseReady,
  getPool,
  hasColumn,
  jsonResponse,
  mapProduct,
  mapStore,
  methodNotAllowed,
  withCors,
};
