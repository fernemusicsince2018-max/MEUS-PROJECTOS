import { getRuntimeConfig } from "./runtimeConfig.js";

async function parseResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(payload.error || fallbackMessage);
    failure.status = response.status;
    failure.payload = payload;
    throw failure;
  }

  return payload;
}

export function createAssetService(config) {
  const base = (config.apiBaseUrl || "").replace(/\/$/, "");
  const requireRemoteApi = Boolean(config.requireRemoteApi);
  const requestCredentials = config.requestCredentials || "same-origin";
  const apiRequiredMessage =
    config.apiRequiredMessage
    || "Esta aplicacao precisa da API configurada para gravar dados com seguranca.";

  return {
    available: Boolean(base),
    async uploadAsset(payload) {
      if (base) {
        const response = await fetch(`${base}/asset-upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: requestCredentials,
          body: JSON.stringify(payload),
        });

        return parseResponse(response, "Nao foi possivel carregar a imagem.");
      }

      if (requireRemoteApi) {
        throw new Error(apiRequiredMessage);
      }

      return {
        ok: true,
        url: String(payload?.dataUrl || ""),
        storage: "embedded",
      };
    },
  };
}

const runtimeConfig = getRuntimeConfig();

export const assetService = createAssetService(runtimeConfig);
