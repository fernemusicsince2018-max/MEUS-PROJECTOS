function normalizeText(value) {
  return String(value || "").trim();
}

function parseBooleanFlag(value, fallback = false) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on", "sim"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "nao", "não"].includes(normalized)) return false;
  return fallback;
}

export function isLocalHostname(hostname = "") {
  const normalized = normalizeText(hostname).toLowerCase();
  if (!normalized) return true;

  return (
    normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "[::1]"
    || normalized.endsWith(".local")
  );
}

export function getRuntimePolicy({
  apiBaseUrl = "",
  hostname = "",
  mode = "",
  allowLocalFallbackFlag = "",
  isNativeApp = false,
  requiresAbsoluteApiBaseUrl = false,
} = {}) {
  const normalizedMode = normalizeText(mode).toLowerCase();
  const localHost = isLocalHostname(hostname);
  const explicitAllowLocalFallback = parseBooleanFlag(allowLocalFallbackFlag, false);
  const isDevLike =
    ["development", "dev", "test"].includes(normalizedMode)
    || (localHost && !isNativeApp);
  const allowLocalFallback = explicitAllowLocalFallback || isDevLike;
  const hasApiBaseUrl = Boolean(normalizeText(apiBaseUrl));
  const requireRemoteApi = !allowLocalFallback;
  const apiRequiredMessage = hasApiBaseUrl
    ? ""
    : requiresAbsoluteApiBaseUrl
      ? "Esta app movel precisa de uma URL absoluta da API. Define VITE_NATIVE_CATALOG_API_BASE ou nativeApiBaseUrl antes de publicar."
      : "Esta aplicacao precisa da API configurada para gravar dados com seguranca. Define VITE_CATALOG_API_BASE antes de publicar.";

  return {
    localHost,
    isDevLike,
    allowLocalFallback,
    requireRemoteApi,
    hasApiBaseUrl,
    isNativeApp: Boolean(isNativeApp),
    requiresAbsoluteApiBaseUrl: Boolean(requiresAbsoluteApiBaseUrl),
    apiRequiredMessage,
  };
}
