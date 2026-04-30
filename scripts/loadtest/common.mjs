import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { loadLocalEnv } from "../loadEnv.mjs";

const loadtestEnvMode = String(
  process.env.LOADTEST_ENV
  || process.env.APP_ENV
  || process.env.NODE_ENV
  || "development",
).trim() || "development";

loadLocalEnv(loadtestEnvMode);

const DEFAULT_REPORT_DIR = path.resolve("test-results", "load-tests");

function isDirectRun(importMetaUrl) {
  const scriptPath = process.argv[1];
  if (!scriptPath) return false;
  return pathToFileURL(path.resolve(scriptPath)).href === importMetaUrl;
}

function parseArgs(argv = []) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || "");
    if (!current.startsWith("--")) {
      continue;
    }

    const stripped = current.slice(2);
    const separatorIndex = stripped.indexOf("=");

    if (separatorIndex >= 0) {
      const key = stripped.slice(0, separatorIndex).trim();
      const value = stripped.slice(separatorIndex + 1);
      args[key] = value;
      continue;
    }

    const next = String(argv[index + 1] || "");
    if (next && !next.startsWith("--")) {
      args[stripped.trim()] = next;
      index += 1;
      continue;
    }

    args[stripped.trim()] = "true";
  }

  return args;
}

function readConfigValue(args, key, envKey, fallback = "") {
  const rawValue =
    args?.[key]
    ?? (envKey ? process.env[envKey] : undefined)
    ?? fallback;
  return String(rawValue ?? "").trim();
}

function parseBoolean(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on", "sim"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "nao"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value, fallback) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return fallback;
  return numeric;
}

function parseNonNegativeInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) return fallback;
  return numeric;
}

function parseCsvList(value, fallback = []) {
  const normalized = String(value || "").trim();
  if (!normalized) return [...fallback];
  return normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePositiveIntList(value, fallback = []) {
  return parseCsvList(value, fallback.map(String))
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}

function buildFunctionsBaseUrl(rawBaseUrl) {
  const normalized = String(rawBaseUrl || "").trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new Error("Indica a URL base do staging com --baseUrl ou LOADTEST_BASE_URL.");
  }

  if (/\/api$/i.test(normalized)) {
    return normalized;
  }

  if (/\/\.netlify\/functions$/i.test(normalized)) {
    return normalized;
  }

  return `${normalized}/api`;
}

function buildSiteBaseUrl(rawBaseUrl) {
  const normalized = String(rawBaseUrl || "").trim().replace(/\/+$/, "");
  if (!normalized) return "";
  return normalized.replace(/\/(?:\.netlify\/functions|api)$/i, "");
}

function getTimestampSlug(referenceDate = new Date()) {
  return referenceDate.toISOString().replace(/[:.]/g, "-");
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function summarizeLatencies(latencies = []) {
  if (!latencies.length) {
    return {
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
    };
  }

  const total = latencies.reduce((sum, value) => sum + value, 0);
  return {
    avgMs: total / latencies.length,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
    maxMs: Math.max(...latencies),
  };
}

function parseStages(value, fallbackValue) {
  const rawStages = parseCsvList(value || fallbackValue);
  if (!rawStages.length) {
    throw new Error("Define pelo menos uma stage no formato workers x concurrency x durationSeg.");
  }

  return rawStages.map((entry, index) => {
    const parts = entry.split("x").map((segment) => Number(segment));
    if (parts.length !== 3 || parts.some((segment) => !Number.isInteger(segment) || segment < 1)) {
      throw new Error(`Stage invalida na posicao ${index + 1}: ${entry}. Usa workers x concurrency x durationSeg.`);
    }

    const [workers, concurrencyPerWorker, durationSeconds] = parts;
    return {
      label: entry,
      workers,
      concurrencyPerWorker,
      durationSeconds,
      totalConcurrency: workers * concurrencyPerWorker,
    };
  });
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function getResponseSetCookies(response) {
  if (response?.headers && typeof response.headers.getSetCookie === "function") {
    const cookies = response.headers.getSetCookie();
    if (Array.isArray(cookies) && cookies.length) {
      return cookies;
    }
  }

  const singleHeader = response?.headers?.get?.("set-cookie");
  return singleHeader ? [singleHeader] : [];
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  mergeFromResponse(response) {
    const setCookies = getResponseSetCookies(response);
    for (const rawCookie of setCookies) {
      const [cookiePair] = String(rawCookie || "").split(";");
      const separatorIndex = cookiePair.indexOf("=");
      if (separatorIndex <= 0) continue;
      const key = cookiePair.slice(0, separatorIndex).trim();
      const value = cookiePair.slice(separatorIndex + 1).trim();
      if (!key) continue;
      this.cookies.set(key, value);
    }
  }

  toHeader() {
    return [...this.cookies.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
}

async function requestJson({
  url,
  method = "GET",
  headers = {},
  body,
  cookie,
  timeoutMs = 30000,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const finalHeaders = {
      Accept: "application/json",
      ...headers,
    };

    if (cookie) {
      finalHeaders.Cookie = cookie;
    }

    const response = await fetch(url, {
      method,
      headers: finalHeaders,
      body,
      signal: controller.signal,
    });
    const durationMs = performance.now() - startedAt;
    const bodyText = await response.text();
    let jsonBody = null;

    try {
      jsonBody = bodyText ? JSON.parse(bodyText) : null;
    } catch (error) {
      jsonBody = null;
    }

    return {
      response,
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      bodyText,
      jsonBody,
      durationMs,
      bytes: Buffer.byteLength(bodyText, "utf8"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildRequestError(result, fallbackMessage) {
  const failure = new Error(result?.jsonBody?.error || fallbackMessage);
  failure.status = result?.status || 500;
  failure.payload = result?.jsonBody || null;
  return failure;
}

async function loginWithCookieJar(functionsBaseUrl, email, password, timeoutMs = 30000) {
  const cookieJar = new CookieJar();
  const result = await requestJson({
    url: `${functionsBaseUrl}/auth-login`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    timeoutMs,
  });

  cookieJar.mergeFromResponse(result.response);

  if (!result.ok) {
    throw buildRequestError(result, "Nao foi possivel iniciar sessao para o load test.");
  }

  return {
    cookieJar,
    cookieHeader: cookieJar.toHeader(),
    data: result.jsonBody || {},
    loginResult: result,
  };
}

async function fetchAdminCatalog(functionsBaseUrl, storeId, cookieHeader, timeoutMs = 30000) {
  const result = await requestJson({
    url: `${functionsBaseUrl}/catalog-admin-get?id=${encodeURIComponent(storeId)}`,
    method: "GET",
    cookie: cookieHeader,
    timeoutMs,
  });

  if (!result.ok) {
    throw buildRequestError(result, "Nao foi possivel carregar o catalogo privado.");
  }

  return result.jsonBody || {};
}

async function fetchPublicCatalog(functionsBaseUrl, storeId, timeoutMs = 30000) {
  const result = await requestJson({
    url: `${functionsBaseUrl}/catalog-get?id=${encodeURIComponent(storeId)}`,
    method: "GET",
    timeoutMs,
  });

  if (!result.ok) {
    throw buildRequestError(result, "Nao foi possivel carregar o catalogo publico.");
  }

  return result.jsonBody || {};
}

async function fetchSuperAdminDashboard(functionsBaseUrl, cookieHeader, timeoutMs = 30000) {
  const result = await requestJson({
    url: `${functionsBaseUrl}/super-admin-dashboard?scope=full`,
    method: "GET",
    cookie: cookieHeader,
    timeoutMs,
  });

  if (!result.ok) {
    throw buildRequestError(result, "Nao foi possivel carregar o dashboard do super admin.");
  }

  return result.jsonBody || {};
}

function slugify(value, fallback = "loadtest") {
  const normalized = String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function buildSyntheticProducts({
  productCount,
  prefix = "Load Test",
  categoryCount = 10,
  priceBase = 2500,
  priceStep = 137,
}) {
  const safeProductCount = parsePositiveInt(productCount, 100);
  const safeCategoryCount = parsePositiveInt(categoryCount, 10);
  const categories = Array.from({ length: safeCategoryCount }, (_, index) => `Categoria ${index + 1}`);
  const normalizedPrefix = String(prefix || "Load Test").trim();

  return Array.from({ length: safeProductCount }, (_, index) => {
    const productNumber = index + 1;
    const category = categories[index % categories.length];
    const price = priceBase + (index * priceStep) % 9000;
    const compareAt = productNumber % 5 === 0 ? price + 700 : 0;

    return {
      id: `lt-${safeProductCount}-${String(productNumber).padStart(4, "0")}`,
      name: `${normalizedPrefix} Produto ${String(productNumber).padStart(4, "0")}`,
      description: `Produto sintetico ${productNumber} da suite de carga com foco em catalogo grande e variado.`,
      price,
      compareAt,
      image: "",
      images: [],
      category,
      stock: null,
      featured: productNumber % 9 === 0,
      onPromotion: compareAt > price,
      available: true,
    };
  });
}

function pickOrderProducts(products = [], requestIndex = 0) {
  const safeProducts = Array.isArray(products) ? products.filter((entry) => entry?.id && entry?.available !== false) : [];
  if (!safeProducts.length) {
    throw new Error("Nao existem produtos disponiveis para montar pedidos sinteticos.");
  }

  const quantityTargets = [1, 2, 3];
  const itemCount = quantityTargets[requestIndex % quantityTargets.length];
  const picked = [];

  for (let offset = 0; offset < itemCount; offset += 1) {
    const product = safeProducts[(requestIndex + offset) % safeProducts.length];
    if (!picked.find((entry) => entry.productId === product.id)) {
      picked.push({
        productId: product.id,
        quantity: 1 + ((requestIndex + offset) % 2),
      });
    }
  }

  return picked;
}

function buildSyntheticOrderPayload(storeId, products, requestIndex = 0) {
  const uniqueNumber = 900000000 + requestIndex;
  const customerPhone = `244${String(uniqueNumber).slice(-9)}`;
  const fulfillmentType = requestIndex % 4 === 0 ? "pickup" : "delivery";

  return {
    storeId,
    customerName: `Load Test Customer ${requestIndex + 1}`,
    customerPhone,
    fulfillmentType,
    region: "Luanda",
    area: `Zona ${((requestIndex % 12) + 1)}`,
    pickupTime: fulfillmentType === "pickup" ? "10:00" : "",
    deliveryTime: fulfillmentType === "delivery" ? "14:00" : "",
    notes: `Pedido sintetico ${requestIndex + 1} gerado pela suite de carga.`,
    items: pickOrderProducts(products, requestIndex).map((entry) => ({
      productId: entry.productId,
      quantity: entry.quantity,
    })),
  };
}

async function createSessionPool(functionsBaseUrl, email, password, sessionPoolSize) {
  const size = parsePositiveInt(sessionPoolSize, 1);
  const sessions = [];

  for (let index = 0; index < size; index += 1) {
    const session = await loginWithCookieJar(functionsBaseUrl, email, password);
    sessions.push({
      cookieHeader: session.cookieHeader,
      data: session.data,
    });
  }

  return sessions;
}

function summarizeStageResults(workerResults = [], elapsedSeconds = 0) {
  const latencies = workerResults.flatMap((entry) => entry.latencies || []);
  const requestCount = workerResults.reduce((sum, entry) => sum + Number(entry.requestCount || 0), 0);
  const errorCount = workerResults.reduce((sum, entry) => sum + Number(entry.errorCount || 0), 0);
  const bytes = workerResults.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0);
  const statusCounts = workerResults.reduce((accumulator, entry) => {
    for (const [status, count] of Object.entries(entry.statusCounts || {})) {
      accumulator[status] = (accumulator[status] || 0) + Number(count || 0);
    }
    return accumulator;
  }, {});

  const okCount = Object.entries(statusCounts)
    .filter(([status]) => /^\d+$/.test(status) && status.startsWith("2"))
    .reduce((sum, [, count]) => sum + Number(count || 0), 0);

  return {
    requestCount,
    errorCount,
    bytes,
    statusCounts,
    successRate: requestCount ? (okCount / requestCount) * 100 : 0,
    errorRate: requestCount ? (errorCount / requestCount) * 100 : 0,
    requestsPerSecond: elapsedSeconds > 0 ? requestCount / elapsedSeconds : 0,
    megabytesPerSecond: elapsedSeconds > 0 ? bytes / elapsedSeconds / 1024 / 1024 : 0,
    latencySummary: summarizeLatencies(latencies),
  };
}

function writeReportArtifacts({ reportLabel, jsonPayload, markdown }) {
  const safeLabel = slugify(reportLabel || "loadtest-report");
  const reportDir = ensureDirectory(DEFAULT_REPORT_DIR);
  const timestamp = getTimestampSlug();
  const basePath = path.join(reportDir, `${timestamp}-${safeLabel}`);
  const jsonPath = `${basePath}.json`;
  const markdownPath = `${basePath}.md`;

  fs.writeFileSync(jsonPath, JSON.stringify(jsonPayload, null, 2));
  fs.writeFileSync(markdownPath, markdown);

  return {
    reportDir,
    jsonPath,
    markdownPath,
  };
}

export {
  buildFunctionsBaseUrl,
  buildRequestError,
  buildSiteBaseUrl,
  buildSyntheticOrderPayload,
  buildSyntheticProducts,
  createSessionPool,
  ensureDirectory,
  fetchAdminCatalog,
  fetchPublicCatalog,
  fetchSuperAdminDashboard,
  formatNumber,
  getTimestampSlug,
  isDirectRun,
  loginWithCookieJar,
  parseArgs,
  parseBoolean,
  parseCsvList,
  parseNonNegativeInt,
  parsePositiveInt,
  parsePositiveIntList,
  parseStages,
  percentile,
  readConfigValue,
  requestJson,
  slugify,
  summarizeLatencies,
  summarizeStageResults,
  writeReportArtifacts,
};
