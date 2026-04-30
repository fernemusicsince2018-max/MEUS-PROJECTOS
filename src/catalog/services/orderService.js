import { catalogStorage } from "./catalogStorage.js";
import { createLocalStorageProvider } from "./providers/localStorageProvider.js";
import { createWindowStorageProvider } from "./providers/windowStorageProvider.js";
import { readProviderCache, writeProviderCache } from "../utils/providerCache.js";
import {
  applyOrderStatusUpdate,
  calculateOrderDiscountAmount,
  createInitialOrderStatusTimeline,
  normalizeCustomerDiscountPercent,
  normalizeCustomerPhone,
} from "../utils/orders.js";
import { buildMerchantOrderSummary } from "../../../shared/orderAnalytics.js";
import {
  buildEmptyMerchantOrdersPageInfo,
  buildMerchantOrdersPage,
  isMerchantOrderBeforeCursor,
  normalizeMerchantOrdersPageLimit,
} from "../../../shared/merchantOrdersPagination.js";

const ORDER_STORAGE_KEY = "cat:orders";
const CUSTOMER_STORAGE_KEY = "cat:order-customers";
const TRACKING_CACHE_PREFIX = "cat:cache:tracking:";
const MERCHANT_ORDERS_CACHE_PREFIX = "cat:cache:merchant-orders:";

function cleanText(value, maxLength = null) {
  const text = String(value ?? "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function normalizeQuantity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return Number.NaN;
  return Math.floor(numeric);
}

function createTrackingCode() {
  const value = Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, "0").slice(0, 8);
  return `PED-${value}`;
}

function createTrackingToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `trk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function createOrderId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ord_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function createOrderItemId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ori_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function createCustomerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `cus_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

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

function toMoney(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function getFallbackProvider() {
  const windowProvider = createWindowStorageProvider();
  if (windowProvider.available) return windowProvider;
  return createLocalStorageProvider();
}

function buildTrackingCacheKey(token) {
  return `${TRACKING_CACHE_PREFIX}${cleanText(token)}`;
}

function buildMerchantOrdersCacheKey(storeId, options = {}) {
  const limit = normalizeMerchantOrdersPageLimit(options?.limit);
  const cursor = encodeURIComponent(String(options?.cursor || "").trim() || "first");
  return `${MERCHANT_ORDERS_CACHE_PREFIX}${cleanText(storeId)}:${limit}:${cursor}`;
}

function getTimezoneOffsetMinutes() {
  return new Date().getTimezoneOffset();
}

function normalizeMerchantOrdersPageInfo(pageInfo, fallbackLimit) {
  const normalizedLimit = normalizeMerchantOrdersPageLimit(
    pageInfo?.limit,
    normalizeMerchantOrdersPageLimit(fallbackLimit),
  );

  return {
    total: Math.max(0, Number(pageInfo?.total || 0)),
    limit: normalizedLimit,
    hasMore: Boolean(pageInfo?.hasMore),
    endCursor: cleanText(pageInfo?.endCursor, 512),
  };
}

function finalizeMerchantOrdersResponse(payload, options = {}) {
  const orders = Array.isArray(payload?.orders) ? payload.orders : [];
  const emptyPageInfo = buildEmptyMerchantOrdersPageInfo(options?.limit);
  const fallbackPageInfo = {
    total: orders.length,
    limit: emptyPageInfo.limit,
    hasMore: false,
    endCursor: "",
  };
  return {
    ...payload,
    orders,
    summary:
      payload?.summary
      || buildMerchantOrderSummary(orders, {
        timezoneOffsetMinutes: getTimezoneOffsetMinutes(),
      }),
    pageInfo: normalizeMerchantOrdersPageInfo(payload?.pageInfo || fallbackPageInfo, options?.limit),
  };
}

function paginateMerchantOrdersList(orders = [], options = {}) {
  const limit = normalizeMerchantOrdersPageLimit(options?.limit);
  const sortedOrders = [...orders].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      || String(right.id || "").localeCompare(String(left.id || "")),
  );
  const filteredOrders = options?.cursor
    ? sortedOrders.filter((order) =>
      isMerchantOrderBeforeCursor(
        {
          id: order.id,
          createdAt: order.createdAt,
        },
        options.cursor,
      ))
    : sortedOrders;

  return buildMerchantOrdersPage(filteredOrders, limit, sortedOrders.length);
}

async function readCachedRemoteResponse(provider, cacheKey) {
  const cached = await readProviderCache(provider, cacheKey);
  if (!cached?.payload || typeof cached.payload !== "object") return null;

  return {
    ...cached.payload,
    cachedAt: cached.updatedAt || "",
    offlineFallback: true,
  };
}

async function readOrders(provider) {
  const response = await provider.get(ORDER_STORAGE_KEY);
  if (!response?.value) return [];

  try {
    const parsed = JSON.parse(response.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeOrders(provider, orders) {
  await provider.set(ORDER_STORAGE_KEY, JSON.stringify(orders));
}

async function readCustomers(provider) {
  const response = await provider.get(CUSTOMER_STORAGE_KEY);
  if (!response?.value) return [];

  try {
    const parsed = JSON.parse(response.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeCustomers(provider, customers) {
  await provider.set(CUSTOMER_STORAGE_KEY, JSON.stringify(customers));
}

function mapCustomerProfile(record) {
  if (!record) return null;

  return {
    id: record.id,
    customerKey: cleanText(record.customerKey),
    customerName: cleanText(record.customerName, 160),
    customerPhone: normalizeCustomerPhone(record.customerPhone),
    loyaltyDiscountPercent: normalizeCustomerDiscountPercent(record.loyaltyDiscountPercent),
    orderCount: Math.max(0, Math.floor(Number(record.orderCount || 0))),
    lastOrderId: cleanText(record.lastOrderId),
    lastOrderAt: record.lastOrderAt || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

function attachCustomerProfile(order, customerLookup) {
  const customerKey = cleanText(order?.customerKey) || normalizeCustomerPhone(order?.customerPhone);
  const customer = customerKey ? customerLookup.get(customerKey) || null : null;
  return customer ? { ...order, customer } : order;
}

async function readCatalogSnapshot(storeId) {
  const response = await catalogStorage.get(`cat:${storeId}`);
  if (!response?.value) return null;

  try {
    const payload = JSON.parse(response.value);
    return {
      store: payload?.s || {},
      products: Array.isArray(payload?.p) ? payload.p : [],
    };
  } catch (error) {
    return null;
  }
}

export function createOrderService(config) {
  const base = (config.apiBaseUrl || "").replace(/\/$/, "");
  const requireRemoteApi = Boolean(config.requireRemoteApi);
  const requestCredentials = config.requestCredentials || "same-origin";
  const apiRequiredMessage =
    config.apiRequiredMessage
    || "Esta aplicacao precisa da API configurada para gravar dados com seguranca.";
  const fallbackProvider = getFallbackProvider();

  return {
    available: Boolean(base),
    async createOrder(payload) {
      if (base) {
        const response = await fetch(`${base}/order-create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: requestCredentials,
          body: JSON.stringify(payload),
        });

        const data = await parseResponse(response, "Nao foi possivel criar a encomenda.");

        if (data?.order?.trackingToken) {
          await writeProviderCache(
            fallbackProvider,
            buildTrackingCacheKey(data.order.trackingToken),
            { ok: true, order: data.order },
          );
        }

        return data;
      }

      if (requireRemoteApi) {
        throw new Error(apiRequiredMessage);
      }

      const snapshot = await readCatalogSnapshot(payload.storeId);
      if (!snapshot?.store) {
        throw new Error("Loja nao encontrada.");
      }

      if (!snapshot.store.publicEnabled) {
        throw new Error("Esta loja nao esta disponivel para novos pedidos.");
      }

      const normalizedItems = Array.isArray(payload.items) ? payload.items : [];
      if (!normalizedItems.length) {
        throw new Error("Adiciona pelo menos um produto ao pedido.");
      }

      const customerPhone = normalizeCustomerPhone(payload.customerPhone);
      if (!customerPhone) {
        throw new Error("Indica o telefone ou WhatsApp do cliente.");
      }

      if (customerPhone.length < 8) {
        throw new Error("Indica um telefone ou WhatsApp valido do cliente.");
      }

      const productMap = new Map(snapshot.products.map((product) => [product.id, product]));
      const items = [];
      let subtotalAmount = 0;
      let itemCount = 0;

      for (const requestedItem of normalizedItems) {
        const productId = cleanText(requestedItem.id || requestedItem.productId);
        const quantity = normalizeQuantity(requestedItem.qty ?? requestedItem.quantity);
        const product = productMap.get(productId);

        if (!product || Number.isNaN(quantity)) {
          throw new Error("Um ou mais produtos do pedido sao invalidos.");
        }

        if (product.available === false) {
          throw new Error(`O produto ${product.name} ja nao esta disponivel.`);
        }

        if (product.stock !== "" && product.stock != null && quantity > Number(product.stock || 0)) {
          throw new Error(`O produto ${product.name} tem apenas ${product.stock} unidade(s) disponivel(is).`);
        }

        const unitPrice = toMoney(product.price);
        const lineTotal = toMoney(unitPrice * quantity);
        subtotalAmount += lineTotal;
        itemCount += quantity;

        items.push({
          id: createOrderItemId(),
          orderId: "",
          productId,
          productName: product.name || "",
          productImage: product.image || "",
          unitPrice,
          quantity,
          lineTotal,
          createdAt: new Date().toISOString(),
        });
      }

      subtotalAmount = toMoney(subtotalAmount);
      const customers = await readCustomers(fallbackProvider);
      const customerKey = customerPhone;
      const existingCustomer = customers.find((entry) => entry.storeId === payload.storeId && cleanText(entry.customerKey) === customerKey) || null;
      const discountPercent = normalizeCustomerDiscountPercent(existingCustomer?.loyaltyDiscountPercent);
      const discountAmount = calculateOrderDiscountAmount(subtotalAmount, discountPercent);
      const totalAmount = toMoney(Math.max(0, subtotalAmount - discountAmount));
      const trackingToken = createTrackingToken();
      const createdAt = new Date().toISOString();
      const customerName = cleanText(payload.customerName, 160) || cleanText(existingCustomer?.customerName, 160);
      const order = {
        id: createOrderId(),
        storeId: payload.storeId,
        trackingCode: createTrackingCode(),
        trackingToken,
        customerName,
        customerPhone,
        customerKey,
        fulfillmentType: cleanText(payload.fulfillmentType, 24).toLowerCase() === "pickup" ? "pickup" : "delivery",
        region: cleanText(payload.region || payload.province, 160),
        area: cleanText(payload.area, 160),
        pickupTime: cleanText(payload.pickupTime, 16),
        deliveryTime: cleanText(payload.deliveryTime, 16),
        notes: cleanText(payload.notes),
        status: "pending",
        subtotalAmount,
        discountPercent,
        discountAmount,
        totalAmount,
        currencyCode: snapshot.store.currencyCode || "AOA",
        itemCount,
        statusUpdatedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
        statusTimeline: createInitialOrderStatusTimeline(createdAt),
        items: items.map((item) => ({
          ...item,
          orderId: "",
        })),
        store: {
          id: payload.storeId,
          name: snapshot.store.name || "",
          logo: snapshot.store.logo || "",
          color: snapshot.store.color || "#16a34a",
          whatsapp: snapshot.store.whatsapp || "",
          pickupNote: snapshot.store.pickupNote || "",
          city: snapshot.store.city || "",
          country: snapshot.store.country || "",
        },
      };

      order.items = items.map((item) => ({
        ...item,
        orderId: order.id,
      }));

      const orders = await readOrders(fallbackProvider);
      orders.unshift(order);
      const existingOrderCount = existingCustomer
        ? Math.max(0, Math.floor(Number(existingCustomer.orderCount || 0)))
        : 0;
      const nextCustomer = {
        id: existingCustomer?.id || createCustomerId(),
        storeId: payload.storeId,
        customerKey,
        customerName: customerName || cleanText(existingCustomer?.customerName, 160),
        customerPhone,
        loyaltyDiscountPercent: discountPercent,
        orderCount: existingOrderCount + 1,
        lastOrderId: order.id,
        lastOrderAt: createdAt,
        createdAt: existingCustomer?.createdAt || createdAt,
        updatedAt: createdAt,
      };
      const nextCustomers = existingCustomer
        ? customers.map((entry) =>
            entry.storeId === payload.storeId && cleanText(entry.customerKey) === customerKey
              ? nextCustomer
              : entry,
          )
        : [nextCustomer, ...customers];

      order.customer = mapCustomerProfile(nextCustomer);
      await writeOrders(fallbackProvider, orders);
      await writeCustomers(fallbackProvider, nextCustomers);

      return { ok: true, order };
    },

    async getTrackedOrder(token) {
      if (base) {
        let response;

        try {
          response = await fetch(`${base}/order-track?token=${encodeURIComponent(token)}`, {
            method: "GET",
            credentials: requestCredentials,
          });
        } catch (error) {
          const cached = await readCachedRemoteResponse(
            fallbackProvider,
            buildTrackingCacheKey(token),
          );
          if (cached) return cached;
          throw error;
        }

        const data = await parseResponse(response, "Nao foi possivel acompanhar a encomenda.");
        return {
          ...data,
          syncedAt: await writeProviderCache(
            fallbackProvider,
            buildTrackingCacheKey(token),
            data,
          ),
        };
      }

      if (requireRemoteApi) {
        throw new Error(apiRequiredMessage);
      }

      const [orders, customers] = await Promise.all([
        readOrders(fallbackProvider),
        readCustomers(fallbackProvider),
      ]);
      const customerLookup = new Map(
        customers.map((entry) => [cleanText(entry.customerKey), mapCustomerProfile(entry)]),
      );
      const order = orders.find((entry) => entry.trackingToken === token);
      if (!order) {
        const error = new Error("Encomenda nao encontrada.");
        error.status = 404;
        throw error;
      }

      return { ok: true, order: attachCustomerProfile(order, customerLookup) };
    },

    async getMerchantOrders(storeId, options = {}) {
      const normalizedOptions = options && typeof options === "object" ? options : {};
      if (base) {
        let response;
        const searchParams = new URLSearchParams({
          tzOffsetMinutes: String(getTimezoneOffsetMinutes()),
          limit: String(normalizeMerchantOrdersPageLimit(normalizedOptions.limit)),
        });

        if (normalizedOptions.cursor) {
          searchParams.set("cursor", String(normalizedOptions.cursor));
        }

        try {
          response = await fetch(`${base}/merchant-orders?${searchParams.toString()}`, {
            method: "GET",
            credentials: requestCredentials,
          });
        } catch (error) {
          const cached = await readCachedRemoteResponse(
            fallbackProvider,
            buildMerchantOrdersCacheKey(storeId, normalizedOptions),
          );
          if (cached) return finalizeMerchantOrdersResponse(cached, normalizedOptions);
          throw error;
        }

        const data = finalizeMerchantOrdersResponse(
          await parseResponse(response, "Nao foi possivel carregar as encomendas."),
          normalizedOptions,
        );
        return {
          ...data,
          syncedAt: await writeProviderCache(
            fallbackProvider,
            buildMerchantOrdersCacheKey(storeId, normalizedOptions),
            data,
          ),
        };
      }

      if (requireRemoteApi) {
        throw new Error(apiRequiredMessage);
      }

      const normalizedStoreId = cleanText(storeId);
      const [orders, customers] = await Promise.all([
        readOrders(fallbackProvider),
        readCustomers(fallbackProvider),
      ]);
      const customerLookup = new Map(
        customers
          .filter((entry) => entry.storeId === normalizedStoreId)
          .map((entry) => [cleanText(entry.customerKey), mapCustomerProfile(entry)]),
      );
      const merchantOrders = orders
        .filter((order) => order.storeId === normalizedStoreId)
        .map((order) => attachCustomerProfile(order, customerLookup));
      const pagedOrders = paginateMerchantOrdersList(merchantOrders, normalizedOptions);
      return {
        ok: true,
        orders: pagedOrders.rows,
        summary: buildMerchantOrderSummary(merchantOrders, {
          timezoneOffsetMinutes: getTimezoneOffsetMinutes(),
        }),
        pageInfo: pagedOrders.pageInfo || buildEmptyMerchantOrdersPageInfo(normalizedOptions.limit),
      };
    },

    async updateMerchantOrderStatus(payload) {
      if (base) {
        const response = await fetch(`${base}/merchant-order-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: requestCredentials,
          body: JSON.stringify(payload),
        });

        return parseResponse(response, "Nao foi possivel atualizar o estado da encomenda.");
      }

      if (requireRemoteApi) {
        throw new Error(apiRequiredMessage);
      }

      const normalizedStoreId = cleanText(payload.storeId);
      const normalizedOrderId = cleanText(payload.orderId);
      const [orders, customers] = await Promise.all([
        readOrders(fallbackProvider),
        readCustomers(fallbackProvider),
      ]);
      let updatedOrder = null;

      const nextOrders = orders.map((order) => {
        if (order.id !== normalizedOrderId || order.storeId !== normalizedStoreId) {
          return order;
        }

        const nextStatusState = applyOrderStatusUpdate(
          order,
          payload.status,
          payload.statusDurations || {},
          new Date(),
        );
        updatedOrder = {
          ...order,
          status: nextStatusState.status,
          statusTimeline: nextStatusState.statusTimeline,
          statusUpdatedAt: nextStatusState.statusUpdatedAt,
          updatedAt: nextStatusState.statusUpdatedAt,
        };
        return updatedOrder;
      });

      if (!updatedOrder) {
        const error = new Error("Encomenda nao encontrada.");
        error.status = 404;
        throw error;
      }

      await writeOrders(fallbackProvider, nextOrders);
      const customerLookup = new Map(
        customers
          .filter((entry) => entry.storeId === normalizedStoreId)
          .map((entry) => [cleanText(entry.customerKey), mapCustomerProfile(entry)]),
      );
      return { ok: true, order: attachCustomerProfile(updatedOrder, customerLookup) };
    },

    async updateMerchantCustomerDiscount(payload) {
      if (base) {
        const response = await fetch(`${base}/merchant-customer-discount`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: requestCredentials,
          body: JSON.stringify(payload),
        });

        return parseResponse(response, "Nao foi possivel guardar o desconto do cliente.");
      }

      if (requireRemoteApi) {
        throw new Error(apiRequiredMessage);
      }

      const normalizedStoreId = cleanText(payload.storeId);
      const normalizedOrderId = cleanText(payload.orderId);
      const nextDiscountPercent = normalizeCustomerDiscountPercent(payload.discountPercent);
      const [orders, customers] = await Promise.all([
        readOrders(fallbackProvider),
        readCustomers(fallbackProvider),
      ]);
      const order = orders.find((entry) => entry.id === normalizedOrderId && entry.storeId === normalizedStoreId);
      if (!order) {
        const error = new Error("Encomenda nao encontrada.");
        error.status = 404;
        throw error;
      }

      const customerPhone = normalizeCustomerPhone(order.customerPhone);
      const customerKey = cleanText(order.customerKey) || customerPhone;
      if (!customerKey) {
        throw new Error("Este pedido ainda nao tem um cliente identificavel para fidelizacao.");
      }

      const existingCustomer = customers.find((entry) => entry.storeId === normalizedStoreId && cleanText(entry.customerKey) === customerKey) || null;
      const matchingOrders = orders.filter((entry) => entry.storeId === normalizedStoreId && (cleanText(entry.customerKey) || normalizeCustomerPhone(entry.customerPhone)) === customerKey);
      const nowIso = new Date().toISOString();
      const nextCustomer = {
        id: existingCustomer?.id || createCustomerId(),
        storeId: normalizedStoreId,
        customerKey,
        customerName: cleanText(order.customerName, 160) || cleanText(existingCustomer?.customerName, 160),
        customerPhone,
        loyaltyDiscountPercent: nextDiscountPercent,
        orderCount: Math.max(
          matchingOrders.length,
          Math.max(0, Math.floor(Number(existingCustomer?.orderCount || 0))),
        ),
        lastOrderId: existingCustomer?.lastOrderId || order.id,
        lastOrderAt: existingCustomer?.lastOrderAt || order.createdAt || nowIso,
        createdAt: existingCustomer?.createdAt || order.createdAt || nowIso,
        updatedAt: nowIso,
      };
      const nextCustomers = existingCustomer
        ? customers.map((entry) =>
            entry.storeId === normalizedStoreId && cleanText(entry.customerKey) === customerKey
              ? nextCustomer
              : entry,
          )
        : [nextCustomer, ...customers];

      await writeCustomers(fallbackProvider, nextCustomers);
      return { ok: true, customer: mapCustomerProfile(nextCustomer) };
    },
  };
}
