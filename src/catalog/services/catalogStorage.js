import { createLocalStorageProvider } from "./providers/localStorageProvider.js";
import { createRemoteApiProvider } from "./providers/remoteApiProvider.js";
import { createWindowStorageProvider } from "./providers/windowStorageProvider.js";
import { getRuntimeConfig } from "./runtimeConfig.js";

const runtimeConfig = getRuntimeConfig();
const localProvider = createLocalStorageProvider();
const windowProvider = createWindowStorageProvider();
const remoteProvider = createRemoteApiProvider(runtimeConfig, localProvider);
const unavailableProvider = {
  available: false,
  async get() {
    throw new Error(runtimeConfig.apiRequiredMessage);
  },
  async getAdmin() {
    throw new Error(runtimeConfig.apiRequiredMessage);
  },
  async set() {
    throw new Error(runtimeConfig.apiRequiredMessage);
  },
};

function getCatalogProvider() {
  if (remoteProvider.available) return remoteProvider;
  if (runtimeConfig.requireRemoteApi) return unavailableProvider;
  if (windowProvider.available) return windowProvider;
  return localProvider;
}

function getAuxProvider() {
  if (windowProvider.available && !remoteProvider.available) return windowProvider;
  return localProvider;
}

export const catalogStorage = {
  async get(key) {
    const provider = key === "cat:aid" ? getAuxProvider() : getCatalogProvider();
    return provider.get(key);
  },
  async getAdmin(key) {
    const provider = getCatalogProvider();
    if (typeof provider.getAdmin === "function") {
      return provider.getAdmin(key);
    }
    return provider.get(key);
  },
  async set(key, value) {
    const provider = key === "cat:aid" ? getAuxProvider() : getCatalogProvider();
    return provider.set(key, value);
  },
  getStatus() {
    if (remoteProvider.available) return { mode: "remote", label: "API PostgreSQL" };
    if (runtimeConfig.requireRemoteApi) return { mode: "required_remote", label: "API obrigatoria" };
    if (windowProvider.available) return { mode: "platform", label: "Storage da plataforma" };
    return { mode: "local", label: "LocalStorage" };
  },
};
