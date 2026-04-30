import assert from "node:assert/strict";
import { createAssetService } from "../src/catalog/services/assetService.js";

export async function runAssetServiceTests() {
  const productionLikeService = createAssetService({
    apiBaseUrl: "",
    requireRemoteApi: true,
    apiRequiredMessage: "Define VITE_CATALOG_API_BASE antes de publicar.",
  });

  await assert.rejects(
    () =>
      productionLikeService.uploadAsset({
        kind: "product_image",
        dataUrl: "data:image/png;base64,AAAA",
        fileName: "produto.png",
      }),
    /VITE_CATALOG_API_BASE/i,
  );

  const localFallbackService = createAssetService({
    apiBaseUrl: "",
    requireRemoteApi: false,
  });

  const fallbackUpload = await localFallbackService.uploadAsset({
    kind: "store_logo",
    dataUrl: "data:image/png;base64,BBBB",
    fileName: "logo.png",
  });

  assert.equal(fallbackUpload.ok, true);
  assert.equal(fallbackUpload.url, "data:image/png;base64,BBBB");
  assert.equal(fallbackUpload.storage, "embedded");
}
