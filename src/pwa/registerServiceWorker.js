const RAW_BASE_URL =
  typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
    ? String(import.meta.env.BASE_URL)
    : "/";

const SW_PATH = `${RAW_BASE_URL.endsWith("/") ? RAW_BASE_URL : `${RAW_BASE_URL}/`}sw.js`;
const DEV_SW_RESET_FLAG = "catalog-dev-sw-reset";
const SW_UPDATE_RELOAD_FLAG = "catalog-sw-update-reload";
let didRequestServiceWorkerUpdateReload = false;

function getImportMetaEnv(metaObject = typeof import.meta !== "undefined" ? import.meta : null) {
  return metaObject?.env || {};
}

function getNormalizedLocation(locationObject) {
  return {
    protocol: String(locationObject?.protocol || "").toLowerCase(),
    hostname: String(locationObject?.hostname || "").toLowerCase(),
  };
}

function supportsServiceWorker(navigatorObject) {
  return Boolean(navigatorObject && "serviceWorker" in navigatorObject);
}

export function shouldRegisterServiceWorker({
  metaObject = typeof import.meta !== "undefined" ? import.meta : null,
  locationObject = typeof window !== "undefined" ? window.location : null,
  navigatorObject = typeof navigator !== "undefined" ? navigator : null,
} = {}) {
  if (getImportMetaEnv(metaObject).DEV) return false;
  if (!supportsServiceWorker(navigatorObject)) return false;

  const { protocol, hostname } = getNormalizedLocation(locationObject);
  return protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1";
}

export function shouldCleanupDevelopmentServiceWorkers({
  metaObject = typeof import.meta !== "undefined" ? import.meta : null,
  locationObject = typeof window !== "undefined" ? window.location : null,
  navigatorObject = typeof navigator !== "undefined" ? navigator : null,
} = {}) {
  if (!getImportMetaEnv(metaObject).DEV) return false;
  if (!supportsServiceWorker(navigatorObject)) return false;

  const { hostname } = getNormalizedLocation(locationObject);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export async function cleanupDevelopmentServiceWorkers({
  navigatorObject = typeof navigator !== "undefined" ? navigator : null,
  cachesObject = typeof caches !== "undefined" ? caches : null,
} = {}) {
  const serviceWorker = navigatorObject?.serviceWorker;
  const registrations =
    typeof serviceWorker?.getRegistrations === "function"
      ? await serviceWorker.getRegistrations()
      : [];

  const unregisterResults = await Promise.all(
    registrations.map((registration) => registration.unregister().catch(() => false)),
  );

  let deletedCacheKeys = [];
  if (cachesObject && typeof cachesObject.keys === "function" && typeof cachesObject.delete === "function") {
    const cacheKeys = await cachesObject.keys();
    deletedCacheKeys = cacheKeys.filter((key) => String(key).startsWith("catalog-shell-"));
    await Promise.all(deletedCacheKeys.map((key) => cachesObject.delete(key).catch(() => false)));
  }

  return {
    didUnregister: unregisterResults.some(Boolean),
    didDeleteCache: deletedCacheKeys.length > 0,
  };
}

export function maybeReloadAfterDevelopmentCleanup(
  result,
  {
    storageObject = typeof window !== "undefined" ? window.sessionStorage : null,
    locationObject = typeof window !== "undefined" ? window.location : null,
  } = {},
) {
  const changed = Boolean(result?.didUnregister || result?.didDeleteCache);
  if (!storageObject) return false;

  if (!changed) {
    storageObject.removeItem(DEV_SW_RESET_FLAG);
    return false;
  }

  if (storageObject.getItem(DEV_SW_RESET_FLAG) === "1") {
    storageObject.removeItem(DEV_SW_RESET_FLAG);
    return false;
  }

  storageObject.setItem(DEV_SW_RESET_FLAG, "1");
  locationObject?.reload?.();
  return true;
}

export function maybeReloadForUpdatedServiceWorker({
  storageObject = typeof window !== "undefined" ? window.sessionStorage : null,
  locationObject = typeof window !== "undefined" ? window.location : null,
} = {}) {
  if (!locationObject?.reload) return false;

  if (!storageObject) {
    if (didRequestServiceWorkerUpdateReload) {
      return false;
    }

    didRequestServiceWorkerUpdateReload = true;
    locationObject.reload();
    return true;
  }

  if (storageObject.getItem(SW_UPDATE_RELOAD_FLAG) === "1") {
    storageObject.removeItem(SW_UPDATE_RELOAD_FLAG);
    return false;
  }

  storageObject.setItem(SW_UPDATE_RELOAD_FLAG, "1");
  locationObject.reload();
  return true;
}

function watchInstallingServiceWorker(installingWorker, hadController, requestReload) {
  if (!installingWorker || typeof installingWorker.addEventListener !== "function") {
    return false;
  }

  installingWorker.addEventListener("statechange", () => {
    if (installingWorker.state === "installed" && hadController) {
      requestReload();
    }
  });

  return true;
}

export function watchServiceWorkerRegistrationForUpdates({
  registration,
  navigatorObject = typeof navigator !== "undefined" ? navigator : null,
  storageObject = typeof window !== "undefined" ? window.sessionStorage : null,
  locationObject = typeof window !== "undefined" ? window.location : null,
} = {}) {
  if (!registration) return false;

  const serviceWorker = navigatorObject?.serviceWorker;
  const hadController = Boolean(serviceWorker?.controller);
  const requestReload = () =>
    maybeReloadForUpdatedServiceWorker({
      storageObject,
      locationObject,
    });

  if (hadController && typeof serviceWorker?.addEventListener === "function") {
    serviceWorker.addEventListener("controllerchange", requestReload, { once: true });
  }

  watchInstallingServiceWorker(registration.installing, hadController, requestReload);

  if (typeof registration.addEventListener === "function") {
    registration.addEventListener("updatefound", () => {
      watchInstallingServiceWorker(registration.installing, hadController, requestReload);
    });
  }

  if (registration.waiting && hadController) {
    requestReload();
  }

  return true;
}

export function registerServiceWorker() {
  if (shouldCleanupDevelopmentServiceWorkers()) {
    window.addEventListener("load", () => {
      cleanupDevelopmentServiceWorkers()
        .then((result) => {
          maybeReloadAfterDevelopmentCleanup(result);
        })
        .catch((error) => {
          console.warn("Nao foi possivel limpar service workers de desenvolvimento.", error);
        });
    });
    return;
  }

  if (!shouldRegisterServiceWorker()) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SW_PATH)
      .then((registration) => {
        watchServiceWorkerRegistrationForUpdates({ registration });
        if (typeof registration?.update === "function") {
          registration.update().catch(() => {});
        }
      })
      .catch((error) => {
        console.error("Nao foi possivel registar o service worker.", error);
      });
  });
}
