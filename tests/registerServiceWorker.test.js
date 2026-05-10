import assert from "node:assert/strict";
import {
  cleanupDevelopmentServiceWorkers,
  maybeReloadForUpdatedServiceWorker,
  maybeReloadAfterDevelopmentCleanup,
  shouldCleanupDevelopmentServiceWorkers,
  shouldRegisterServiceWorker,
  watchServiceWorkerRegistrationForUpdates,
} from "../src/pwa/registerServiceWorker.js";

function createNavigatorStub(options = {}) {
  const registrations = options.registrations || [];
  return {
    serviceWorker: {
      async getRegistrations() {
        return registrations;
      },
    },
  };
}

function createSessionStorageStub(initialState = {}) {
  const state = new Map(Object.entries(initialState));
  return {
    getItem(key) {
      return state.has(key) ? state.get(key) : null;
    },
    setItem(key, value) {
      state.set(key, String(value));
    },
    removeItem(key) {
      state.delete(key);
    },
  };
}

function createEventTarget() {
  const listeners = new Map();

  return {
    addEventListener(type, handler) {
      const current = listeners.get(type) || [];
      current.push(handler);
      listeners.set(type, current);
    },
    dispatchEvent(type) {
      const current = listeners.get(type) || [];
      current.forEach((handler) => handler());
    },
  };
}

export async function runRegisterServiceWorkerTests() {
  assert.equal(
    shouldRegisterServiceWorker({
      metaObject: { env: { DEV: true } },
      locationObject: { protocol: "http:", hostname: "localhost" },
      navigatorObject: createNavigatorStub(),
    }),
    false,
  );

  assert.equal(
    shouldRegisterServiceWorker({
      metaObject: { env: { DEV: false } },
      locationObject: { protocol: "http:", hostname: "localhost" },
      navigatorObject: createNavigatorStub(),
    }),
    true,
  );

  assert.equal(
    shouldCleanupDevelopmentServiceWorkers({
      metaObject: { env: { DEV: true } },
      locationObject: { protocol: "http:", hostname: "localhost" },
      navigatorObject: createNavigatorStub(),
    }),
    true,
  );

  const unregistered = [];
  const deletedCaches = [];
  const cleanupResult = await cleanupDevelopmentServiceWorkers({
    navigatorObject: createNavigatorStub({
      registrations: [
        {
          unregister: async () => {
            unregistered.push("first");
            return true;
          },
        },
      ],
    }),
    cachesObject: {
      async keys() {
        return ["catalog-shell-v3", "other-cache"];
      },
      async delete(key) {
        deletedCaches.push(key);
        return true;
      },
    },
  });

  assert.deepEqual(cleanupResult, {
    didUnregister: true,
    didDeleteCache: true,
  });
  assert.deepEqual(unregistered, ["first"]);
  assert.deepEqual(deletedCaches, ["catalog-shell-v3"]);

  const storage = createSessionStorageStub();
  let reloads = 0;
  assert.equal(
    maybeReloadAfterDevelopmentCleanup(
      { didUnregister: true, didDeleteCache: false },
      {
        storageObject: storage,
        locationObject: {
          reload() {
            reloads += 1;
          },
        },
      },
    ),
    true,
  );
  assert.equal(reloads, 1);
  assert.equal(storage.getItem("catalog-dev-sw-reset"), "1");

  assert.equal(
    maybeReloadAfterDevelopmentCleanup(
      { didUnregister: true, didDeleteCache: false },
      {
        storageObject: storage,
        locationObject: {
          reload() {
            reloads += 1;
          },
        },
      },
    ),
    false,
  );
  assert.equal(reloads, 1);
  assert.equal(storage.getItem("catalog-dev-sw-reset"), null);

  assert.equal(
    maybeReloadAfterDevelopmentCleanup(
      { didUnregister: false, didDeleteCache: false },
      {
        storageObject: storage,
        locationObject: {
          reload() {
            reloads += 1;
          },
        },
      },
    ),
    false,
  );
  assert.equal(reloads, 1);

  const updateStorage = createSessionStorageStub();
  assert.equal(
    maybeReloadForUpdatedServiceWorker({
      storageObject: updateStorage,
      locationObject: {
        reload() {
          reloads += 1;
        },
      },
    }),
    true,
  );
  assert.equal(reloads, 2);
  assert.equal(updateStorage.getItem("catalog-sw-update-reload"), "1");

  assert.equal(
    maybeReloadForUpdatedServiceWorker({
      storageObject: updateStorage,
      locationObject: {
        reload() {
          reloads += 1;
        },
      },
    }),
    false,
  );
  assert.equal(reloads, 2);
  assert.equal(updateStorage.getItem("catalog-sw-update-reload"), null);

  const serviceWorkerTarget = createEventTarget();
  const registrationTarget = createEventTarget();
  const installingTarget = createEventTarget();
  const installStorage = createSessionStorageStub();
  let installReloads = 0;
  const installingWorker = {
    state: "installing",
    addEventListener: installingTarget.addEventListener,
  };
  const registration = {
    installing: installingWorker,
    waiting: null,
    addEventListener: registrationTarget.addEventListener,
  };

  watchServiceWorkerRegistrationForUpdates({
    registration,
    navigatorObject: {
      serviceWorker: {
        controller: { scriptURL: "/sw.js" },
        addEventListener: serviceWorkerTarget.addEventListener,
      },
    },
    storageObject: installStorage,
    locationObject: {
      reload() {
        installReloads += 1;
      },
    },
  });

  installingWorker.state = "installed";
  installingTarget.dispatchEvent("statechange");
  assert.equal(installReloads, 1);

  const firstInstallStorage = createSessionStorageStub();
  let firstInstallReloads = 0;
  const firstInstallWorkerTarget = createEventTarget();
  const firstInstallRegistrationTarget = createEventTarget();
  const firstInstallInstallingTarget = createEventTarget();
  const firstInstallWorker = {
    state: "installing",
    addEventListener: firstInstallInstallingTarget.addEventListener,
  };

  watchServiceWorkerRegistrationForUpdates({
    registration: {
      installing: firstInstallWorker,
      waiting: null,
      addEventListener: firstInstallRegistrationTarget.addEventListener,
    },
    navigatorObject: {
      serviceWorker: {
        controller: null,
        addEventListener: firstInstallWorkerTarget.addEventListener,
      },
    },
    storageObject: firstInstallStorage,
    locationObject: {
      reload() {
        firstInstallReloads += 1;
      },
    },
  });

  firstInstallWorker.state = "installed";
  firstInstallInstallingTarget.dispatchEvent("statechange");
  assert.equal(firstInstallReloads, 0);
}
