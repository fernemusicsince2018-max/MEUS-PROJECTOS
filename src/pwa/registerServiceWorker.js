const RAW_BASE_URL =
  typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
    ? String(import.meta.env.BASE_URL)
    : "/";

const SW_PATH = `${RAW_BASE_URL.endsWith("/") ? RAW_BASE_URL : `${RAW_BASE_URL}/`}sw.js`;

function canUseServiceWorker() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  const protocol = String(window.location.protocol || "").toLowerCase();
  const hostname = String(window.location.hostname || "").toLowerCase();
  return protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1";
}

export function registerServiceWorker() {
  if (!canUseServiceWorker()) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_PATH).catch((error) => {
      console.error("Nao foi possivel registar o service worker.", error);
    });
  });
}
