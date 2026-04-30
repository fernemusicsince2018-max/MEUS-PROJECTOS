const STORE_LOGO_DATA_URL_MAX_LENGTH = 400000;
const STORE_LOGO_PUBLIC_URL_MAX_LENGTH = 2048;
const STORE_LOGO_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const STORE_LOGO_MAX_DIMENSION = 320;
const STORE_LOGO_DATA_URL_RE = /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i;
const STORE_LOGO_PUBLIC_URL_RE = /^(https?:\/\/|\/)/i;

export function validateStoreLogo(value) {
  const logo = String(value || "").trim();

  if (!logo) return "";

  if (STORE_LOGO_DATA_URL_RE.test(logo)) {
    if (logo.length > STORE_LOGO_DATA_URL_MAX_LENGTH) {
      return "O logo ficou grande demais. Usa uma imagem menor.";
    }

    return "";
  }

  if (STORE_LOGO_PUBLIC_URL_RE.test(logo)) {
    if (logo.length > STORE_LOGO_PUBLIC_URL_MAX_LENGTH) {
      return "O link do logo e demasiado longo.";
    }

    return "";
  }

  if (/^data:/i.test(logo)) {
    return "O logo precisa de ser uma imagem valida em PNG, JPG, WebP, GIF ou SVG.";
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

export async function buildStoreLogoDataUrl(file) {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Seleciona um ficheiro de imagem valido.");
  }

  if (Number(file.size || 0) > STORE_LOGO_MAX_FILE_SIZE_BYTES) {
    throw new Error("O logo deve ter ate 2 MB.");
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(sourceDataUrl);
  const width = image.naturalWidth || image.width || STORE_LOGO_MAX_DIMENSION;
  const height = image.naturalHeight || image.height || STORE_LOGO_MAX_DIMENSION;
  const scale = Math.min(1, STORE_LOGO_MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Nao foi possivel preparar o logo agora.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const mimeType = /jpe?g/i.test(file.type) ? "image/jpeg" : "image/png";
  const optimizedDataUrl = mimeType === "image/png"
    ? canvas.toDataURL(mimeType)
    : canvas.toDataURL(mimeType, 0.82);

  if (optimizedDataUrl.length > STORE_LOGO_DATA_URL_MAX_LENGTH) {
    throw new Error("O logo ficou grande demais mesmo apos otimizar. Escolhe outra imagem.");
  }

  return optimizedDataUrl;
}
