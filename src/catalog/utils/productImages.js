const PRODUCT_IMAGE_DATA_URL_MAX_LENGTH = 700000;
const PRODUCT_IMAGE_PUBLIC_URL_MAX_LENGTH = 2048;
const PRODUCT_IMAGE_MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const PRODUCT_IMAGE_MAX_DIMENSION = 960;
const PRODUCT_IMAGE_DATA_URL_RE = /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i;
const PRODUCT_IMAGE_PUBLIC_URL_RE = /^(https?:\/\/|\/)/i;

export function validateProductImage(value) {
  const image = String(value || "").trim();

  if (!image) return "";

  if (PRODUCT_IMAGE_DATA_URL_RE.test(image)) {
    if (image.length > PRODUCT_IMAGE_DATA_URL_MAX_LENGTH) {
      return "A imagem ficou grande demais. Usa uma foto menor.";
    }

    return "";
  }

  if (PRODUCT_IMAGE_PUBLIC_URL_RE.test(image)) {
    if (image.length > PRODUCT_IMAGE_PUBLIC_URL_MAX_LENGTH) {
      return "O link da imagem e demasiado longo.";
    }

    return "";
  }

  if (/^data:/i.test(image)) {
    return "A imagem precisa de ser valida em PNG, JPG, WebP, GIF ou SVG.";
  }

  return "Usa uma URL publica valida ou carrega uma imagem do teu computador.";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel preparar a imagem selecionada."));
    image.src = src;
  });
}

export async function buildProductImageDataUrl(file) {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Seleciona um ficheiro de imagem valido.");
  }

  if (Number(file.size || 0) > PRODUCT_IMAGE_MAX_FILE_SIZE_BYTES) {
    throw new Error("Cada foto deve ter ate 4 MB.");
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(sourceDataUrl);
  const width = image.naturalWidth || image.width || PRODUCT_IMAGE_MAX_DIMENSION;
  const height = image.naturalHeight || image.height || PRODUCT_IMAGE_MAX_DIMENSION;
  const scale = Math.min(1, PRODUCT_IMAGE_MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Nao foi possivel preparar a imagem agora.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const mimeType = /png|gif|svg/i.test(file.type) ? "image/png" : "image/jpeg";
  const optimizedDataUrl = mimeType === "image/png"
    ? canvas.toDataURL(mimeType)
    : canvas.toDataURL(mimeType, 0.82);

  if (optimizedDataUrl.length > PRODUCT_IMAGE_DATA_URL_MAX_LENGTH) {
    throw new Error("A imagem ficou grande demais mesmo apos otimizar. Escolhe outra foto.");
  }

  return optimizedDataUrl;
}
