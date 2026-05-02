import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { resolveFunctionNameFromPath, runFunctionByName } from "../scripts/functions-runtime.mjs";
import { ensureDatabaseReady, getPool } from "../netlify/functions/_postgres.js";
import {
  buildStorefrontCatalogUrl,
  buildStorefrontTrackingUrl,
  getSubdomainSlugFromHostname,
  normalizeHostname,
} from "./storefront.js";

const DEFAULT_ALLOWED_HEADERS =
  "Content-Type, Authorization, X-Notification-Dispatch-Secret, X-Cron-Secret";
const DEFAULT_ALLOWED_METHODS = "GET, POST, OPTIONS";
const IMMUTABLE_ASSET_PATTERN = /-[A-Za-z0-9_-]{6,}\./;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

const MANAGED_HEAD_TAG_PATTERNS = [
  /<title\b[^>]*>.*?<\/title>/is,
  /<meta\b[^>]*name=["']description["'][^>]*>/i,
  /<meta\b[^>]*name=["']theme-color["'][^>]*>/i,
  /<meta\b[^>]*name=["']apple-mobile-web-app-title["'][^>]*>/i,
  /<meta\b[^>]*name=["']robots["'][^>]*>/i,
  /<meta\b[^>]*property=["']og:type["'][^>]*>/i,
  /<meta\b[^>]*property=["']og:title["'][^>]*>/i,
  /<meta\b[^>]*property=["']og:description["'][^>]*>/i,
  /<meta\b[^>]*property=["']og:url["'][^>]*>/i,
  /<meta\b[^>]*property=["']og:image["'][^>]*>/i,
  /<meta\b[^>]*name=["']twitter:card["'][^>]*>/i,
  /<meta\b[^>]*name=["']twitter:title["'][^>]*>/i,
  /<meta\b[^>]*name=["']twitter:description["'][^>]*>/i,
  /<meta\b[^>]*name=["']twitter:image["'][^>]*>/i,
  /<link\b[^>]*rel=["']canonical["'][^>]*>/i,
];

function cleanText(value) {
  return String(value || "").trim();
}

function isLikelyLocalHostname(hostname = "") {
  const normalizedHost = normalizeHostname(hostname);
  return (
    !normalizedHost
    || normalizedHost === "localhost"
    || normalizedHost === "127.0.0.1"
    || normalizedHost === "[::1]"
    || normalizedHost.endsWith(".local")
  );
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function getBrandConfig(env = process.env) {
  return {
    name: cleanText(env.VITE_BRAND_NAME || env.BRAND_NAME) || "KastroZap",
    tagline: cleanText(env.VITE_BRAND_TAGLINE || env.BRAND_TAGLINE) || "Sua loja no WhatsApp.",
    accent: cleanText(env.VITE_BRAND_ACCENT || env.BRAND_ACCENT) || "#25ae82",
    dark: cleanText(env.VITE_BRAND_DARK || env.BRAND_DARK) || "#1b1c48",
    logoUrl: cleanText(env.VITE_BRAND_LOGO_URL || env.BRAND_LOGO_URL) || "/pwa-icon.svg",
  };
}

function getRequestProtocol(request, env = process.env) {
  const forwardedProtocol = cleanText(request?.headers?.["x-forwarded-proto"]).toLowerCase();
  if (forwardedProtocol) {
    return forwardedProtocol.split(",")[0] || "https";
  }

  if (request?.socket?.encrypted) {
    return "https";
  }

  return cleanText(env.APP_BASE_URL).toLowerCase().startsWith("https://") ? "https" : "http";
}

function getRequestOrigin(request, env = process.env) {
  const requestHost = cleanText(request?.headers?.host);
  if (!requestHost) return "";
  return `${getRequestProtocol(request, env)}://${requestHost}`;
}

function toAbsoluteUrl(value, origin = "") {
  const text = cleanText(value);
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/") && origin) {
    return `${origin}${text}`;
  }
  return "";
}

function stripManagedHeadTags(html = "") {
  return MANAGED_HEAD_TAG_PATTERNS.reduce(
    (currentHtml, pattern) => currentHtml.replace(pattern, ""),
    String(html || ""),
  );
}

function injectManagedHead(html = "", metadata = {}) {
  const canonicalUrl = cleanText(metadata.canonicalUrl);
  const imageUrl = cleanText(metadata.imageUrl);
  const robots = cleanText(metadata.robots);
  const title = cleanText(metadata.title) || "KastroZap";
  const description = cleanText(metadata.description) || "Sua loja no WhatsApp com catalogo digital.";
  const appTitle = cleanText(metadata.appTitle) || title;
  const themeColor = cleanText(metadata.themeColor) || "#25ae82";
  const twitterCard = imageUrl ? "summary_large_image" : "summary";

  const headTags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeAttribute(description)}" />`,
    `<meta name="theme-color" content="${escapeAttribute(themeColor)}" />`,
    `<meta name="apple-mobile-web-app-title" content="${escapeAttribute(appTitle)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeAttribute(title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(description)}" />`,
    `<meta name="twitter:card" content="${escapeAttribute(twitterCard)}" />`,
    `<meta name="twitter:title" content="${escapeAttribute(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}" />`,
  ];

  if (robots) {
    headTags.push(`<meta name="robots" content="${escapeAttribute(robots)}" />`);
  }

  if (canonicalUrl) {
    headTags.push(`<link rel="canonical" href="${escapeAttribute(canonicalUrl)}" />`);
    headTags.push(`<meta property="og:url" content="${escapeAttribute(canonicalUrl)}" />`);
  }

  if (imageUrl) {
    headTags.push(`<meta property="og:image" content="${escapeAttribute(imageUrl)}" />`);
    headTags.push(`<meta name="twitter:image" content="${escapeAttribute(imageUrl)}" />`);
  }

  const sanitizedHtml = stripManagedHeadTags(html);
  const headBlock = `  ${headTags.join("\n  ")}\n`;
  if (sanitizedHtml.includes("</head>")) {
    return sanitizedHtml.replace("</head>", `${headBlock}</head>`);
  }

  if (sanitizedHtml.includes("<body")) {
    return sanitizedHtml.replace("<body", `<head>\n${headBlock}</head>\n<body`);
  }

  return `<head>\n${headBlock}</head>\n${sanitizedHtml}`;
}

async function readJsonFunctionPayload(functionName, pathnameWithSearch, request, runFunction) {
  const syntheticRequest = {
    method: "GET",
    url: pathnameWithSearch,
    headers: {
      ...(request?.headers || {}),
      host: cleanText(request?.headers?.host) || "127.0.0.1",
      "x-forwarded-proto": getRequestProtocol(request),
    },
  };

  const result = await runFunction(functionName, syntheticRequest, [], { fresh: false });
  const payload = result?.body ? JSON.parse(result.body) : {};
  return {
    statusCode: result?.statusCode || 200,
    payload,
  };
}

async function defaultLookupStorefrontByHost(hostname, env = process.env) {
  const normalizedHost = normalizeHostname(hostname);
  if (!normalizedHost) return null;

  await ensureDatabaseReady();
  const pool = getPool();
  const customDomainResult = await pool.query(
    `select id, public_slug, custom_domain
       from public.catalog_stores
      where deleted_at is null
        and lower(custom_domain) = lower($1)
      limit 1`,
    [normalizedHost],
  );

  if (customDomainResult.rows.length) {
    return customDomainResult.rows[0];
  }

  const storefrontBaseDomain = cleanText(
    env.PUBLIC_CATALOG_BASE_DOMAIN || env.VITE_PUBLIC_CATALOG_BASE_DOMAIN,
  );
  const publicSlug = getSubdomainSlugFromHostname(normalizedHost, storefrontBaseDomain);
  if (!publicSlug) return null;

  const subdomainResult = await pool.query(
    `select id, public_slug, custom_domain
       from public.catalog_stores
      where deleted_at is null
        and lower(public_slug) = lower($1)
      limit 1`,
    [publicSlug],
  );

  return subdomainResult.rows[0] || null;
}

function buildCatalogMetadataFromPayload(storeId, payload, request, env = process.env) {
  const brand = getBrandConfig(env);
  const origin = getRequestOrigin(request, env);
  const store = payload?.store || {};
  const products = Array.isArray(payload?.products) ? payload.products : [];
  const imageUrl =
    toAbsoluteUrl(store.logo, origin)
    || toAbsoluteUrl(products.find((product) => cleanText(product?.image))?.image, origin)
    || toAbsoluteUrl(brand.logoUrl, origin);

  return {
    title: `${cleanText(store.name) || "Catalogo"} | ${brand.name}`,
    description:
      cleanText(store.description)
      || `Explora os produtos de ${cleanText(store.name) || "esta loja"} e envia o pedido pelo WhatsApp.`,
    themeColor: cleanText(store.color) || brand.accent,
    appTitle: cleanText(store.name) || brand.name,
    canonicalUrl:
      buildStorefrontCatalogUrl(storeId, store, {
        origin,
        publicCatalogBaseUrl: cleanText(env.PUBLIC_CATALOG_BASE_URL || env.VITE_PUBLIC_CATALOG_BASE_URL),
        publicCatalogBaseDomain: cleanText(env.PUBLIC_CATALOG_BASE_DOMAIN || env.VITE_PUBLIC_CATALOG_BASE_DOMAIN),
        protocol: getRequestProtocol(request, env),
      }) || `${origin}/catalog/${encodeURIComponent(storeId)}`,
    imageUrl,
    robots: "index,follow",
  };
}

function buildTrackingMetadataFromPayload(payload, request, env = process.env) {
  const brand = getBrandConfig(env);
  const origin = getRequestOrigin(request, env);
  const order = payload?.order || {};
  const store = order?.store || {};

  return {
    title: `${cleanText(order.trackingCode) ? `Pedido ${order.trackingCode}` : "Acompanhar pedido"} | ${cleanText(store.name) || brand.name}`,
    description:
      cleanText(store.name)
      ? `Segue o estado mais recente do teu pedido na loja ${store.name}.`
      : "Consulta o estado mais recente da tua encomenda.",
    themeColor: cleanText(store.color) || brand.accent,
    appTitle: cleanText(store.name) || brand.name,
    canonicalUrl:
      buildStorefrontTrackingUrl(order.trackingToken, store, {
        origin,
        publicCatalogBaseUrl: cleanText(env.PUBLIC_CATALOG_BASE_URL || env.VITE_PUBLIC_CATALOG_BASE_URL),
        publicCatalogBaseDomain: cleanText(env.PUBLIC_CATALOG_BASE_DOMAIN || env.VITE_PUBLIC_CATALOG_BASE_DOMAIN),
        protocol: getRequestProtocol(request, env),
      }) || `${origin}${normalizePathname(request?.url || "/tracking")}`,
    imageUrl: toAbsoluteUrl(store.logo, origin) || toAbsoluteUrl(brand.logoUrl, origin),
    robots: "noindex,nofollow",
  };
}

async function buildSpaMetadata(pathname, request, runFunction, env = process.env) {
  const brand = getBrandConfig(env);
  const origin = getRequestOrigin(request, env);
  const normalizedPath = normalizePathname(pathname);
  const defaultMetadata = {
    title: brand.name,
    description: `${brand.tagline} Catalogo web para clientes e painel do lojista instalavel.`,
    themeColor: brand.accent,
    appTitle: brand.name,
    canonicalUrl: `${origin}${normalizedPath === "/" ? "/" : normalizedPath}`,
    imageUrl: toAbsoluteUrl(brand.logoUrl, origin),
    robots: normalizedPath === "/" ? "index,follow" : "noindex,nofollow",
  };

  const catalogMatch = normalizedPath.match(/^\/catalog\/([^/]+)$/);
  if (catalogMatch) {
    const storeId = safeDecodePathname(catalogMatch[1]);
    try {
      const { statusCode, payload } = await readJsonFunctionPayload(
        "catalog-get",
        `/api/catalog-get?id=${encodeURIComponent(storeId)}`,
        request,
        runFunction,
      );

      if (statusCode === 200) {
        return buildCatalogMetadataFromPayload(storeId, payload, request, env);
      }

      if (statusCode === 403) {
        const blockedStore = payload?.store || {};
        return {
          ...defaultMetadata,
          title: `${cleanText(blockedStore.name) || "Loja"} | Temporariamente indisponivel`,
          description: cleanText(payload?.error) || "Esta vitrine publica esta em pausa neste momento.",
          themeColor: cleanText(blockedStore.color) || brand.dark,
          appTitle: cleanText(blockedStore.name) || brand.name,
          imageUrl: toAbsoluteUrl(blockedStore.logo, origin) || defaultMetadata.imageUrl,
          robots: "noindex,nofollow",
        };
      }

      if (statusCode === 503) {
        return {
          ...defaultMetadata,
          title: `Catalogo em manutencao | ${brand.name}`,
          description: cleanText(payload?.error) || "O acesso publico aos catalogos foi pausado temporariamente.",
          themeColor: brand.dark,
          robots: "noindex,nofollow",
        };
      }

      return {
        ...defaultMetadata,
        title: `Catalogo nao encontrado | ${brand.name}`,
        description: cleanText(payload?.error) || "Esta loja nao existe ou deixou de estar disponivel.",
        robots: "noindex,nofollow",
      };
    } catch (error) {
      return {
        ...defaultMetadata,
        title: `Catalogo | ${brand.name}`,
        description: "Nao foi possivel preparar a metainformacao publica desta loja no servidor.",
        robots: "index,follow",
      };
    }
  }

  const trackingMatch = normalizedPath.match(/^\/tracking\/([^/]+)$/);
  if (trackingMatch) {
    const token = safeDecodePathname(trackingMatch[1]);
    try {
      const { statusCode, payload } = await readJsonFunctionPayload(
        "order-track",
        `/api/order-track?token=${encodeURIComponent(token)}`,
        request,
        runFunction,
      );

      if (statusCode === 200) {
        return buildTrackingMetadataFromPayload(payload, request, env);
      }

      return {
        ...defaultMetadata,
        title: `Tracking indisponivel | ${brand.name}`,
        description: cleanText(payload?.error) || "Nao foi possivel localizar este acompanhamento.",
        robots: "noindex,nofollow",
      };
    } catch (error) {
      return {
        ...defaultMetadata,
        title: `Tracking | ${brand.name}`,
        description: "Nao foi possivel preparar a metainformacao do acompanhamento.",
        robots: "noindex,nofollow",
      };
    }
  }

  if (normalizedPath === "/auth") {
    return {
      ...defaultMetadata,
      title: `Entrar no painel | ${brand.name}`,
      description: "Acesso do lojista ao painel, pedidos e gestao da loja.",
      robots: "noindex,nofollow",
    };
  }

  if (normalizedPath === "/app") {
    return {
      ...defaultMetadata,
      title: `Painel do lojista | ${brand.name}`,
      description: "Gestao mobile da loja, produtos, pedidos e partilha do catalogo.",
      robots: "noindex,nofollow",
    };
  }

  if (normalizedPath === "/superadmin") {
    return {
      ...defaultMetadata,
      title: `Super admin | ${brand.name}`,
      description: "Area protegida da plataforma.",
      robots: "noindex,nofollow",
    };
  }

  return defaultMetadata;
}

function normalizePathname(pathname = "") {
  const text = String(pathname || "").trim();
  if (!text || text === "/") return "/";
  return text.startsWith("/") ? text : `/${text}`;
}

function safeDecodePathname(pathname = "") {
  try {
    return decodeURIComponent(pathname);
  } catch (error) {
    return pathname;
  }
}

function isPathInside(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  return (
    relativePath === ""
    || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function hasKnownFileExtension(pathname = "") {
  return path.posix.basename(normalizePathname(pathname)).includes(".");
}

function getMimeType(filePath = "") {
  const extension = path.extname(String(filePath || "")).toLowerCase();
  return MIME_TYPES[extension] || "application/octet-stream";
}

function getCacheControl(filePath = "") {
  const baseName = path.basename(String(filePath || "")).toLowerCase();

  if (baseName === "index.html" || baseName === "sw.js" || baseName === "catalog-config.js") {
    return "no-cache";
  }

  if (IMMUTABLE_ASSET_PATTERN.test(baseName)) {
    return "public, max-age=31536000, immutable";
  }

  return "public, max-age=3600";
}

function parseAllowedCorsOrigins(env = process.env) {
  return new Set(
    String(env.CORS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function isSameHttpOrigin(origin, requestHost) {
  try {
    const parsedOrigin = new URL(String(origin || ""));
    if (!/^https?:$/i.test(parsedOrigin.protocol)) return false;
    const normalizedRequestHost = String(requestHost || "").trim();
    return (
      parsedOrigin.host === normalizedRequestHost
      || parsedOrigin.hostname === normalizedRequestHost.split(":")[0]
    );
  } catch (error) {
    return false;
  }
}

function buildCorsHeaders(request, env = process.env) {
  const origin = String(request.headers.origin || "").trim();
  if (!origin) return {};

  const allowedOrigins = parseAllowedCorsOrigins(env);
  const sameOrigin = isSameHttpOrigin(origin, request.headers.host);
  if (!sameOrigin && !allowedOrigins.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": DEFAULT_ALLOWED_METHODS,
    "Access-Control-Allow-Headers":
      String(request.headers["access-control-request-headers"] || "").trim()
      || DEFAULT_ALLOWED_HEADERS,
    Vary: "Origin",
  };
}

function writeResponse(response, result, extraHeaders = {}) {
  response.statusCode = result?.statusCode || 200;
  const headers = {
    ...(result?.headers || {}),
    ...extraHeaders,
  };

  for (const [key, value] of Object.entries(headers)) {
    response.setHeader(key, value);
  }

  response.end(result?.body || "");
}

async function readStaticFileResponse(filePath, method = "GET") {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) return null;

    const headers = {
      "Cache-Control": getCacheControl(filePath),
      "Content-Length": String(stats.size),
      "Content-Type": getMimeType(filePath),
      "X-Content-Type-Options": "nosniff",
    };

    if (path.basename(filePath).toLowerCase() === "sw.js") {
      headers["Service-Worker-Allowed"] = "/";
    }

    return {
      statusCode: 200,
      headers,
      body: method === "HEAD" ? "" : await fs.readFile(filePath),
    };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

function resolveStaticFilePath(distDir, pathname = "") {
  const normalizedPath = normalizePathname(safeDecodePathname(pathname));
  const relativePath = normalizedPath === "/" ? "index.html" : normalizedPath.replace(/^\/+/, "");
  const absolutePath = path.resolve(distDir, relativePath);
  if (!isPathInside(distDir, absolutePath)) return "";
  return absolutePath;
}

export function isApiRequestPath(pathname = "") {
  const normalizedPath = normalizePathname(pathname);
  return (
    normalizedPath === "/api"
    || normalizedPath.startsWith("/api/")
    || normalizedPath.startsWith("/.netlify/functions/")
  );
}

export function shouldServeSpaShell(pathname = "") {
  const normalizedPath = normalizePathname(pathname);
  if (normalizedPath === "/health" || normalizedPath === "/api/health") return false;
  if (isApiRequestPath(normalizedPath)) return false;
  return !hasKnownFileExtension(normalizedPath);
}

async function maybeResolveStorefrontRedirect(request, env = process.env, lookupStorefrontByHost = defaultLookupStorefrontByHost) {
  const normalizedPath = normalizePathname(new URL(request.url, "http://127.0.0.1").pathname);
  if (normalizedPath !== "/") return "";

  const requestHost = normalizeHostname(request?.headers?.host);
  if (!requestHost || isLikelyLocalHostname(requestHost)) return "";

  const appBaseHost = normalizeHostname(env.APP_BASE_URL);
  const publicBaseHost = normalizeHostname(env.VITE_PUBLIC_CATALOG_BASE_URL || env.PUBLIC_CATALOG_BASE_URL);
  const storefrontBaseDomain = cleanText(
    env.PUBLIC_CATALOG_BASE_DOMAIN || env.VITE_PUBLIC_CATALOG_BASE_DOMAIN,
  );
  const isStorefrontSubdomain = Boolean(getSubdomainSlugFromHostname(requestHost, storefrontBaseDomain));
  const matchesPlatformHost = requestHost === appBaseHost || requestHost === publicBaseHost;

  if (!isStorefrontSubdomain && matchesPlatformHost) {
    return "";
  }

  const storefrontMatch = await lookupStorefrontByHost(requestHost, env);
  const storeId = cleanText(storefrontMatch?.id);
  return storeId ? `/catalog/${encodeURIComponent(storeId)}` : "";
}

async function renderSpaShellResponse(pathname, method, distDir, request, runFunction, env = process.env) {
  try {
    const spaShellPath = path.resolve(distDir, "index.html");
    const stats = await fs.stat(spaShellPath);
    if (!stats.isFile()) return null;

    const metadata = await buildSpaMetadata(pathname, request, runFunction, env);
    const body =
      method === "HEAD"
        ? ""
        : injectManagedHead(await fs.readFile(spaShellPath, "utf8"), metadata);

    return {
      statusCode: 200,
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
      body,
    };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

async function serveStaticOrSpa(response, pathname, method, distDir, request, runFunction, env = process.env) {
  const directFilePath = resolveStaticFilePath(distDir, pathname);
  if (directFilePath) {
    const directFileResponse = await readStaticFileResponse(directFilePath, method);
    if (directFileResponse) {
      writeResponse(response, directFileResponse);
      return true;
    }
  }

  if (!shouldServeSpaShell(pathname)) {
    return false;
  }

  const spaShellResponse = await renderSpaShellResponse(
    pathname,
    method,
    distDir,
    request,
    runFunction,
    env,
  );
  if (spaShellResponse) {
    writeResponse(response, spaShellResponse);
    return true;
  }

  writeResponse(response, {
    statusCode: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: "Aplicacao web indisponivel. Corre `npm run build` antes de arrancar o servidor de producao.",
  });
  return true;
}

export function createAppRequestHandler(options = {}) {
  const {
    distDir = path.resolve("dist"),
    env = process.env,
    resolveFunctionName = resolveFunctionNameFromPath,
    runFunction = runFunctionByName,
    lookupStorefrontByHost = defaultLookupStorefrontByHost,
  } = options;

  return async (request, response) => {
    const method = String(request.method || "GET").toUpperCase();
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    const corsHeaders = buildCorsHeaders(request, env);

    if (url.pathname === "/health" || url.pathname === "/api/health") {
      writeResponse(
        response,
        {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true }),
        },
        corsHeaders,
      );
      return;
    }

    const functionName = resolveFunctionName(url.pathname);
    if (functionName) {
      if (method === "OPTIONS") {
        writeResponse(
          response,
          {
            statusCode: 204,
            headers: {},
            body: "",
          },
          corsHeaders,
        );
        return;
      }

      const bodyChunks = [];
      request.on("data", (chunk) => bodyChunks.push(chunk));
      request.on("end", async () => {
        try {
          const result = await runFunction(functionName, request, bodyChunks, {
            fresh: false,
          });
          writeResponse(response, result, corsHeaders);
        } catch (error) {
          writeResponse(
            response,
            {
              statusCode: 500,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ error: error.message || "Erro interno." }),
            },
            corsHeaders,
          );
        }
      });
      return;
    }

    if (isApiRequestPath(url.pathname)) {
      if (method === "OPTIONS") {
        writeResponse(
          response,
          {
            statusCode: 204,
            headers: {},
            body: "",
          },
          corsHeaders,
        );
        return;
      }

      writeResponse(
        response,
        {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Endpoint nao encontrado." }),
        },
        corsHeaders,
      );
      return;
    }

    if (!["GET", "HEAD"].includes(method)) {
      writeResponse(response, {
        statusCode: 405,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "Metodo nao suportado para este recurso.",
      });
      return;
    }

    const storefrontRedirectPath = await maybeResolveStorefrontRedirect(
      request,
      env,
      lookupStorefrontByHost,
    );
    if (storefrontRedirectPath) {
      writeResponse(response, {
        statusCode: 302,
        headers: {
          Location: storefrontRedirectPath,
          "Cache-Control": "no-cache",
        },
        body: "",
      });
      return;
    }

    const handled = await serveStaticOrSpa(response, url.pathname, method, distDir, request, runFunction, env);
    if (handled) return;

    writeResponse(response, {
      statusCode: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "Recurso nao encontrado.",
    });
  };
}

export function createAppServer(options = {}) {
  return http.createServer(createAppRequestHandler(options));
}
