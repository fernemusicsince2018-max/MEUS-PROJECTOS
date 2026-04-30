export function isNavigatorOnline() {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
    return true;
  }

  return navigator.onLine;
}

export function isLikelyOfflineError(error) {
  if (!error) return !isNavigatorOnline();
  if (error.status) return false;
  if (!isNavigatorOnline()) return true;

  const name = String(error.name || "").toLowerCase();
  const message = String(error.message || "").toLowerCase();

  return (
    name === "typeerror"
    || message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("network request failed")
    || message.includes("load failed")
  );
}

export function formatSyncTimestamp(value, locale = "pt-PT") {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const deltaMs = Math.abs(Date.now() - date.getTime());
  if (deltaMs < 60 * 1000) return "agora mesmo";

  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
