import assert from "node:assert/strict";
import { createRemoteApiProvider } from "../src/catalog/services/providers/remoteApiProvider.js";
import { createAuthService } from "../src/catalog/services/authService.js";
import { createOrderService } from "../src/catalog/services/orderService.js";

function createMemoryStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function createFallbackProvider() {
  const store = new Map();

  return {
    async get(key) {
      return store.has(key) ? { value: store.get(key) } : null;
    },
    async set(key, value) {
      store.set(key, value);
      return { ok: true };
    },
  };
}

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

export async function runOfflineFallbackTests() {
  const previousWindow = global.window;
  const previousFetch = global.fetch;

  try {
    global.window = {
      localStorage: createMemoryStorage(),
    };

    const fallbackProvider = createFallbackProvider();
    const remoteProvider = createRemoteApiProvider(
      { apiBaseUrl: "https://catalogo.exemplo.com/api" },
      fallbackProvider,
    );

    global.fetch = async () =>
      createJsonResponse({
        store: { name: "Loja Demo", color: "#1c9a74" },
        products: [{ id: "prod-1", name: "Cafe" }],
      });

    const liveCatalog = await remoteProvider.get("cat:store-demo");
    assert.equal(Boolean(liveCatalog.syncedAt), true);

    global.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const cachedCatalog = await remoteProvider.get("cat:store-demo");
    assert.equal(cachedCatalog.offlineFallback, true);
    assert.equal(Boolean(cachedCatalog.cachedAt), true);
    assert.match(cachedCatalog.value, /Loja Demo/);

    const authService = createAuthService({
      apiBaseUrl: "https://catalogo.exemplo.com/api",
      apiRequiredMessage: "API obrigatoria",
    });

    global.fetch = async () =>
      createJsonResponse({
        user: { id: "user-1", role: "merchant", email: "demo@loja.com" },
        storeId: "store-demo",
        storeName: "Loja Demo",
      });

    const liveSession = await authService.getSession();
    assert.equal(Boolean(liveSession.syncedAt), true);

    global.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const cachedSession = await authService.getSession();
    assert.equal(cachedSession.offlineFallback, true);
    assert.equal(cachedSession.storeId, "store-demo");

    const orderService = createOrderService({
      apiBaseUrl: "https://catalogo.exemplo.com/api",
      requireRemoteApi: true,
      apiRequiredMessage: "API obrigatoria",
    });

    global.fetch = async () =>
      createJsonResponse({
        ok: true,
        orders: [
          {
            id: "ord-1",
            storeId: "store-demo",
            trackingToken: "trk-1",
            trackingCode: "PED-1234",
          },
        ],
      });

    const liveOrders = await orderService.getMerchantOrders("store-demo");
    assert.equal(Boolean(liveOrders.syncedAt), true);
    assert.equal(liveOrders.orders.length, 1);
    assert.equal(liveOrders.summary.totalCount, 1);

    global.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const cachedOrders = await orderService.getMerchantOrders("store-demo");
    assert.equal(cachedOrders.offlineFallback, true);
    assert.equal(cachedOrders.orders[0].id, "ord-1");
    assert.equal(cachedOrders.summary.totalCount, 1);
  } finally {
    global.window = previousWindow;
    global.fetch = previousFetch;
  }
}
