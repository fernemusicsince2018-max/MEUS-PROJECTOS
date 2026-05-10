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
  STORE_REVIEW_FEATURED_LIMIT,
  STORE_REVIEW_PAGE_LIMIT,
  STORE_REVIEW_PAGE_MAX_LIMIT,
  attachStoreReviewDataToStore,
  buildPublicReviewFeedEntries,
  buildStoreReviewCustomerLabel,
  normalizeStoreReviewComment,
  normalizeStoreReviewRating,
  normalizeStoreReviewRecord,
} from "../../../shared/storeReviews.js";
import {
  buildEmptyMerchantOrdersPageInfo,
  buildMerchantOrdersPage,
  isMerchantOrderBeforeCursor,
  normalizeMerchantOrdersPageLimit,
} from "../../../shared/merchantOrdersPagination.js";
import { getOrderReviewEligibility } from "../../../shared/orderReviewEligibility.js";

const ORDER_STORAGE_KEY = "cat:orders";
const CUSTOMER_STORAGE_KEY = "cat:order-customers";
const STORE_REVIEW_STORAGE_KEY = "cat:store-reviews";
const TRACKING_CACHE_PREFIX = "cat:cache:tracking:";
const MERCHANT_ORDERS_CACHE_PREFIX = "cat:cache:merchant-orders:";
const MERCHANT_REVIEWS_CACHE_PREFIX = "cat:cache:merchant-reviews:";

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

function createStoreReviewId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `rev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
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

function buildMerchantReviewsCacheKey(storeId, options = {}) {
  const limit = normalizeReviewPageLimit(options?.limit);
  const offset = normalizeReviewOffset(options?.offset);
  return `${MERCHANT_REVIEWS_CACHE_PREFIX}${cleanText(storeId)}:${limit}:${offset}`;
}

function getTimezoneOffsetMinutes() {
  return new Date().getTimezoneOffset();
}

function normalizeReviewCount(value) {
  return Math.max(0, Math.floor(Number(value || 0)));
}

function normalizeBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = cleanText(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function normalizeReviewPageLimit(value) {
  return Math.max(
    1,
    Math.min(
      STORE_REVIEW_PAGE_MAX_LIMIT,
      Math.floor(Number(value || STORE_REVIEW_PAGE_LIMIT) || STORE_REVIEW_PAGE_LIMIT),
    ),
  );
}

function normalizeReviewOffset(value) {
  return Math.max(0, Math.floor(Number(value || 0) || 0));
}

function createEmptyReviewPageInfo(limit = STORE_REVIEW_PAGE_LIMIT, offset = 0) {
  const safeLimit = normalizeReviewPageLimit(limit);
  const safeOffset = normalizeReviewOffset(offset);
  return {
    total: 0,
    limit: safeLimit,
    offset: safeOffset,
    hasMore: false,
    nextOffset: safeOffset,
  };
}

function normalizeMoneyValue(value) {
  if (value === "" || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toTimestampValue(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareReviewEntriesNewestFirst(left, right) {
  const leftTimestamp = toTimestampValue(left?.updatedAt || left?.createdAt);
  const rightTimestamp = toTimestampValue(right?.updatedAt || right?.createdAt);
  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  return String(right?.id || "").localeCompare(String(left?.id || ""));
}

function normalizePublicReviewEntry(entry = {}) {
  return {
    id: cleanText(entry?.id),
    orderId: cleanText(entry?.orderId),
    rating: normalizeStoreReviewRating(entry?.rating, 0),
    comment: normalizeStoreReviewComment(entry?.comment),
    customerLabel: cleanText(entry?.customerLabel, 160),
    createdAt: entry?.createdAt || null,
    updatedAt: entry?.updatedAt || null,
    isFeatured: normalizeBooleanFlag(entry?.isFeatured),
    featuredAt: entry?.featuredAt || null,
  };
}

function normalizeMerchantReviewEntry(entry = {}) {
  const normalized = normalizeStoreReviewRecord({
    id: entry?.id,
    storeId: entry?.storeId,
    orderId: entry?.orderId,
    customerKey: entry?.customerKey,
    customerName: entry?.customerName,
    customerPhone: entry?.customerPhone,
    rating: entry?.rating,
    comment: entry?.comment,
    isPublic: entry?.isPublic,
    isFeatured: entry?.isFeatured,
    featuredAt: entry?.featuredAt,
    createdAt: entry?.createdAt,
    updatedAt: entry?.updatedAt,
  });

  return {
    ...normalized,
    customerLabel:
      cleanText(entry?.customerLabel, 160)
      || buildStoreReviewCustomerLabel(normalized.customerName, normalized.customerPhone),
    trackingCode: cleanText(entry?.trackingCode, 64),
    totalAmount: normalizeMoneyValue(entry?.totalAmount),
    currencyCode: cleanText(entry?.currencyCode, 12) || "AOA",
    orderCreatedAt: entry?.orderCreatedAt || null,
    orderStatus: cleanText(entry?.orderStatus, 24).toLowerCase(),
  };
}

function createEmptyStoreReviewOverview() {
  const attachedStore = attachStoreReviewDataToStore({}, []);
  return {
    reviewSummary: attachedStore.reviewSummary,
    testimonials: attachedStore.testimonials,
    featuredTestimonials: attachedStore.featuredTestimonials,
    recentTestimonials: attachedStore.recentTestimonials,
  };
}

function normalizeStoreReviewOverview(payload = {}) {
  const fallback = createEmptyStoreReviewOverview();
  const summaryInput =
    payload?.reviewSummary && typeof payload.reviewSummary === "object"
      ? payload.reviewSummary
      : {};
  const normalizedSummary = {
    averageRating: Number(summaryInput.averageRating || 0) || 0,
    totalReviews: normalizeReviewCount(summaryInput.totalReviews),
    testimonialCount: normalizeReviewCount(summaryInput.testimonialCount),
    featuredCount: normalizeReviewCount(summaryInput.featuredCount),
    distribution: {
      1: normalizeReviewCount(summaryInput.distribution?.[1]),
      2: normalizeReviewCount(summaryInput.distribution?.[2]),
      3: normalizeReviewCount(summaryInput.distribution?.[3]),
      4: normalizeReviewCount(summaryInput.distribution?.[4]),
      5: normalizeReviewCount(summaryInput.distribution?.[5]),
    },
  };

  return {
    reviewSummary: {
      ...fallback.reviewSummary,
      ...normalizedSummary,
      distribution: {
        ...fallback.reviewSummary.distribution,
        ...normalizedSummary.distribution,
      },
    },
    testimonials: Array.isArray(payload?.testimonials)
      ? payload.testimonials
        .map(normalizePublicReviewEntry)
        .filter((entry) => entry.id && entry.rating > 0 && entry.comment)
      : fallback.testimonials,
    featuredTestimonials: Array.isArray(payload?.featuredTestimonials)
      ? payload.featuredTestimonials
        .map(normalizePublicReviewEntry)
        .filter((entry) => entry.id && entry.rating > 0 && entry.comment)
      : fallback.featuredTestimonials,
    recentTestimonials: Array.isArray(payload?.recentTestimonials)
      ? payload.recentTestimonials
        .map(normalizePublicReviewEntry)
        .filter((entry) => entry.id && entry.rating > 0 && entry.comment)
      : fallback.recentTestimonials,
  };
}

function normalizePublicStoreReviewsResponse(payload = {}, options = {}) {
  const limit = normalizeReviewPageLimit(options.limit);
  const offset = normalizeReviewOffset(options.offset);
  const reviewSummary = normalizeStoreReviewOverview({
    reviewSummary: payload?.reviewSummary,
  }).reviewSummary;
  const reviews = Array.isArray(payload?.reviews)
    ? payload.reviews
      .map(normalizePublicReviewEntry)
      .filter((entry) => entry.id && entry.rating > 0)
    : [];
  const pageInfoInput = payload?.pageInfo && typeof payload.pageInfo === "object" ? payload.pageInfo : {};

  return {
    ...payload,
    reviewSummary,
    reviews,
    pageInfo: {
      total: Math.max(0, Number(pageInfoInput.total || reviewSummary.totalReviews || 0)),
      limit: normalizeReviewPageLimit(pageInfoInput.limit || limit),
      offset: normalizeReviewOffset(pageInfoInput.offset ?? offset),
      hasMore: Boolean(pageInfoInput.hasMore),
      nextOffset: normalizeReviewOffset(
        pageInfoInput.nextOffset
          ?? normalizeReviewOffset(pageInfoInput.offset ?? offset) + reviews.length,
      ),
    },
  };
}

function normalizeMerchantReviewsPageInfo(
  pageInfo,
  fallbackLimit,
  fallbackOffset,
  fallbackTotal,
  visibleCount = 0,
) {
  return {
    total: Math.max(0, Number(pageInfo?.total || fallbackTotal || 0)),
    limit: normalizeReviewPageLimit(pageInfo?.limit || fallbackLimit),
    offset: normalizeReviewOffset(pageInfo?.offset ?? fallbackOffset),
    hasMore: Boolean(pageInfo?.hasMore),
    nextOffset: normalizeReviewOffset(
      pageInfo?.nextOffset
        ?? normalizeReviewOffset(pageInfo?.offset ?? fallbackOffset) + visibleCount,
    ),
  };
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
    reviewsOverview: normalizeStoreReviewOverview(payload?.reviewsOverview),
  };
}

function finalizeMerchantReviewsResponse(payload = {}, options = {}) {
  const limit = normalizeReviewPageLimit(options?.limit);
  const offset = normalizeReviewOffset(options?.offset);
  const reviews = Array.isArray(payload?.reviews)
    ? payload.reviews
      .map(normalizeMerchantReviewEntry)
      .filter((entry) => entry.id && entry.rating > 0)
    : [];
  const fallbackPageInfo = {
    total: reviews.length,
    limit,
    offset,
    hasMore: false,
    nextOffset: offset + reviews.length,
  };
  const pageInfoInput =
    payload?.pageInfo
    && typeof payload.pageInfo === "object"
    && Object.keys(payload.pageInfo).length > 0
      ? payload.pageInfo
      : fallbackPageInfo;

  return {
    ...payload,
    reviews,
    pageInfo: normalizeMerchantReviewsPageInfo(
      pageInfoInput,
      limit,
      offset,
      reviews.length,
      reviews.length,
    ),
    reviewsOverview: normalizeStoreReviewOverview(payload?.reviewsOverview),
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

function mapStoreReview(record) {
  const normalized = normalizeStoreReviewRecord(record);
  if (!normalized.id || !normalized.orderId || !normalized.storeId) return null;

  return {
    ...normalized,
    customerLabel: buildStoreReviewCustomerLabel(
      normalized.customerName,
      normalized.customerPhone,
    ),
  };
}

function mapMerchantReviewRecord(record, orderLookup = new Map()) {
  const normalized = mapStoreReview(record);
  if (!normalized) return null;

  const relatedOrder = orderLookup.get(cleanText(normalized.orderId)) || null;
  return normalizeMerchantReviewEntry({
    ...normalized,
    customerName: normalized.customerName || relatedOrder?.customerName || "",
    customerPhone: normalized.customerPhone || relatedOrder?.customerPhone || "",
    trackingCode: relatedOrder?.trackingCode || "",
    totalAmount: relatedOrder?.totalAmount ?? null,
    currencyCode: relatedOrder?.currencyCode || "AOA",
    orderCreatedAt: relatedOrder?.createdAt || null,
    orderStatus: relatedOrder?.status || "",
  });
}

async function readStoreReviews(provider) {
  const response = await provider.get(STORE_REVIEW_STORAGE_KEY);
  if (!response?.value) return [];

  try {
    const parsed = JSON.parse(response.value);
    return Array.isArray(parsed) ? parsed.map(mapStoreReview).filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

async function writeStoreReviews(provider, reviews) {
  await provider.set(STORE_REVIEW_STORAGE_KEY, JSON.stringify(reviews));
}

function buildLocalPublicStoreReviewsResponse(reviews = [], options = {}) {
  const limit = normalizeReviewPageLimit(options.limit);
  const offset = normalizeReviewOffset(options.offset);
  const attachedStore = attachStoreReviewDataToStore({}, reviews);
  const publicReviews = buildPublicReviewFeedEntries(reviews, {
    limit,
    offset,
  });

  return {
    ok: true,
    reviewSummary: attachedStore.reviewSummary,
    reviews: publicReviews,
    pageInfo: {
      total: attachedStore.reviewSummary.totalReviews,
      limit,
      offset,
      hasMore: offset + publicReviews.length < attachedStore.reviewSummary.totalReviews,
      nextOffset: offset + publicReviews.length,
    },
  };
}

function buildLocalMerchantReviewsResponse(storeId, orders = [], reviews = [], options = {}) {
  const normalizedStoreId = cleanText(storeId);
  const limit = normalizeReviewPageLimit(options.limit);
  const offset = normalizeReviewOffset(options.offset);
  const storeOrders = orders.filter((order) => order.storeId === normalizedStoreId);
  const storeReviews = reviews.filter((entry) => entry.storeId === normalizedStoreId);
  const orderLookup = new Map(
    storeOrders.map((order) => [cleanText(order.id), order]),
  );
  const merchantReviews = storeReviews
    .map((review) => mapMerchantReviewRecord(review, orderLookup))
    .filter((entry) => entry?.id && entry.rating > 0)
    .sort(compareReviewEntriesNewestFirst);
  const visibleReviews = merchantReviews.slice(offset, offset + limit);

  return {
    ok: true,
    reviews: visibleReviews,
    pageInfo: {
      total: merchantReviews.length,
      limit,
      offset,
      hasMore: offset + visibleReviews.length < merchantReviews.length,
      nextOffset: offset + visibleReviews.length,
    },
    reviewsOverview: normalizeStoreReviewOverview(
      attachStoreReviewDataToStore({}, storeReviews),
    ),
  };
}

function normalizeMerchantStoreReviewFeatureResponse(payload = {}) {
  return {
    ...payload,
    review: payload?.review ? mapStoreReview(payload.review) : null,
    reviewsOverview: normalizeStoreReviewOverview(payload?.reviewsOverview),
  };
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

function attachStoreReview(order, review) {
  return review ? { ...order, review } : order;
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

async function syncLocalStoreReviewSnapshot(provider, storeId, reviews) {
  const normalizedStoreId = cleanText(storeId);
  if (!normalizedStoreId) return;

  const response = await provider.get(`cat:${normalizedStoreId}`);
  if (!response?.value) return;

  try {
    const payload = JSON.parse(response.value);
    const nextStore = attachStoreReviewDataToStore(
      payload?.s || {},
      reviews.filter((review) => review.storeId === normalizedStoreId),
    );

    await provider.set(
      `cat:${normalizedStoreId}`,
      JSON.stringify({
        s: nextStore,
        p: Array.isArray(payload?.p) ? payload.p : [],
      }),
    );
  } catch (error) {
    // Ignore malformed local snapshots and keep the review saved for future reloads.
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

    async submitStoreReview(payload) {
      if (base) {
        const response = await fetch(`${base}/order-review-submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: requestCredentials,
          body: JSON.stringify(payload),
        });

        const data = await parseResponse(response, "Nao foi possivel guardar a avaliacao.");
        const trackingToken = cleanText(data?.order?.trackingToken || payload?.trackingToken);
        const syncedAt = trackingToken
          ? await writeProviderCache(
            fallbackProvider,
            buildTrackingCacheKey(trackingToken),
            { ok: true, order: data?.order || null },
          )
          : "";

        return {
          ...data,
          syncedAt,
        };
      }

      if (requireRemoteApi) {
        throw new Error(apiRequiredMessage);
      }

      const trackingToken = cleanText(payload?.trackingToken, 160);
      if (!trackingToken) {
        throw new Error("O token de acompanhamento da encomenda e obrigatorio.");
      }

      const rating = normalizeStoreReviewRating(payload?.rating, 0);
      if (!rating) {
        throw new Error("Escolhe entre 1 e 5 estrelas para avaliar a loja.");
      }

      const comment = normalizeStoreReviewComment(payload?.comment);
      const [orders, customers, reviews] = await Promise.all([
        readOrders(fallbackProvider),
        readCustomers(fallbackProvider),
        readStoreReviews(fallbackProvider),
      ]);
      const customerLookup = new Map(
        customers.map((entry) => [cleanText(entry.customerKey), mapCustomerProfile(entry)]),
      );
      const order = orders.find((entry) => entry.trackingToken === trackingToken);
      if (!order) {
        const error = new Error("Encomenda nao encontrada.");
        error.status = 404;
        throw error;
      }

      const reviewEligibility = getOrderReviewEligibility(order);
      if (!reviewEligibility.eligible) {
        const error = new Error(reviewEligibility.reason);
        error.status = 409;
        throw error;
      }

      const nowIso = new Date().toISOString();
      const existingReview = reviews.find((entry) => cleanText(entry.orderId) === cleanText(order.id)) || null;
      const review = mapStoreReview({
        id: existingReview?.id || createStoreReviewId(),
        storeId: cleanText(order.storeId),
        orderId: cleanText(order.id),
        customerKey: cleanText(order.customerKey) || normalizeCustomerPhone(order.customerPhone),
        customerName: cleanText(order.customerName, 160),
        customerPhone: normalizeCustomerPhone(order.customerPhone),
        rating,
        comment,
        isPublic: true,
        isFeatured: existingReview?.isFeatured === true,
        featuredAt: existingReview?.featuredAt || null,
        createdAt: existingReview?.createdAt || nowIso,
        updatedAt: nowIso,
      });

      const nextReviews = existingReview
        ? reviews.map((entry) => (entry.id === existingReview.id ? review : entry))
        : [review, ...reviews];
      const nextOrder = attachStoreReview(
        attachCustomerProfile(order, customerLookup),
        review,
      );

      await Promise.all([
        writeStoreReviews(fallbackProvider, nextReviews),
        writeProviderCache(
          fallbackProvider,
          buildTrackingCacheKey(trackingToken),
          { ok: true, order: nextOrder },
        ),
        syncLocalStoreReviewSnapshot(fallbackProvider, order.storeId, nextReviews),
      ]);

      return {
        ok: true,
        review,
        order: nextOrder,
      };
    },

    async getPublicStoreReviews(storeId, options = {}) {
      const normalizedStoreId = cleanText(storeId, 160);
      if (!normalizedStoreId) {
        throw new Error("A loja das avaliacoes e obrigatoria.");
      }

      const limit = normalizeReviewPageLimit(options.limit);
      const offset = normalizeReviewOffset(options.offset);

      if (base) {
        const searchParams = new URLSearchParams({
          storeId: normalizedStoreId,
          limit: String(limit),
          offset: String(offset),
        });
        const response = await fetch(`${base}/store-reviews-public?${searchParams.toString()}`, {
          method: "GET",
          credentials: requestCredentials,
        });

        return normalizePublicStoreReviewsResponse(
          await parseResponse(response, "Nao foi possivel carregar as avaliacoes da loja."),
          { limit, offset },
        );
      }

      if (requireRemoteApi) {
        throw new Error(apiRequiredMessage);
      }

      const reviews = await readStoreReviews(fallbackProvider);
      return buildLocalPublicStoreReviewsResponse(
        reviews.filter((entry) => entry.storeId === normalizedStoreId),
        { limit, offset },
      );
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

      const [orders, customers, reviews] = await Promise.all([
        readOrders(fallbackProvider),
        readCustomers(fallbackProvider),
        readStoreReviews(fallbackProvider),
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

      const review = reviews.find((entry) => cleanText(entry.orderId) === cleanText(order.id)) || null;

      return {
        ok: true,
        order: attachStoreReview(
          attachCustomerProfile(order, customerLookup),
          review,
        ),
      };
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
      const [orders, customers, reviews] = await Promise.all([
        readOrders(fallbackProvider),
        readCustomers(fallbackProvider),
        readStoreReviews(fallbackProvider),
      ]);
      const customerLookup = new Map(
        customers
          .filter((entry) => entry.storeId === normalizedStoreId)
          .map((entry) => [cleanText(entry.customerKey), mapCustomerProfile(entry)]),
      );
      const reviewsByOrderId = reviews
        .filter((entry) => entry.storeId === normalizedStoreId)
        .reduce((accumulator, entry) => {
          accumulator.set(cleanText(entry.orderId), entry);
          return accumulator;
        }, new Map());
      const merchantOrders = orders
        .filter((order) => order.storeId === normalizedStoreId)
        .map((order) =>
          attachStoreReview(
            attachCustomerProfile(order, customerLookup),
            reviewsByOrderId.get(cleanText(order.id)) || null,
          ));
      const pagedOrders = paginateMerchantOrdersList(merchantOrders, normalizedOptions);
      const reviewsOverview = normalizeStoreReviewOverview(
        attachStoreReviewDataToStore(
          {},
          reviews.filter((entry) => entry.storeId === normalizedStoreId),
        ),
      );
      return {
        ok: true,
        orders: pagedOrders.rows,
        summary: buildMerchantOrderSummary(merchantOrders, {
          timezoneOffsetMinutes: getTimezoneOffsetMinutes(),
        }),
        pageInfo: pagedOrders.pageInfo || buildEmptyMerchantOrdersPageInfo(normalizedOptions.limit),
        reviewsOverview,
      };
    },

    async getMerchantReviews(storeId, options = {}) {
      const normalizedOptions = options && typeof options === "object" ? options : {};
      if (base) {
        let response;
        const searchParams = new URLSearchParams({
          limit: String(normalizeReviewPageLimit(normalizedOptions.limit)),
          offset: String(normalizeReviewOffset(normalizedOptions.offset)),
        });

        try {
          response = await fetch(`${base}/merchant-reviews?${searchParams.toString()}`, {
            method: "GET",
            credentials: requestCredentials,
          });
        } catch (error) {
          const cached = await readCachedRemoteResponse(
            fallbackProvider,
            buildMerchantReviewsCacheKey(storeId, normalizedOptions),
          );
          if (cached) return finalizeMerchantReviewsResponse(cached, normalizedOptions);
          throw error;
        }

        const data = finalizeMerchantReviewsResponse(
          await parseResponse(response, "Nao foi possivel carregar as avaliacoes."),
          normalizedOptions,
        );
        return {
          ...data,
          syncedAt: await writeProviderCache(
            fallbackProvider,
            buildMerchantReviewsCacheKey(storeId, normalizedOptions),
            data,
          ),
        };
      }

      if (requireRemoteApi) {
        throw new Error(apiRequiredMessage);
      }

      const normalizedStoreId = cleanText(storeId);
      if (!normalizedStoreId) {
        return {
          ok: true,
          reviews: [],
          pageInfo: createEmptyReviewPageInfo(
            normalizedOptions.limit,
            normalizedOptions.offset,
          ),
          reviewsOverview: createEmptyStoreReviewOverview(),
        };
      }

      const [orders, reviews] = await Promise.all([
        readOrders(fallbackProvider),
        readStoreReviews(fallbackProvider),
      ]);

      return buildLocalMerchantReviewsResponse(
        normalizedStoreId,
        orders,
        reviews,
        normalizedOptions,
      );
    },

    async updateMerchantStoreReviewFeature(payload) {
      if (base) {
        const response = await fetch(`${base}/merchant-store-review-feature`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: requestCredentials,
          body: JSON.stringify(payload),
        });

        return normalizeMerchantStoreReviewFeatureResponse(
          await parseResponse(response, "Nao foi possivel atualizar este testemunho."),
        );
      }

      if (requireRemoteApi) {
        throw new Error(apiRequiredMessage);
      }

      const normalizedStoreId = cleanText(payload?.storeId);
      const normalizedReviewId = cleanText(payload?.reviewId, 160);
      if (!normalizedStoreId || !normalizedReviewId) {
        throw new Error("A avaliacao que queres atualizar e obrigatoria.");
      }

      if (!Object.prototype.hasOwnProperty.call(payload || {}, "featured")) {
        throw new Error("Indica se queres fixar ou retirar este testemunho.");
      }

      const nextFeatured = normalizeBooleanFlag(payload.featured);
      const reviews = await readStoreReviews(fallbackProvider);
      const currentReview = reviews.find(
        (entry) => entry.storeId === normalizedStoreId && entry.id === normalizedReviewId,
      );

      if (!currentReview) {
        const error = new Error("A avaliacao selecionada nao foi encontrada.");
        error.status = 404;
        throw error;
      }

      if (nextFeatured && !currentReview.comment) {
        const error = new Error("So podes fixar testemunhos que tenham comentario escrito.");
        error.status = 400;
        throw error;
      }

      const featuredCount = reviews.filter(
        (entry) =>
          entry.storeId === normalizedStoreId
          && entry.id !== normalizedReviewId
          && entry.isFeatured === true,
      ).length;
      if (nextFeatured && !currentReview.isFeatured && featuredCount >= STORE_REVIEW_FEATURED_LIMIT) {
        const error = new Error(
          `So podes fixar ate ${STORE_REVIEW_FEATURED_LIMIT} testemunho(s) em destaque na vitrine.`,
        );
        error.status = 400;
        throw error;
      }

      const nowIso = new Date().toISOString();
      const nextReview = mapStoreReview({
        ...currentReview,
        isFeatured: nextFeatured,
        featuredAt: nextFeatured ? currentReview.featuredAt || nowIso : null,
        updatedAt: nowIso,
      });
      const nextReviews = reviews.map((entry) =>
        entry.id === normalizedReviewId && entry.storeId === normalizedStoreId
          ? nextReview
          : entry,
      );

      await Promise.all([
        writeStoreReviews(fallbackProvider, nextReviews),
        syncLocalStoreReviewSnapshot(fallbackProvider, normalizedStoreId, nextReviews),
      ]);

      return normalizeMerchantStoreReviewFeatureResponse({
        ok: true,
        review: nextReview,
        reviewsOverview: attachStoreReviewDataToStore(
          {},
          nextReviews.filter((entry) => entry.storeId === normalizedStoreId),
        ),
      });
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
