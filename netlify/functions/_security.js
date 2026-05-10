import { createHash, randomInt } from "node:crypto";

const PASSWORD_MIN_LENGTH = 10;
const ASSET_URL_MAX_LENGTH = 2048;
const STORE_LOGO_DATA_URL_MAX_LENGTH = 400000;
const STORE_LOGO_DATA_URL_RE = /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i;
const PRODUCT_IMAGE_DATA_URL_MAX_LENGTH = 700000;
const PRODUCT_IMAGE_DATA_URL_RE = /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i;

const RATE_LIMITS = {
  login: { maxAttempts: 5, windowMinutes: 15, blockMinutes: 15 },
  register: { maxAttempts: 4, windowMinutes: 30, blockMinutes: 30 },
  registrationApproval: { maxAttempts: 5, windowMinutes: 60, blockMinutes: 60 },
  passwordResetRequest: { maxAttempts: 3, windowMinutes: 30, blockMinutes: 30 },
  passwordResetConfirm: { maxAttempts: 5, windowMinutes: 30, blockMinutes: 30 },
};

function areRateLimitsDisabled() {
  return String(process.env.CATALOG_DISABLE_RATE_LIMITS || "").trim().toLowerCase() === "true";
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function hashValue(value = "") {
  return createHash("sha256").update(String(value)).digest("hex");
}

function getHeader(event, name) {
  const headers = event?.headers || {};
  const headerName = String(name).toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === headerName) {
      return value;
    }
  }

  return "";
}

function getRequestIp(event) {
  const forwarded = getHeader(event, "x-nf-client-connection-ip") || getHeader(event, "x-forwarded-for") || getHeader(event, "x-real-ip") || getHeader(event, "client-ip");
  const firstIp = String(forwarded || "")
    .split(",")
    .map((chunk) => chunk.trim())
    .find(Boolean);

  return (firstIp || "unknown").slice(0, 120);
}

function getRateLimitKey(scope, rawValue) {
  const normalized = scope === "email" ? normalizeEmail(rawValue) : String(rawValue || "").trim();
  return `${scope}:${hashValue(normalized)}`;
}

function parseTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function getRetryAfterSeconds(blockedUntil) {
  const blockedDate = parseTimestamp(blockedUntil);
  if (!blockedDate) return 0;
  return Math.max(1, Math.ceil((blockedDate.getTime() - Date.now()) / 1000));
}

async function getRateLimitState(queryable, action, scopeKey) {
  const result = await queryable.query(
    `select attempt_count, window_started_at, blocked_until
     from catalog_auth_rate_limits
     where action = $1
       and scope_key = $2
     limit 1`,
    [action, scopeKey],
  );

  return result.rows[0] || null;
}

async function getActiveRateLimit(queryable, action, scope, rawValue) {
  if (areRateLimitsDisabled()) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }

  const state = await getRateLimitState(queryable, action, getRateLimitKey(scope, rawValue));
  const retryAfterSeconds = getRetryAfterSeconds(state?.blocked_until);

  return {
    blocked: retryAfterSeconds > 0,
    retryAfterSeconds,
  };
}

async function recordRateLimitAttempt(queryable, action, scope, rawValue) {
  if (areRateLimitsDisabled()) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const policy = RATE_LIMITS[action];
  if (!policy) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const scopeKey = getRateLimitKey(scope, rawValue);
  const now = new Date();
  const state = await getRateLimitState(queryable, action, scopeKey);

  if (!state) {
    const blockedUntil = policy.maxAttempts <= 1 ? new Date(now.getTime() + policy.blockMinutes * 60_000) : null;
    await queryable.query(
      `insert into catalog_auth_rate_limits (
         action, scope_key, attempt_count, window_started_at, blocked_until
       ) values ($1, $2, $3, $4, $5)
       on conflict (action, scope_key) do update set
         attempt_count = excluded.attempt_count,
         window_started_at = excluded.window_started_at,
         blocked_until = excluded.blocked_until`,
      [action, scopeKey, 1, now.toISOString(), blockedUntil?.toISOString() || null],
    );

    return {
      blocked: Boolean(blockedUntil),
      retryAfterSeconds: getRetryAfterSeconds(blockedUntil),
    };
  }

  const windowStartedAt = parseTimestamp(state.window_started_at) || now;
  const blockedUntil = parseTimestamp(state.blocked_until);

  if (blockedUntil && blockedUntil.getTime() > now.getTime()) {
    return {
      blocked: true,
      retryAfterSeconds: getRetryAfterSeconds(blockedUntil),
    };
  }

  const windowExpired = now.getTime() - windowStartedAt.getTime() >= policy.windowMinutes * 60_000;
  const nextAttemptCount = windowExpired ? 1 : Number(state.attempt_count || 0) + 1;
  const nextWindowStartedAt = windowExpired ? now : windowStartedAt;
  const nextBlockedUntil =
    nextAttemptCount >= policy.maxAttempts ? new Date(now.getTime() + policy.blockMinutes * 60_000) : null;

  await queryable.query(
    `update catalog_auth_rate_limits
     set attempt_count = $3,
         window_started_at = $4,
         blocked_until = $5
     where action = $1
       and scope_key = $2`,
    [
      action,
      scopeKey,
      nextAttemptCount,
      nextWindowStartedAt.toISOString(),
      nextBlockedUntil?.toISOString() || null,
    ],
  );

  return {
    blocked: Boolean(nextBlockedUntil),
    retryAfterSeconds: getRetryAfterSeconds(nextBlockedUntil),
  };
}

async function clearRateLimit(queryable, action, scope, rawValue) {
  await queryable.query(
    `delete from catalog_auth_rate_limits
     where action = $1
       and scope_key = $2`,
    [action, getRateLimitKey(scope, rawValue)],
  );
}

function formatRateLimitMessage(retryAfterSeconds) {
  const waitMinutes = Math.max(1, Math.ceil(Number(retryAfterSeconds || 0) / 60));
  return `Muitas tentativas. Tenta novamente em ${waitMinutes} minuto${waitMinutes > 1 ? "s" : ""}.`;
}

function validatePasswordStrength(password = "") {
  const value = String(password || "");

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `A palavra-passe deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (!/[a-z]/.test(value)) {
    return "A palavra-passe deve incluir pelo menos uma letra minuscula.";
  }

  if (!/[A-Z]/.test(value)) {
    return "A palavra-passe deve incluir pelo menos uma letra maiuscula.";
  }

  if (!/\d/.test(value)) {
    return "A palavra-passe deve incluir pelo menos um numero.";
  }

  return "";
}

function createPasswordResetCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function isPublicAssetUrl(value = "") {
  return /^(https?:\/\/|\/)/i.test(String(value).trim());
}

function normalizeAssetUrl(value, fieldLabel) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { value: "" };
  }

  if (text.length > ASSET_URL_MAX_LENGTH) {
    return { error: `${fieldLabel} deve ter no maximo ${ASSET_URL_MAX_LENGTH} caracteres.` };
  }

  if (/^data:/i.test(text)) {
    return { error: `${fieldLabel} deve usar uma URL publica e nao imagem embutida em base64.` };
  }

  if (!isPublicAssetUrl(text)) {
    return { error: `${fieldLabel} deve usar uma URL publica (https://...) ou um caminho local (/ficheiro).` };
  }

  return { value: text };
}

function normalizeStoreLogo(value, fieldLabel = "O logo da loja") {
  const text = String(value ?? "").trim();

  if (!text) {
    return { value: "" };
  }

  if (STORE_LOGO_DATA_URL_RE.test(text)) {
    if (text.length > STORE_LOGO_DATA_URL_MAX_LENGTH) {
      return { error: `${fieldLabel} ficou grande demais. Usa uma imagem menor.` };
    }

    return { value: text };
  }

  if (/^data:/i.test(text)) {
    return { error: `${fieldLabel} precisa de ser uma imagem valida em PNG, JPG, WebP, GIF ou SVG.` };
  }

  return normalizeAssetUrl(text, fieldLabel);
}

function normalizeProductAsset(value, fieldLabel = "A imagem do produto") {
  const text = String(value ?? "").trim();

  if (!text) {
    return { value: "" };
  }

  if (PRODUCT_IMAGE_DATA_URL_RE.test(text)) {
    if (text.length > PRODUCT_IMAGE_DATA_URL_MAX_LENGTH) {
      return { error: `${fieldLabel} ficou grande demais. Usa uma imagem menor.` };
    }

    return { value: text };
  }

  if (/^data:/i.test(text)) {
    return { error: `${fieldLabel} precisa de ser uma imagem valida em PNG, JPG, WebP, GIF ou SVG.` };
  }

  return normalizeAssetUrl(text, fieldLabel);
}

function normalizeProductImageCollection(value, fieldLabel = "O produto") {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = [];

  for (const [index, entry] of items.entries()) {
    const result = normalizeProductAsset(entry, `${fieldLabel} - imagem ${index + 1}`);
    if (result.error) {
      return { error: result.error };
    }

    if (result.value && !normalized.includes(result.value)) {
      normalized.push(result.value);
    }
  }

  if (normalized.length > 4) {
    return { error: `${fieldLabel} aceita no maximo 4 fotos.` };
  }

  return { value: normalized };
}

function shouldExposeResetCode() {
  const explicitFlag = String(process.env.CATALOG_EXPOSE_RESET_CODE || "").trim().toLowerCase();
  if (explicitFlag === "true") {
    return true;
  }

  if (String(process.env.LOCAL_FUNCTIONS_PORT || "").trim()) {
    return true;
  }

  const netlifyLocal = String(process.env.NETLIFY_LOCAL || "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(netlifyLocal)) {
    return true;
  }

  const context = String(process.env.CONTEXT || "").trim().toLowerCase();
  if (["production", "deploy-preview", "branch-deploy"].includes(context)) {
    return false;
  }

  const appBaseUrl = String(process.env.APP_BASE_URL || "").trim().toLowerCase();
  if (
    appBaseUrl.startsWith("http://localhost")
    || appBaseUrl.startsWith("http://127.0.0.1")
    || appBaseUrl.startsWith("https://localhost")
    || appBaseUrl.startsWith("https://127.0.0.1")
  ) {
    return true;
  }

  const nodeEnv = String(process.env.NODE_ENV || "").trim().toLowerCase();
  return nodeEnv && nodeEnv !== "production";
}

export {
  PASSWORD_MIN_LENGTH,
  RATE_LIMITS,
  clearRateLimit,
  createPasswordResetCode,
  formatRateLimitMessage,
  getActiveRateLimit,
  getRequestIp,
  hashValue,
  normalizeAssetUrl,
  normalizeProductAsset,
  normalizeProductImageCollection,
  normalizeStoreLogo,
  normalizeEmail,
  recordRateLimitAttempt,
  shouldExposeResetCode,
  validatePasswordStrength,
};
