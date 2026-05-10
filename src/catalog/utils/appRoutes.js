const RAW_BASE_URL =
  typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
    ? String(import.meta.env.BASE_URL)
    : "/";

const APP_BASE_PATH =
  RAW_BASE_URL && RAW_BASE_URL !== "/" ? RAW_BASE_URL.replace(/\/$/, "") : "";
const MERCHANT_APP_PATH = "/painel";

function normalizePathname(pathname) {
  const text = String(pathname || "/").trim();
  if (!text || text === "/") return "/";
  return text.endsWith("/") ? text.slice(0, -1) || "/" : text;
}

function stripBasePath(pathname) {
  const normalizedPath = normalizePathname(pathname);
  if (!APP_BASE_PATH) return normalizedPath;
  if (normalizedPath === APP_BASE_PATH) return "/";
  if (normalizedPath.startsWith(`${APP_BASE_PATH}/`)) {
    return normalizedPath.slice(APP_BASE_PATH.length) || "/";
  }
  return normalizedPath;
}

function applyBasePath(pathname) {
  const normalizedPath = normalizePathname(pathname);
  if (!APP_BASE_PATH) return normalizedPath;
  if (normalizedPath === "/") return `${APP_BASE_PATH}/`;
  return `${APP_BASE_PATH}${normalizedPath}`;
}

function safeDecode(segment) {
  try {
    return decodeURIComponent(String(segment || ""));
  } catch (error) {
    return String(segment || "");
  }
}

function buildQueryString(params) {
  const searchParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null || value === "" || value === false) return;
    searchParams.set(key, String(value));
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

export function buildRootPath() {
  return applyBasePath("/");
}

export function buildAuthPath() {
  return applyBasePath("/auth");
}

export function buildMerchantAppPath() {
  return applyBasePath(MERCHANT_APP_PATH);
}

export function buildSuperAdminPath() {
  return applyBasePath("/superadmin");
}

export function buildPublicCatalogPath(storeId, options = {}) {
  const safeStoreId = encodeURIComponent(String(storeId || "").trim());
  const query = buildQueryString({
    preview: options.preview ? "1" : "",
  });
  return applyBasePath(`/catalog/${safeStoreId}`) + query;
}

export function buildTrackingPath(token) {
  const safeToken = encodeURIComponent(String(token || "").trim());
  return applyBasePath(`/tracking/${safeToken}`);
}

export function buildAbsoluteAppUrl(pathname) {
  if (typeof window === "undefined") return String(pathname || "");
  return new URL(String(pathname || ""), window.location.origin).toString();
}

export function updateBrowserLocation(pathname, options = {}) {
  if (typeof window === "undefined") return;

  const nextPath = String(pathname || "").trim() || buildRootPath();
  const currentPath = `${window.location.pathname}${window.location.search}`;

  if (currentPath === nextPath && !window.location.hash) return;

  const method = options.replace ? "replaceState" : "pushState";
  window.history[method]({}, "", nextPath);
}

export function readAppRoute(locationObject = typeof window !== "undefined" ? window.location : null) {
  const pathname = normalizePathname(locationObject?.pathname || "/");
  const normalizedPath = stripBasePath(pathname);
  const search = String(locationObject?.search || "");
  const searchParams = new URLSearchParams(search);

  if (normalizedPath === "/" || normalizedPath === "") {
    return { kind: "home", canonicalPath: buildRootPath() };
  }

  if (normalizedPath === "/auth") {
    return { kind: "auth", canonicalPath: buildAuthPath() };
  }

  if (normalizedPath === MERCHANT_APP_PATH) {
    return { kind: "merchantApp", canonicalPath: buildMerchantAppPath() };
  }

  if (normalizedPath === "/superadmin") {
    return { kind: "superadmin", canonicalPath: buildSuperAdminPath() };
  }

  const trackingMatch = normalizedPath.match(/^\/tracking\/([^/]+)$/);
  if (trackingMatch) {
    const token = safeDecode(trackingMatch[1]);
    return {
      kind: "tracking",
      token,
      canonicalPath: buildTrackingPath(token),
    };
  }

  const catalogMatch = normalizedPath.match(/^\/catalog\/([^/]+)$/);
  if (catalogMatch) {
    const storeId = safeDecode(catalogMatch[1]);
    const preview = searchParams.get("preview") === "1";
    return {
      kind: "publicCatalog",
      storeId,
      preview,
      canonicalPath: buildPublicCatalogPath(storeId, { preview }),
    };
  }

  return {
    kind: "notFound",
    canonicalPath: applyBasePath(normalizedPath),
  };
}
