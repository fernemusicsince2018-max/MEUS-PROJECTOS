import { randomUUID } from "node:crypto";

const DATA_URL_RE = /^data:([a-z0-9.+/-]+);base64,(.+)$/i;
const PUBLIC_URL_RE = /^(https?:\/\/|\/)/i;
const MIME_EXTENSION_MAP = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const PUBLIC_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function cleanText(value, maxLength = null) {
  const text = String(value || "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function getStorageBaseConfig() {
  const url = cleanText(process.env.SUPABASE_URL).replace(/\/$/, "");
  const serviceRoleKey = cleanText(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return {
    enabled: Boolean(url && serviceRoleKey),
    url,
    serviceRoleKey,
  };
}

function getPublicMediaStorageConfig() {
  const baseConfig = getStorageBaseConfig();
  return {
    ...baseConfig,
    bucket: cleanText(process.env.SUPABASE_STORAGE_BUCKET, 120) || "catalog-assets",
    isPublic: true,
  };
}

function getPrivateMediaStorageConfig() {
  const baseConfig = getStorageBaseConfig();
  return {
    ...baseConfig,
    bucket: cleanText(process.env.SUPABASE_PRIVATE_STORAGE_BUCKET, 120) || "catalog-private",
    isPublic: false,
  };
}

async function storageRequest(config, path, init = {}) {
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      ...(init.headers || {}),
    },
  });

  return response;
}

async function ensureBucketReady(config) {
  const bucketPath = `/storage/v1/bucket/${encodeURIComponent(config.bucket)}`;
  const existingResponse = await storageRequest(config, bucketPath, {
    method: "GET",
  });

  if (existingResponse.ok) {
    return;
  }

  if (existingResponse.status !== 404) {
    const payload = await existingResponse.text().catch(() => "");
    throw new Error(payload || "Nao foi possivel validar o espaco de imagens.");
  }

  const createResponse = await storageRequest(config, "/storage/v1/bucket", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: config.bucket,
      name: config.bucket,
      public: Boolean(config.isPublic),
    }),
  });

  if (!createResponse.ok && createResponse.status !== 409) {
    const payload = await createResponse.text().catch(() => "");
    throw new Error(payload || "Nao foi possivel preparar o espaco de imagens.");
  }
}

function decodeDataUrl(value, options = {}) {
  const match = String(value || "").match(DATA_URL_RE);
  if (!match) {
    const error = new Error(options.invalidFormatMessage || "O ficheiro precisa de estar num formato valido.");
    error.status = 400;
    throw error;
  }

  const mimeType = cleanText(match[1]).toLowerCase();
  const extension = MIME_EXTENSION_MAP[mimeType];
  const allowedMimeTypes = options.allowedMimeTypes instanceof Set
    ? options.allowedMimeTypes
    : new Set(options.allowedMimeTypes || []);

  if (!extension || (allowedMimeTypes.size > 0 && !allowedMimeTypes.has(mimeType))) {
    const error = new Error(options.invalidMimeTypeMessage || "O formato do ficheiro nao e suportado.");
    error.status = 400;
    throw error;
  }

  const buffer = Buffer.from(match[2], "base64");
  const maxBytes = Number(options.maxBytes || 0);
  if (maxBytes > 0 && buffer.length > maxBytes) {
    const error = new Error(options.maxBytesMessage || "O ficheiro ficou grande demais.");
    error.status = 400;
    throw error;
  }

  return {
    mimeType,
    extension,
    buffer,
  };
}

function isPublicAssetUrl(value) {
  return PUBLIC_URL_RE.test(String(value || "").trim());
}

function sanitizeFileName(value) {
  const normalized = cleanText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "asset";
}

function buildObjectPath({ scope, ownerId, fileName, extension }) {
  const safeScope = sanitizeFileName(scope);
  const safeOwnerId = sanitizeFileName(ownerId);
  const safeFileName = sanitizeFileName(fileName).replace(/\.[a-z0-9]+$/i, "");
  return `${safeScope}/${safeOwnerId}/${Date.now()}-${randomUUID()}-${safeFileName}.${extension}`;
}

function encodeObjectPath(objectPath) {
  return objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildPublicObjectUrl(config, objectPath) {
  return `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${encodeObjectPath(objectPath)}`;
}

function normalizeSignedStorageUrl(baseUrl, signedPath) {
  const normalizedPath = cleanText(signedPath);
  if (!normalizedPath) return "";

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("/storage/v1/")) {
    return `${baseUrl}${normalizedPath}`;
  }

  if (normalizedPath.startsWith("/object/")) {
    return `${baseUrl}/storage/v1${normalizedPath}`;
  }

  return `${baseUrl}/storage/v1/${normalizedPath.replace(/^\/+/, "")}`;
}

async function uploadStorageObject({
  config,
  dataUrl,
  scope,
  ownerId,
  fileName,
  allowedMimeTypes,
  maxBytes,
  invalidFormatMessage,
  invalidMimeTypeMessage,
  maxBytesMessage,
}) {
  if (!config.enabled) {
    const error = new Error("O servico de imagens ainda nao esta configurado. Define SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    error.status = 503;
    throw error;
  }

  await ensureBucketReady(config);

  const binary = decodeDataUrl(dataUrl, {
    allowedMimeTypes,
    maxBytes,
    invalidFormatMessage,
    invalidMimeTypeMessage,
    maxBytesMessage,
  });

  const objectPath = buildObjectPath({
    scope,
    ownerId,
    fileName,
    extension: binary.extension,
  });

  const uploadResponse = await storageRequest(
    config,
    `/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodeObjectPath(objectPath)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": binary.mimeType,
        "x-upsert": "true",
      },
      body: binary.buffer,
    },
  );

  if (!uploadResponse.ok) {
    const payload = await uploadResponse.text().catch(() => "");
    const parsed = parseJsonSafely(payload);
    throw new Error(parsed?.message || parsed?.error || payload || "Nao foi possivel guardar o ficheiro no servico de imagens.");
  }

  return {
    bucket: config.bucket,
    objectPath,
    mimeType: binary.mimeType,
    sizeBytes: binary.buffer.length,
    publicUrl: config.isPublic ? buildPublicObjectUrl(config, objectPath) : "",
  };
}

export async function createSignedStorageUrl({ bucket, objectPath, expiresInSeconds = 900 }) {
  const config = getStorageBaseConfig();
  if (!config.enabled) {
    const error = new Error("A area privada de ficheiros ainda nao esta configurada.");
    error.status = 503;
    throw error;
  }

  const safeBucket = cleanText(bucket, 120);
  const safeObjectPath = cleanText(objectPath);
  if (!safeBucket || !safeObjectPath) {
    return "";
  }

  const response = await storageRequest(
    config,
    `/storage/v1/object/sign/${encodeURIComponent(safeBucket)}/${encodeObjectPath(safeObjectPath)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expiresIn: Math.max(60, Number(expiresInSeconds || 0) || 900),
      }),
    },
  );

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    const parsed = parseJsonSafely(payload);
    throw new Error(parsed?.message || parsed?.error || payload || "Nao foi possivel preparar o acesso temporario ao ficheiro.");
  }

  const payload = await response.json().catch(() => ({}));
  return normalizeSignedStorageUrl(config.url, payload?.signedURL || payload?.signedUrl || payload?.url || "");
}

export async function uploadPublicImageAsset({ dataUrl, scope, ownerId, fileName }) {
  return uploadStorageObject({
    config: getPublicMediaStorageConfig(),
    dataUrl,
    scope,
    ownerId,
    fileName,
    allowedMimeTypes: PUBLIC_IMAGE_MIME_TYPES,
    maxBytes: 4 * 1024 * 1024,
    invalidFormatMessage: "A imagem precisa de estar num formato PNG, JPG ou WebP valido.",
    invalidMimeTypeMessage: "O sistema aceita imagens em PNG, JPG ou WebP.",
    maxBytesMessage: "A imagem ficou grande demais para ser enviada.",
  });
}

export async function uploadPrivateFileAsset({ dataUrl, scope, ownerId, fileName }) {
  return uploadStorageObject({
    config: getPrivateMediaStorageConfig(),
    dataUrl,
    scope,
    ownerId,
    fileName,
    allowedMimeTypes: new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
    maxBytes: 5 * 1024 * 1024,
    invalidFormatMessage: "O comprovativo precisa de ser uma imagem ou PDF valido.",
    invalidMimeTypeMessage: "O comprovativo precisa de estar em PDF, PNG, JPG ou WebP.",
    maxBytesMessage: "O comprovativo deve ter ate 5 MB.",
  });
}

export async function materializePublicImageAsset({ value, scope, ownerId, fileName, fieldLabel = "A imagem" }) {
  const text = cleanText(value);
  if (!text) return "";

  if (isPublicAssetUrl(text)) {
    return text;
  }

  if (!DATA_URL_RE.test(text)) {
    throw new Error(`${fieldLabel} precisa de ser uma URL publica valida ou uma imagem PNG/JPG/WebP.`);
  }

  const upload = await uploadPublicImageAsset({
    dataUrl: text,
    scope,
    ownerId,
    fileName,
  });

  return upload.publicUrl;
}
