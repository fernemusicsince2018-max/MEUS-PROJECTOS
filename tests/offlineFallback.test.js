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

    await assert.rejects(
      () => remoteProvider.get("cat:store-demo"),
      /Failed to fetch/,
    );

    global.fetch = async () =>
      createJsonResponse({
        store: { name: "Loja Admin", color: "#2563eb", paymentMethod: "Transferencia" },
        products: [{ id: "prod-admin-1", name: "Produto Privado" }],
      });

    const liveAdminCatalog = await remoteProvider.getAdmin("cat:store-demo");
    assert.equal(Boolean(liveAdminCatalog.syncedAt), true);

    global.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const cachedAdminCatalog = await remoteProvider.getAdmin("cat:store-demo");
    assert.equal(cachedAdminCatalog.offlineFallback, true);
    assert.equal(Boolean(cachedAdminCatalog.cachedAt), true);
    assert.match(cachedAdminCatalog.value, /Loja Admin/);

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

    const crossOriginAuthService = createAuthService({
      apiBaseUrl: "https://catalogo.exemplo.com/api",
      apiRequiredMessage: "API obrigatoria",
      requestCredentials: "include",
    });
    let capturedReviewRequest = null;

    global.fetch = async (url, options) => {
      capturedReviewRequest = {
        url,
        options,
      };
      return createJsonResponse({
        ok: true,
      });
    };

    await crossOriginAuthService.reviewPlanActivationRequest({
      requestId: "plan-req-1",
      decision: "approve",
    });

    assert.equal(capturedReviewRequest?.url, "https://catalogo.exemplo.com/api/super-admin-plan-request-review");
    assert.equal(capturedReviewRequest?.options?.credentials, "include");

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
        reviewsOverview: {
          reviewSummary: {
            averageRating: 4.5,
            totalReviews: 2,
            testimonialCount: 1,
            featuredCount: 1,
            distribution: {
              1: 0,
              2: 0,
              3: 0,
              4: 1,
              5: 1,
            },
          },
          testimonials: [
            {
              id: "rev-1",
              orderId: "ord-1",
              rating: 5,
              comment: "Atendimento muito bom.",
              customerLabel: "Cliente Demo",
              createdAt: "2026-05-01T10:00:00.000Z",
              updatedAt: "2026-05-01T10:00:00.000Z",
              isFeatured: true,
              featuredAt: "2026-05-01T12:00:00.000Z",
            },
          ],
          featuredTestimonials: [
            {
              id: "rev-1",
              orderId: "ord-1",
              rating: 5,
              comment: "Atendimento muito bom.",
              customerLabel: "Cliente Demo",
              createdAt: "2026-05-01T10:00:00.000Z",
              updatedAt: "2026-05-01T10:00:00.000Z",
              isFeatured: true,
              featuredAt: "2026-05-01T12:00:00.000Z",
            },
          ],
          recentTestimonials: [],
        },
      });

    const liveOrders = await orderService.getMerchantOrders("store-demo");
    assert.equal(Boolean(liveOrders.syncedAt), true);
    assert.equal(liveOrders.orders.length, 1);
    assert.equal(liveOrders.summary.totalCount, 1);
    assert.equal(liveOrders.reviewsOverview.reviewSummary.averageRating, 4.5);
    assert.equal(liveOrders.reviewsOverview.testimonials.length, 1);
    assert.equal(liveOrders.reviewsOverview.featuredTestimonials.length, 1);

    global.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const cachedOrders = await orderService.getMerchantOrders("store-demo");
    assert.equal(cachedOrders.offlineFallback, true);
    assert.equal(cachedOrders.orders[0].id, "ord-1");
    assert.equal(cachedOrders.summary.totalCount, 1);
    assert.equal(cachedOrders.reviewsOverview.reviewSummary.totalReviews, 2);
    assert.equal(cachedOrders.reviewsOverview.reviewSummary.featuredCount, 1);

    global.fetch = async () =>
      createJsonResponse({
        ok: true,
        reviews: [
          {
            id: "rev-1",
            storeId: "store-demo",
            orderId: "ord-1",
            customerName: "Cliente Demo",
            customerPhone: "244911111111",
            customerLabel: "Cliente Demo",
            rating: 5,
            comment: "Atendimento muito bom.",
            isPublic: true,
            isFeatured: true,
            featuredAt: "2026-05-01T12:00:00.000Z",
            createdAt: "2026-05-01T10:00:00.000Z",
            updatedAt: "2026-05-01T10:00:00.000Z",
            trackingCode: "PED-1234",
            totalAmount: 4500,
            currencyCode: "AOA",
            orderCreatedAt: "2026-05-01T09:30:00.000Z",
            orderStatus: "delivered",
          },
        ],
        pageInfo: {
          total: 2,
          limit: 12,
          offset: 0,
          hasMore: true,
          nextOffset: 1,
        },
        reviewsOverview: {
          reviewSummary: {
            averageRating: 4.5,
            totalReviews: 2,
            testimonialCount: 1,
            featuredCount: 1,
            distribution: {
              1: 0,
              2: 0,
              3: 0,
              4: 1,
              5: 1,
            },
          },
          testimonials: [
            {
              id: "rev-1",
              orderId: "ord-1",
              rating: 5,
              comment: "Atendimento muito bom.",
              customerLabel: "Cliente Demo",
              createdAt: "2026-05-01T10:00:00.000Z",
              updatedAt: "2026-05-01T10:00:00.000Z",
              isFeatured: true,
              featuredAt: "2026-05-01T12:00:00.000Z",
            },
          ],
          featuredTestimonials: [
            {
              id: "rev-1",
              orderId: "ord-1",
              rating: 5,
              comment: "Atendimento muito bom.",
              customerLabel: "Cliente Demo",
              createdAt: "2026-05-01T10:00:00.000Z",
              updatedAt: "2026-05-01T10:00:00.000Z",
              isFeatured: true,
              featuredAt: "2026-05-01T12:00:00.000Z",
            },
          ],
          recentTestimonials: [],
        },
      });

    const liveMerchantReviews = await orderService.getMerchantReviews("store-demo");
    assert.equal(Boolean(liveMerchantReviews.syncedAt), true);
    assert.equal(liveMerchantReviews.reviews.length, 1);
    assert.equal(liveMerchantReviews.reviews[0].trackingCode, "PED-1234");
    assert.equal(liveMerchantReviews.reviews[0].totalAmount, 4500);
    assert.equal(liveMerchantReviews.pageInfo.hasMore, true);
    assert.equal(liveMerchantReviews.reviewsOverview.reviewSummary.totalReviews, 2);

    global.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const cachedMerchantReviews = await orderService.getMerchantReviews("store-demo");
    assert.equal(cachedMerchantReviews.offlineFallback, true);
    assert.equal(cachedMerchantReviews.reviews[0].id, "rev-1");
    assert.equal(cachedMerchantReviews.pageInfo.nextOffset, 1);

    const localOrderService = createOrderService({
      apiBaseUrl: "",
      requireRemoteApi: false,
      apiRequiredMessage: "API obrigatoria",
    });

    global.window.localStorage.setItem(
      "cat:store-local",
      JSON.stringify({
        s: {
          name: "Loja Local",
          color: "#25ae82",
          currencyCode: "AOA",
          publicEnabled: true,
          whatsapp: "244911000000",
        },
        p: [
          {
            id: "prod-local-1",
            name: "Cafe local",
            price: 1500,
            image: "",
            images: [],
            available: true,
            featured: false,
            onPromotion: false,
            stock: 8,
          },
        ],
      }),
    );

    const createdOrderResponse = await localOrderService.createOrder({
      storeId: "store-local",
      customerName: "Cliente Local",
      customerPhone: "244922233344",
      fulfillmentType: "delivery",
      region: "Luanda",
      area: "Maianga",
      deliveryTime: "13:00",
      notes: "Sem acucar",
      items: [
        {
          id: "prod-local-1",
          qty: 2,
        },
      ],
    });

    assert.equal(Boolean(createdOrderResponse?.order?.trackingToken), true);

    await assert.rejects(
      () =>
        localOrderService.submitStoreReview({
          trackingToken: createdOrderResponse.order.trackingToken,
          rating: 5,
          comment: "Atendimento excelente e entrega rapida.",
        }),
      /marcada como entregue/i,
    );

    const deliveredOrderResponse = await localOrderService.updateMerchantOrderStatus({
      orderId: createdOrderResponse.order.id,
      storeId: "store-local",
      status: "delivered",
    });
    assert.equal(deliveredOrderResponse?.order?.status, "delivered");

    const submittedReview = await localOrderService.submitStoreReview({
      trackingToken: createdOrderResponse.order.trackingToken,
      rating: 5,
      comment: "Atendimento excelente e entrega rapida.",
    });

    assert.equal(submittedReview.review.rating, 5);
    assert.equal(submittedReview.review.comment, "Atendimento excelente e entrega rapida.");

    const trackedLocalOrder = await localOrderService.getTrackedOrder(
      createdOrderResponse.order.trackingToken,
    );
    assert.equal(trackedLocalOrder.order.review.rating, 5);
    assert.equal(trackedLocalOrder.order.review.comment, "Atendimento excelente e entrega rapida.");

    const localMerchantOrders = await localOrderService.getMerchantOrders("store-local");
    assert.equal(localMerchantOrders.orders.length, 1);
    assert.equal(localMerchantOrders.orders[0].review.rating, 5);
    assert.equal(localMerchantOrders.reviewsOverview.reviewSummary.totalReviews, 1);
    assert.equal(localMerchantOrders.reviewsOverview.testimonials[0].comment, "Atendimento excelente e entrega rapida.");

    const localMerchantReviews = await localOrderService.getMerchantReviews("store-local");
    assert.equal(localMerchantReviews.reviews.length, 1);
    assert.equal(localMerchantReviews.reviews[0].trackingCode, createdOrderResponse.order.trackingCode);
    assert.equal(localMerchantReviews.reviews[0].comment, "Atendimento excelente e entrega rapida.");
    assert.equal(localMerchantReviews.reviewsOverview.reviewSummary.totalReviews, 1);

    const featuredReviewResponse = await localOrderService.updateMerchantStoreReviewFeature({
      storeId: "store-local",
      reviewId: submittedReview.review.id,
      featured: true,
    });
    assert.equal(featuredReviewResponse.review.isFeatured, true);
    assert.equal(featuredReviewResponse.reviewsOverview.reviewSummary.featuredCount, 1);
    assert.equal(featuredReviewResponse.reviewsOverview.featuredTestimonials[0].id, submittedReview.review.id);

    const refreshedLocalMerchantReviews = await localOrderService.getMerchantReviews("store-local");
    assert.equal(refreshedLocalMerchantReviews.reviews[0].isFeatured, true);

    const publicStoreReviews = await localOrderService.getPublicStoreReviews("store-local", {
      limit: 12,
      offset: 0,
    });
    assert.equal(publicStoreReviews.reviewSummary.totalReviews, 1);
    assert.equal(publicStoreReviews.reviewSummary.featuredCount, 1);
    assert.equal(publicStoreReviews.reviews[0].isFeatured, true);

    const localCatalogSnapshot = JSON.parse(
      global.window.localStorage.getItem("cat:store-local"),
    );
    assert.equal(localCatalogSnapshot.s.reviewSummary.totalReviews, 1);
    assert.equal(localCatalogSnapshot.s.testimonials.length, 1);
    assert.equal(localCatalogSnapshot.s.featuredTestimonials.length, 1);
    assert.equal(localCatalogSnapshot.s.recentTestimonials.length, 0);
  } finally {
    global.window = previousWindow;
    global.fetch = previousFetch;
  }
}
