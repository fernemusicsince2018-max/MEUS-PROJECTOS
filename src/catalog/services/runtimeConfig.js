import { Capacitor } from "@capacitor/core";
import { getRuntimePolicy } from "../utils/runtimePolicy.js";

function readEnv(name) {
  try {
    return import.meta.env?.[name] || "";
  } catch (error) {
    return "";
  }
}

function cleanText(value) {
  return String(value || "").trim();
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(cleanText(value));
}

function isNativeRuntime() {
  try {
    return Boolean(Capacitor?.isNativePlatform?.());
  } catch (error) {
    return false;
  }
}

function getApiOrigin(value) {
  if (!isAbsoluteHttpUrl(value) || typeof window === "undefined") return "";

  try {
    return new URL(value).origin;
  } catch (error) {
    return "";
  }
}

export function getRuntimeConfig() {
  const globalConfig = typeof window !== "undefined" ? window.__CATALOG_CONFIG__ || {} : {};
  const isNativeApp = isNativeRuntime();
  const sharedApiBaseUrl = cleanText(globalConfig.apiBaseUrl || readEnv("VITE_CATALOG_API_BASE"));
  const nativeApiBaseUrl = cleanText(
    globalConfig.nativeApiBaseUrl || readEnv("VITE_NATIVE_CATALOG_API_BASE"),
  );
  const preferredApiBaseUrl = cleanText(
    isNativeApp ? (nativeApiBaseUrl || sharedApiBaseUrl) : sharedApiBaseUrl,
  );
  const requiresAbsoluteApiBaseUrl = isNativeApp;
  const apiBaseUrl =
    requiresAbsoluteApiBaseUrl && preferredApiBaseUrl && !isAbsoluteHttpUrl(preferredApiBaseUrl)
      ? ""
      : preferredApiBaseUrl;
  const policy = getRuntimePolicy({
    apiBaseUrl,
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
    mode: readEnv("MODE"),
    allowLocalFallbackFlag: globalConfig.allowLocalFallback ?? readEnv("VITE_ALLOW_LOCAL_FALLBACK"),
    isNativeApp,
    requiresAbsoluteApiBaseUrl,
  });
  const apiOrigin = getApiOrigin(apiBaseUrl);
  const requestCredentials =
    apiOrigin && typeof window !== "undefined" && apiOrigin !== window.location.origin
      ? "include"
      : "same-origin";
  const publicCatalogBaseUrl = cleanText(
    globalConfig.publicCatalogBaseUrl || readEnv("VITE_PUBLIC_CATALOG_BASE_URL"),
  );
  const publicCatalogBaseDomain = cleanText(
    globalConfig.publicCatalogBaseDomain || readEnv("VITE_PUBLIC_CATALOG_BASE_DOMAIN"),
  );

  return {
    apiBaseUrl,
    nativeApiBaseUrl,
    publicCatalogBaseUrl,
    publicCatalogBaseDomain,
    isNativeApp,
    requestCredentials,
    allowLocalFallback: policy.allowLocalFallback,
    requireRemoteApi: policy.requireRemoteApi,
    apiRequiredMessage: policy.apiRequiredMessage,
    runtimePolicy: policy,
    brand: {
      name: globalConfig.brandName || readEnv("VITE_BRAND_NAME") || "KastroZap",
      tagline:
        globalConfig.brandTagline ||
        readEnv("VITE_BRAND_TAGLINE") ||
        "Vende mais no WhatsApp.",
      accent: globalConfig.brandAccent || readEnv("VITE_BRAND_ACCENT") || "#25ae82",
      dark: globalConfig.brandDark || readEnv("VITE_BRAND_DARK") || "#1b1c48",
      highlight: globalConfig.brandHighlight || readEnv("VITE_BRAND_HIGHLIGHT") || "#ffc61a",
      logoUrl: globalConfig.brandLogoUrl || readEnv("VITE_BRAND_LOGO_URL") || "/pwa-icon.svg",
      initials: globalConfig.brandInitials || readEnv("VITE_BRAND_INITIALS") || "KZ",
    },
  };
}
