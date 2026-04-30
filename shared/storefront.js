const RESERVED_STOREFRONT_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "catalog",
  "catalogo",
  "favicon",
  "static",
  "superadmin",
  "sw",
  "tracking",
  "www",
]);

function cleanText(value) {
  return String(value || "").trim();
}

function stripDiacritics(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeStorefrontSlug(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function validateStorefrontSlug(value, label = "O subdominio publico") {
  const rawValue = cleanText(value);
  if (!rawValue) {
    return { normalized: "" };
  }

  const normalized = normalizeStorefrontSlug(rawValue);
  if (!normalized) {
    return { error: `${label} so pode usar letras, numeros e hifens.` };
  }

  if (normalized.length < 3) {
    return { error: `${label} precisa de pelo menos 3 caracteres.` };
  }

  if (normalized.startsWith("-") || normalized.endsWith("-")) {
    return { error: `${label} nao pode comecar ou terminar com hifen.` };
  }

  if (RESERVED_STOREFRONT_SLUGS.has(normalized)) {
    return { error: `${label} usa uma palavra reservada da plataforma. Escolhe outro.` };
  }

  return { normalized };
}

export function normalizeHostname(value) {
  const rawValue = cleanText(value)
    .replace(/\.+$/, "")
    .toLowerCase();
  if (!rawValue) return "";

  const candidate = rawValue.includes("://") ? rawValue : `https://${rawValue}`;

  try {
    const url = new URL(candidate);
    return cleanText(url.hostname).toLowerCase();
  } catch (error) {
    return rawValue
      .split("/")[0]
      .split("?")[0]
      .split("#")[0]
      .split(":")[0]
      .trim()
      .toLowerCase();
  }
}

export function validateCustomDomain(value, label = "O dominio publico") {
  const normalized = normalizeHostname(value);
  if (!normalized) {
    return { normalized: "" };
  }

  if (normalized === "localhost" || normalized.endsWith(".local")) {
    return { error: `${label} precisa de um host publico real.` };
  }

  if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(normalized)) {
    return { error: `${label} nao parece valido. Usa algo como loja.exemplo.com.` };
  }

  return { normalized };
}

export function normalizeBaseDomain(value) {
  return normalizeHostname(value);
}

export function getStorefrontHost(store = {}, options = {}) {
  const customDomain = normalizeHostname(store.customDomain);
  if (customDomain) return customDomain;

  const publicSlug = normalizeStorefrontSlug(store.publicSlug);
  const baseDomain = normalizeBaseDomain(options.publicCatalogBaseDomain);
  if (!publicSlug || !baseDomain) return "";

  return `${publicSlug}.${baseDomain}`;
}

export function buildOriginFromHost(hostname, protocol = "https") {
  const safeHost = normalizeHostname(hostname);
  if (!safeHost) return "";

  const safeProtocol = cleanText(protocol).replace(/:$/, "").toLowerCase() || "https";
  return `${safeProtocol}://${safeHost}`;
}

function normalizeBaseUrl(value) {
  const rawValue = cleanText(value);
  if (!rawValue) return "";

  try {
    const url = new URL(rawValue);
    url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString().replace(/\/$/, "");
  } catch (error) {
    return "";
  }
}

export function buildStorefrontCatalogUrl(storeId, store = {}, options = {}) {
  const safeStoreId = encodeURIComponent(cleanText(storeId));
  if (!safeStoreId) return "";

  const storefrontHost = getStorefrontHost(store, options);
  if (storefrontHost) {
    return `${buildOriginFromHost(storefrontHost, options.protocol || "https")}/catalog/${safeStoreId}`;
  }

  const baseUrl = normalizeBaseUrl(options.publicCatalogBaseUrl || options.origin || "");
  if (!baseUrl) return "";

  return `${baseUrl}/catalog/${safeStoreId}`;
}

export function buildStorefrontTrackingUrl(token, store = {}, options = {}) {
  const safeToken = encodeURIComponent(cleanText(token));
  if (!safeToken) return "";

  const storefrontHost = getStorefrontHost(store, options);
  if (storefrontHost) {
    return `${buildOriginFromHost(storefrontHost, options.protocol || "https")}/tracking/${safeToken}`;
  }

  const baseUrl = normalizeBaseUrl(options.publicCatalogBaseUrl || options.origin || "");
  if (!baseUrl) return "";

  return `${baseUrl}/tracking/${safeToken}`;
}

export function getSubdomainSlugFromHostname(hostname, baseDomain) {
  const safeHost = normalizeHostname(hostname);
  const safeBaseDomain = normalizeBaseDomain(baseDomain);
  if (!safeHost || !safeBaseDomain || safeHost === safeBaseDomain) return "";
  if (!safeHost.endsWith(`.${safeBaseDomain}`)) return "";

  const slug = safeHost.slice(0, -(`.${safeBaseDomain}`.length));
  return normalizeStorefrontSlug(slug);
}
