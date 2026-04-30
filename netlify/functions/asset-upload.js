import { getSessionContext } from "./_auth.js";
import { jsonResponse, withCors } from "./_postgres.js";
import { uploadPublicImageAsset } from "./_storage.js";

const ASSET_KIND_SCOPE = {
  store_logo: "store-logos",
  product_image: "product-images",
};

function cleanText(value, maxLength = null) {
  const text = String(value || "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

async function handle(event) {
  try {
    const session = await getSessionContext(event);
    if (!session?.userId) {
      return jsonResponse(401, { error: "Precisas de iniciar sessao para carregar imagens." });
    }

    const payload = JSON.parse(event.body || "{}");
    const kind = cleanText(payload.kind, 40).toLowerCase();
    const scope = ASSET_KIND_SCOPE[kind];

    if (!scope) {
      return jsonResponse(400, { error: "Tipo de asset invalido." });
    }

    if (!session.storeId) {
      return jsonResponse(403, { error: "A tua sessao ainda nao tem uma loja pronta para receber media." });
    }

    const dataUrl = cleanText(payload.dataUrl);
    if (!dataUrl) {
      return jsonResponse(400, { error: "A imagem a carregar e obrigatoria." });
    }

    const upload = await uploadPublicImageAsset({
      dataUrl,
      scope,
      ownerId: session.storeId,
      fileName: cleanText(payload.fileName, 120) || kind,
    });

    return jsonResponse(200, {
      ok: true,
      url: upload.publicUrl,
      bucket: upload.bucket,
      objectPath: upload.objectPath,
    });
  } catch (error) {
    return jsonResponse(error.status || 500, {
      error: error.message || "Nao foi possivel carregar a imagem.",
    });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
