import { useEffect, useRef, useState } from "react";
import { STORE_DEFAULTS } from "../constants.js";
import {
  normalizeProduct,
  normalizeProducts,
  normalizeStore,
  resolveMerchantPlanSnapshot,
} from "../utils/catalog.js";
import { buildBeautyStarterCatalog, shouldHydrateBeautyStarterCatalog } from "../utils/starterCatalog.js";
import { buildMerchantOrderSummary, EMPTY_MERCHANT_ORDER_SUMMARY } from "../../../shared/orderAnalytics.js";
import { EMPTY_MERCHANT_ORDERS_PAGE_INFO } from "../../../shared/merchantOrdersPagination.js";
import {
  STORE_REVIEW_PAGE_LIMIT,
  STORE_REVIEW_PAGE_MAX_LIMIT,
} from "../../../shared/storeReviews.js";
import { EMPTY_MERCHANT_PLAN_CATALOG } from "./controllerState.js";

const ORDERS_PAGE_SIZE = EMPTY_MERCHANT_ORDERS_PAGE_INFO.limit;
const EMPTY_MERCHANT_REVIEWS_PAGE_INFO = Object.freeze({
  total: 0,
  limit: STORE_REVIEW_PAGE_LIMIT,
  offset: 0,
  hasMore: false,
  nextOffset: 0,
});
const REVIEWS_PAGE_SIZE = EMPTY_MERCHANT_REVIEWS_PAGE_INFO.limit;
export const MERCHANT_REVIEWS_AUTO_REFRESH_MS = 60 * 1000;

export function resolveMerchantReviewsRefreshLimit(pageInfo = {}, loadedReviews = []) {
  const visibleCount = Array.isArray(loadedReviews)
    ? loadedReviews.length
    : Math.max(0, Math.floor(Number(loadedReviews || 0) || 0));
  const currentLimit = Math.max(0, Math.floor(Number(pageInfo?.limit || 0) || 0));
  const nextOffset = Math.max(0, Math.floor(Number(pageInfo?.nextOffset || 0) || 0));

  return Math.max(
    1,
    Math.min(
      STORE_REVIEW_PAGE_MAX_LIMIT,
      Math.max(REVIEWS_PAGE_SIZE, currentLimit, nextOffset, visibleCount),
    ),
  );
}

export function mergeRefreshedMerchantReviews(
  refreshedReviews = [],
  existingReviews = [],
  totalAvailable = null,
) {
  const safeRefreshedReviews = Array.isArray(refreshedReviews) ? refreshedReviews : [];
  const safeExistingReviews = Array.isArray(existingReviews) ? existingReviews : [];
  const baseTargetLength = Math.max(
    safeRefreshedReviews.length,
    safeExistingReviews.length,
  );
  const parsedTotal = Number(totalAvailable);
  const hasKnownTotal = Number.isFinite(parsedTotal) && parsedTotal >= 0;
  const targetLength = hasKnownTotal
    ? Math.min(baseTargetLength, Math.floor(parsedTotal))
    : baseTargetLength;
  const mergedReviews = [];
  const seenReviewIds = new Set();

  for (const review of safeRefreshedReviews) {
    if (!review?.id || seenReviewIds.has(review.id)) continue;
    seenReviewIds.add(review.id);
    mergedReviews.push(review);
  }

  for (const review of safeExistingReviews) {
    if (mergedReviews.length >= targetLength) break;
    if (!review?.id || seenReviewIds.has(review.id)) continue;
    seenReviewIds.add(review.id);
    mergedReviews.push(review);
  }

  return mergedReviews.slice(0, targetLength || safeRefreshedReviews.length);
}

function createLocalProductId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `prod_${Math.random().toString(36).slice(2, 10)}`;
}

function getMerchantSummaryFallback(nextOrders) {
  return buildMerchantOrderSummary(nextOrders, {
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
  });
}

function getTodayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function patchMerchantSummaryForOrderUpdate(previousSummary, previousOrder, nextOrder) {
  const safeSummary = previousSummary || EMPTY_MERCHANT_ORDER_SUMMARY;
  if (!previousOrder || !nextOrder || previousOrder.status === nextOrder.status) {
    return safeSummary;
  }

  const statusKeyMap = {
    pending: "pending",
    in_progress: "inProgress",
    on_the_way: "onTheWay",
    delivered: "delivered",
  };
  const nextStatusCounts = {
    ...(safeSummary.statusCounts || EMPTY_MERCHANT_ORDER_SUMMARY.statusCounts),
  };
  const previousStatusKey = statusKeyMap[previousOrder.status];
  const nextStatusKey = statusKeyMap[nextOrder.status];

  if (previousStatusKey && typeof nextStatusCounts[previousStatusKey] === "number") {
    nextStatusCounts[previousStatusKey] = Math.max(0, nextStatusCounts[previousStatusKey] - 1);
  }

  if (nextStatusKey) {
    nextStatusCounts[nextStatusKey] = Math.max(0, Number(nextStatusCounts[nextStatusKey] || 0) + 1);
  }

  const isTodayOrder = getTodayKey(previousOrder.createdAt) === getTodayKey();
  const previousDelivered = previousOrder.status === "delivered";
  const nextDelivered = nextOrder.status === "delivered";
  const todaySummary = safeSummary.today || EMPTY_MERCHANT_ORDER_SUMMARY.today;

  return {
    ...safeSummary,
    statusCounts: nextStatusCounts,
    today: {
      ...todaySummary,
      deliveredCount: isTodayOrder
        ? Math.max(
          0,
          Number(todaySummary.deliveredCount || 0)
          + (nextDelivered ? 1 : 0)
          - (previousDelivered ? 1 : 0),
        )
        : Number(todaySummary.deliveredCount || 0),
    },
  };
}

export function useMerchantController({
  authService,
  orderService,
  catalogStorage,
  session,
  setSession,
  sessionRef,
  screen,
  handleUnauthorizedSession,
  showToast,
  updateSyncStatusFromResponse,
}) {
  const [store, setStore] = useState(STORE_DEFAULTS);
  const [prods, setProds] = useState([]);
  const [sid, setSid] = useState("");
  const [tab, setTab] = useState("inicio");
  const [modal, setModal] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersSummary, setOrdersSummary] = useState(EMPTY_MERCHANT_ORDER_SUMMARY);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPageInfo, setOrdersPageInfo] = useState(EMPTY_MERCHANT_ORDERS_PAGE_INFO);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  const [merchantReviews, setMerchantReviews] = useState([]);
  const [merchantReviewsLoading, setMerchantReviewsLoading] = useState(false);
  const [merchantReviewsPageInfo, setMerchantReviewsPageInfo] = useState(
    EMPTY_MERCHANT_REVIEWS_PAGE_INFO,
  );
  const [merchantReviewsLoadingMore, setMerchantReviewsLoadingMore] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState("");
  const [busyCustomerKey, setBusyCustomerKey] = useState("");
  const [busyReviewId, setBusyReviewId] = useState("");
  const [merchantPlanCatalog, setMerchantPlanCatalog] = useState(EMPTY_MERCHANT_PLAN_CATALOG);
  const [merchantPlanCatalogStoreId, setMerchantPlanCatalogStoreId] = useState("");
  const [merchantPlanCatalogLoading, setMerchantPlanCatalogLoading] = useState(false);
  const [merchantPlanCatalogError, setMerchantPlanCatalogError] = useState("");
  const ordersRef = useRef([]);
  const ordersSummaryRef = useRef(EMPTY_MERCHANT_ORDER_SUMMARY);
  const ordersPageInfoRef = useRef(EMPTY_MERCHANT_ORDERS_PAGE_INFO);
  const merchantReviewsRef = useRef([]);
  const merchantReviewsPageInfoRef = useRef(EMPTY_MERCHANT_REVIEWS_PAGE_INFO);
  const merchantReviewsRefreshInFlightRef = useRef(false);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    ordersSummaryRef.current = ordersSummary;
  }, [ordersSummary]);

  useEffect(() => {
    ordersPageInfoRef.current = ordersPageInfo;
  }, [ordersPageInfo]);

  useEffect(() => {
    merchantReviewsRef.current = merchantReviews;
  }, [merchantReviews]);

  useEffect(() => {
    merchantReviewsPageInfoRef.current = merchantReviewsPageInfo;
  }, [merchantReviewsPageInfo]);

  function applyMerchantOrdersState(nextOrders, nextSummary = null, nextPageInfo = null) {
    const safeOrders = Array.isArray(nextOrders) ? nextOrders : [];
    const safeSummary =
      nextSummary
      || ordersSummaryRef.current
      || getMerchantSummaryFallback(safeOrders);
    const safePageInfo =
      nextPageInfo
      || ordersPageInfoRef.current
      || EMPTY_MERCHANT_ORDERS_PAGE_INFO;
    ordersRef.current = safeOrders;
    setOrders(safeOrders);
    ordersSummaryRef.current = safeSummary;
    ordersPageInfoRef.current = safePageInfo;
    setOrdersSummary(safeSummary);
    setOrdersPageInfo(safePageInfo);
  }

  function applyMerchantInsightsState(nextSummary = null) {
    const safeSummary =
      nextSummary
      || ordersSummaryRef.current
      || EMPTY_MERCHANT_ORDER_SUMMARY;

    ordersSummaryRef.current = safeSummary;
    setOrdersSummary(safeSummary);
  }

  function applyMerchantReviewsState(nextReviews, nextPageInfo = null) {
    const safeReviews = Array.isArray(nextReviews) ? nextReviews : [];
    const safePageInfo =
      nextPageInfo
      || merchantReviewsPageInfoRef.current
      || EMPTY_MERCHANT_REVIEWS_PAGE_INFO;
    merchantReviewsRef.current = safeReviews;
    merchantReviewsPageInfoRef.current = safePageInfo;
    setMerchantReviews(safeReviews);
    setMerchantReviewsPageInfo(safePageInfo);
  }

  function resetMerchantSessionState() {
    ordersRef.current = [];
    ordersSummaryRef.current = EMPTY_MERCHANT_ORDER_SUMMARY;
    ordersPageInfoRef.current = EMPTY_MERCHANT_ORDERS_PAGE_INFO;
    merchantReviewsRef.current = [];
    merchantReviewsPageInfoRef.current = EMPTY_MERCHANT_REVIEWS_PAGE_INFO;
    setOrders([]);
    setOrdersSummary(EMPTY_MERCHANT_ORDER_SUMMARY);
    setOrdersPageInfo(EMPTY_MERCHANT_ORDERS_PAGE_INFO);
    setOrdersLoading(false);
    setOrdersLoadingMore(false);
    setMerchantReviews([]);
    setMerchantReviewsPageInfo(EMPTY_MERCHANT_REVIEWS_PAGE_INFO);
    setMerchantReviewsLoading(false);
    setMerchantReviewsLoadingMore(false);
    setBusyOrderId("");
    setBusyCustomerKey("");
    setBusyReviewId("");
    setMerchantPlanCatalog(EMPTY_MERCHANT_PLAN_CATALOG);
    setMerchantPlanCatalogStoreId("");
    setMerchantPlanCatalogLoading(false);
    setMerchantPlanCatalogError("");
  }

  function resetMerchantWorkspace() {
    resetMerchantSessionState();
    setStore(STORE_DEFAULTS);
    setProds([]);
    setSid("");
    setTab("inicio");
    setModal(null);
  }

  function replaceCatalogState(nextStore, nextProducts, nextStoreId = sid) {
    setStore(normalizeStore(nextStore || {}));
    setProds(normalizeProducts(nextProducts || []));
    setSid(String(nextStoreId || "").trim());
  }

  function clearCatalogState() {
    setStore(STORE_DEFAULTS);
    setProds([]);
  }

  function applyReviewsOverviewToStore(reviewsOverview) {
    if (!reviewsOverview) return;

    setStore((current) =>
      normalizeStore({
        ...current,
        reviewSummary: reviewsOverview.reviewSummary,
        testimonials: reviewsOverview.testimonials,
        featuredTestimonials: reviewsOverview.featuredTestimonials,
        recentTestimonials: reviewsOverview.recentTestimonials,
      }),
    );
  }

  function syncSessionWithPlanCatalogStore(nextPlanStore, activeSession = sessionRef.current || session) {
    if (typeof setSession !== "function" || !nextPlanStore || !activeSession) {
      return;
    }

    setSession((current) => {
      const baseSession = current || activeSession;
      if (!baseSession) {
        return current;
      }

      const resolvedPlanSnapshot = resolveMerchantPlanSnapshot(baseSession, nextPlanStore);
      const nextStoreName = resolvedPlanSnapshot.storeName || baseSession.storeName || "";
      const nextReferenceId = resolvedPlanSnapshot.referenceId || baseSession.referenceId || "";
      const nextPlanStatus = resolvedPlanSnapshot.planStatus || null;
      const nextPlanExpiresAt = resolvedPlanSnapshot.planExpiresAt || null;

      if (
        baseSession.storeName === nextStoreName
        && (baseSession.referenceId || "") === nextReferenceId
        && (baseSession.planStatus || null) === nextPlanStatus
        && (baseSession.planExpiresAt || null) === nextPlanExpiresAt
      ) {
        return current;
      }

      return {
        ...baseSession,
        storeName: nextStoreName,
        referenceId: nextReferenceId,
        planStatus: nextPlanStatus,
        planExpiresAt: nextPlanExpiresAt,
      };
    });
  }

  async function loadCatalogState(id, options = {}) {
    const { admin = false } = options;
    setSid(id);

    try {
      const response = admin ? await catalogStorage.getAdmin(`cat:${id}`) : await catalogStorage.get(`cat:${id}`);
      if (response) {
        updateSyncStatusFromResponse(response, admin ? "catalogo_admin" : "catalogo_publico");
        const data = JSON.parse(response.value);
        const normalizedStore = normalizeStore(data.s || {});
        const normalizedProducts = normalizeProducts(data.p || []);

        if (shouldHydrateBeautyStarterCatalog(normalizedStore, normalizedProducts)) {
          const starterCatalog = buildBeautyStarterCatalog(normalizedStore, {
            storeName: sessionRef.current?.storeName || session?.storeName || normalizedStore.name,
          });

          try {
            const starterResponse = await catalogStorage.set(
              `cat:${id}`,
              JSON.stringify({
                s: starterCatalog.store,
                p: starterCatalog.products,
              }),
            );
            updateSyncStatusFromResponse(starterResponse, admin ? "catalogo_admin" : "catalogo_publico");
            const savedStarterStore = normalizeStore(starterResponse?.store || starterCatalog.store);
            const savedStarterProducts = normalizeProducts(starterResponse?.products || starterCatalog.products);
            replaceCatalogState(savedStarterStore, savedStarterProducts, id);
            return {
              store: savedStarterStore,
              products: savedStarterProducts,
            };
          } catch (error) {
            replaceCatalogState(starterCatalog.store, starterCatalog.products, id);
            return {
              store: normalizeStore(starterCatalog.store),
              products: normalizeProducts(starterCatalog.products),
            };
          }
        }

        replaceCatalogState(normalizedStore, normalizedProducts, id);
        return {
          store: normalizedStore,
          products: normalizedProducts,
        };
      }

      const starterCatalog = buildBeautyStarterCatalog(
        {
          ...STORE_DEFAULTS,
          name: sessionRef.current?.storeName || session?.storeName || STORE_DEFAULTS.name,
        },
        {
          storeName: sessionRef.current?.storeName || session?.storeName || STORE_DEFAULTS.name,
        },
      );

      try {
        const starterResponse = await catalogStorage.set(
          `cat:${id}`,
          JSON.stringify({
            s: starterCatalog.store,
            p: starterCatalog.products,
          }),
        );
        updateSyncStatusFromResponse(starterResponse, admin ? "catalogo_admin" : "catalogo_publico");
        const savedStarterStore = normalizeStore(starterResponse?.store || starterCatalog.store);
        const savedStarterProducts = normalizeProducts(starterResponse?.products || starterCatalog.products);
        replaceCatalogState(savedStarterStore, savedStarterProducts, id);
        return {
          store: savedStarterStore,
          products: savedStarterProducts,
        };
      } catch (error) {
        replaceCatalogState(starterCatalog.store, starterCatalog.products, id);
        return {
          store: normalizeStore(starterCatalog.store),
          products: normalizeProducts(starterCatalog.products),
        };
      }
    } catch (error) {
      clearCatalogState();
      throw error;
    }
  }

  async function loadMerchantOrders(storeId = sid || session?.storeId || "", options = {}) {
    const activeStoreId = String(storeId || "").trim();
    if (!activeStoreId) {
      return {
        orders: [],
        summary: EMPTY_MERCHANT_ORDER_SUMMARY,
        pageInfo: EMPTY_MERCHANT_ORDERS_PAGE_INFO,
      };
    }

    const response = await orderService.getMerchantOrders(activeStoreId, {
      limit: options.limit || ordersPageInfoRef.current?.limit || ORDERS_PAGE_SIZE,
      cursor: options.cursor || "",
    });
    updateSyncStatusFromResponse(response, "pedidos");
    applyReviewsOverviewToStore(response?.reviewsOverview || null);
    return {
      orders: Array.isArray(response?.orders) ? response.orders : [],
      summary: response?.summary || null,
      pageInfo: response?.pageInfo || EMPTY_MERCHANT_ORDERS_PAGE_INFO,
      reviewsOverview: response?.reviewsOverview || null,
    };
  }

  async function loadMerchantReviews(storeId = sid || session?.storeId || "", options = {}) {
    const activeStoreId = String(storeId || "").trim();
    if (!activeStoreId) {
      return {
        reviews: [],
        pageInfo: EMPTY_MERCHANT_REVIEWS_PAGE_INFO,
        reviewsOverview: null,
      };
    }

    const response = await orderService.getMerchantReviews(activeStoreId, {
      limit: options.limit || merchantReviewsPageInfoRef.current?.limit || REVIEWS_PAGE_SIZE,
      offset: options.offset || 0,
    });
    updateSyncStatusFromResponse(response, "avaliacoes");
    applyReviewsOverviewToStore(response?.reviewsOverview || null);
    return {
      reviews: Array.isArray(response?.reviews) ? response.reviews : [],
      pageInfo: response?.pageInfo || EMPTY_MERCHANT_REVIEWS_PAGE_INFO,
      reviewsOverview: response?.reviewsOverview || null,
    };
  }

  async function refreshMerchantReviews(options = {}) {
    const preserveVisibleCount = options.preserveVisibleCount !== false;
    const silent = options.silent === true;
    const requestedLimit =
      options.limit
      || (preserveVisibleCount
        ? resolveMerchantReviewsRefreshLimit(
          merchantReviewsPageInfoRef.current,
          merchantReviewsRef.current,
        )
        : merchantReviewsPageInfoRef.current?.limit || REVIEWS_PAGE_SIZE);

    if (merchantReviewsRefreshInFlightRef.current) {
      return null;
    }

    merchantReviewsRefreshInFlightRef.current = true;

    if (!silent) {
      setMerchantReviewsLoading(true);
      setMerchantReviewsLoadingMore(false);
    }

    try {
      const nextReviews = await loadMerchantReviews("", {
        limit: requestedLimit,
        offset: 0,
      });
      const mergedReviews = mergeRefreshedMerchantReviews(
        nextReviews.reviews,
        merchantReviewsRef.current,
        nextReviews.pageInfo?.total,
      );
      applyMerchantReviewsState(mergedReviews, {
        ...(nextReviews.pageInfo || EMPTY_MERCHANT_REVIEWS_PAGE_INFO),
        offset: 0,
        hasMore: mergedReviews.length < Math.max(0, Number(nextReviews.pageInfo?.total || 0)),
        nextOffset: mergedReviews.length,
      });

      if (!silent) {
        showToast("Lista de avaliacoes atualizada.");
      }

      return nextReviews;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }

      if (!silent) {
        showToast(error.message || "Não foi possível carregar as avaliações.");
      }

      throw error;
    } finally {
      merchantReviewsRefreshInFlightRef.current = false;

      if (!silent) {
        setMerchantReviewsLoading(false);
      }
    }
  }

  async function loadMerchantPlanOptions(options = {}) {
    const { force = false, silent = false, activeSession = sessionRef.current || session } = options;
    const targetStoreId = String(activeSession?.storeId || "").trim();
    if (!authService.available || !targetStoreId || activeSession?.user?.role === "super_admin") {
      return EMPTY_MERCHANT_PLAN_CATALOG;
    }

    if (!force && merchantPlanCatalogStoreId === targetStoreId) {
      return merchantPlanCatalog;
    }

    setMerchantPlanCatalogLoading(true);
    setMerchantPlanCatalogError("");
    setMerchantPlanCatalogStoreId(targetStoreId);

    try {
      const response = await authService.getMerchantPlanOptions();
      const nextPlanCatalog = {
        store: {
          ...EMPTY_MERCHANT_PLAN_CATALOG.store,
          ...(response?.store || {}),
        },
        activeRequest: response?.activeRequest || null,
        plans: Array.isArray(response?.plans) ? response.plans : [],
      };
      setMerchantPlanCatalog(nextPlanCatalog);
      syncSessionWithPlanCatalogStore(nextPlanCatalog.store, activeSession);
      return response;
    } catch (error) {
      setMerchantPlanCatalogError(error.message || "Não foi possível carregar os planos disponíveis.");
      if (!silent) {
        showToast(error.message || "Não foi possível carregar os planos disponíveis.");
      }
      throw error;
    } finally {
      setMerchantPlanCatalogLoading(false);
    }
  }

  function updateMerchantPlanRequest(request) {
    setMerchantPlanCatalog((current) => ({
      ...current,
      activeRequest: request || null,
    }));
  }

  async function persist(nextStore, nextProds, id) {
    const normalizedStore = normalizeStore(nextStore);
    const normalizedProds = normalizeProducts(nextProds);

    try {
      const response = await catalogStorage.set(
        `cat:${id || sid}`,
        JSON.stringify({
          s: normalizedStore,
          p: normalizedProds,
        }),
      );
      updateSyncStatusFromResponse(response, "catalogo_admin");

      const savedStore = normalizeStore(response?.store || normalizedStore);
      const savedProds = normalizeProducts(response?.products || normalizedProds);
      replaceCatalogState(savedStore, savedProds, id || sid);
      return { store: savedStore, products: savedProds };
    } catch (error) {
      if (authService.available && /sessao|iniciar sessao|autentic/i.test(error.message || "")) {
        handleUnauthorizedSession();
      }

      throw error;
    }
  }

  async function saveStore(nextStore) {
    const previousStore = store;
    try {
      setStore(normalizeStore(nextStore));
      await persist(nextStore, prods);
      showToast("Loja salva com sucesso.");
    } catch (error) {
      setStore(previousStore);
      showToast(error.message || "Não foi possível guardar a loja.");
      throw error;
    }
  }

  async function saveProd(product) {
    const normalized = normalizeProduct(product);
    const inputImagesCount = Array.isArray(normalized.images) ? normalized.images.length : 0;
    const candidate =
      normalized.id || catalogStorage.getStatus().mode === "remote"
        ? normalized
        : { ...normalized, id: createLocalProductId() };
    const nextProducts = candidate.id && prods.some((item) => item.id === candidate.id)
      ? prods.map((item) => (item.id === candidate.id ? candidate : item))
      : [...prods, candidate];
    const previousProducts = prods;

    try {
      if (candidate.id) {
        setProds(nextProducts);
      }
      const response = await persist(store, nextProducts);
      const savedMatch =
        (response?.products || []).find((item) => item.id === candidate.id)
        || (response?.products || []).find((item) => item.name === candidate.name);
      const savedImagesCount = Array.isArray(savedMatch?.images) ? savedMatch.images.length : 0;

      if (savedImagesCount !== inputImagesCount) {
        showToast(`A base confirmou ${savedImagesCount}/${inputImagesCount} fotos. Confere o produto antes de fechar.`);
        return;
      }

      setModal(null);
      showToast(`${normalized.id ? "Produto atualizado" : "Produto adicionado"}${savedImagesCount ? ` com ${savedImagesCount} foto${savedImagesCount === 1 ? "" : "s"}` : ""}.`);
    } catch (error) {
      setProds(previousProducts);
      showToast(error.message || "Não foi possível guardar o produto.");
    }
  }

  async function delProd(id) {
    const nextProducts = prods.filter((item) => item.id !== id);
    const previousProducts = prods;

    try {
      setProds(nextProducts);
      await persist(store, nextProducts);
      showToast("Produto removido.");
    } catch (error) {
      setProds(previousProducts);
      showToast(error.message || "Não foi possível remover o produto.");
    }
  }

  async function handleMerchantPlanActivationRequest(payload) {
    try {
      const response = await authService.requestPlanActivation(payload);
      updateMerchantPlanRequest(response?.request || null);

      if (response?.blockedPlanSelection) {
        showToast(
          response?.locked
            ? "Já tens um pedido em análise. Usa o painel do pagamento para acompanhar ou falar com o suporte."
            : "Já tens um pedido de plano em aberto. Primeiro conclui esse pagamento ou fala com o suporte.",
        );
      } else if (response?.replacedExisting) {
        showToast("Atualizamos o pedido antigo para o novo plano/preco e abrimos o pagamento certo.");
      } else if (response?.duplicate) {
        showToast("Já existia um pedido deste plano. Abrimos o painel do pagamento para continuares.");
      } else {
        showToast("Pedido de plano criado. Segue os dados de pagamento e envia o comprovativo no painel.");
      }

      return response;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Não foi possível registar o pedido de ativação.");
      throw error;
    }
  }

  async function handleMerchantPlanPaymentProofSubmit(payload) {
    try {
      const response = await authService.submitPlanPaymentProof(payload);
      updateMerchantPlanRequest(response?.request || null);
      showToast("Comprovativo enviado. A equipa vai rever antes de ativar o plano.");
      return response;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Não foi possível enviar o comprovativo do plano.");
      throw error;
    }
  }

  async function handleOrdersRefresh() {
    setOrdersLoading(true);
    setOrdersLoadingMore(false);

    try {
      const nextOrders = await loadMerchantOrders("", {
        limit: ordersPageInfoRef.current?.limit || ORDERS_PAGE_SIZE,
      });
      applyMerchantOrdersState(nextOrders.orders, nextOrders.summary, nextOrders.pageInfo);
      showToast("Lista de encomendas atualizada.");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Não foi possível carregar as encomendas.");
    } finally {
      setOrdersLoading(false);
    }
  }

  async function handleOrdersLoadMore() {
    const currentPageInfo = ordersPageInfoRef.current || EMPTY_MERCHANT_ORDERS_PAGE_INFO;
    if (!currentPageInfo.hasMore || !currentPageInfo.endCursor) {
      return;
    }

    setOrdersLoadingMore(true);

    try {
      const nextOrdersPage = await loadMerchantOrders("", {
        limit: currentPageInfo.limit || ORDERS_PAGE_SIZE,
        cursor: currentPageInfo.endCursor,
      });
      const seenOrderIds = new Set(ordersRef.current.map((order) => order.id));
      const mergedOrders = [
        ...ordersRef.current,
        ...nextOrdersPage.orders.filter((order) => !seenOrderIds.has(order.id)),
      ];
      applyMerchantOrdersState(
        mergedOrders,
        nextOrdersPage.summary || ordersSummaryRef.current,
        nextOrdersPage.pageInfo,
      );
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Não foi possível carregar mais encomendas.");
    } finally {
      setOrdersLoadingMore(false);
    }
  }

  async function handleMerchantReviewsRefresh() {
    try {
      await refreshMerchantReviews({
        silent: false,
        preserveVisibleCount: true,
      });
    } catch (error) {
      // O feedback já foi tratado dentro do refresh.
    }
  }

  async function handleMerchantReviewsLoadMore() {
    const currentPageInfo =
      merchantReviewsPageInfoRef.current || EMPTY_MERCHANT_REVIEWS_PAGE_INFO;
    if (!currentPageInfo.hasMore) {
      return;
    }

    setMerchantReviewsLoadingMore(true);

    try {
      const nextReviewsPage = await loadMerchantReviews("", {
        limit: currentPageInfo.limit || REVIEWS_PAGE_SIZE,
        offset: currentPageInfo.nextOffset || 0,
      });
      const seenReviewIds = new Set(merchantReviewsRef.current.map((review) => review.id));
      const mergedReviews = [
        ...merchantReviewsRef.current,
        ...nextReviewsPage.reviews.filter((review) => !seenReviewIds.has(review.id)),
      ];
      applyMerchantReviewsState(mergedReviews, nextReviewsPage.pageInfo);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Não foi possível carregar mais avaliações.");
    } finally {
      setMerchantReviewsLoadingMore(false);
    }
  }

  async function handleOrderStatusChange(orderId, status, options = {}) {
    setBusyOrderId(orderId);

    try {
      const response = await orderService.updateMerchantOrderStatus({
        orderId,
        status,
        storeId: sid || session?.storeId || "",
        statusDurations: options.statusDurations || {},
      });

      const updatedOrder = response?.order;
      if (updatedOrder) {
        const previousOrder = ordersRef.current.find((order) => order.id === updatedOrder.id) || null;
        const nextOrders = ordersRef.current.map((order) => (order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order));
        applyMerchantOrdersState(
          nextOrders,
          patchMerchantSummaryForOrderUpdate(ordersSummaryRef.current, previousOrder, updatedOrder),
          ordersPageInfoRef.current,
        );
      }
      showToast("Estado da encomenda atualizado.");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Não foi possível atualizar o estado da encomenda.");
    } finally {
      setBusyOrderId("");
    }
  }

  async function handleCustomerDiscountSave(orderId, customerKey, discountPercent) {
    const activeCustomerKey = String(customerKey || orderId || "").trim();
    setBusyCustomerKey(activeCustomerKey);

    try {
      const response = await orderService.updateMerchantCustomerDiscount({
        orderId,
        storeId: sid || session?.storeId || "",
        discountPercent,
      });
      const updatedCustomer = response?.customer;
      if (updatedCustomer?.customerKey) {
        const nextOrders = ordersRef.current.map((order) => {
          const orderCustomerKey = order?.customer?.customerKey || order?.customerKey || "";
          if (orderCustomerKey !== updatedCustomer.customerKey) {
            return order;
          }

          return {
            ...order,
            customer: {
              ...(order.customer || {}),
              ...updatedCustomer,
            },
          };
        });
        applyMerchantOrdersState(nextOrders, ordersSummaryRef.current, ordersPageInfoRef.current);
      }
      showToast("Desconto do cliente guardado.");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Não foi possível guardar o desconto do cliente.");
    } finally {
      setBusyCustomerKey("");
    }
  }

  async function handleStoreReviewFeatureToggle(reviewId, featured) {
    const activeReviewId = String(reviewId || "").trim();
    if (!activeReviewId) {
      return;
    }

    setBusyReviewId(activeReviewId);

    try {
      const response = await orderService.updateMerchantStoreReviewFeature({
        reviewId: activeReviewId,
        featured,
        storeId: sid || session?.storeId || "",
      });
      applyReviewsOverviewToStore(response?.reviewsOverview || null);

      if (response?.review?.id) {
        const nextReviews = merchantReviewsRef.current.map((review) =>
          review?.id === response.review.id
            ? {
              ...review,
              ...response.review,
            }
            : review,
        );
        applyMerchantReviewsState(nextReviews, merchantReviewsPageInfoRef.current);

        const nextOrders = ordersRef.current.map((order) => {
          if (order?.review?.id !== response.review.id) {
            return order;
          }

          return {
            ...order,
            review: {
              ...(order.review || {}),
              ...response.review,
            },
          };
        });
        applyMerchantOrdersState(nextOrders, ordersSummaryRef.current, ordersPageInfoRef.current);
      }

      showToast(featured ? "Testemunho fixado na vitrine." : "Testemunho removido dos destaques.");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Não foi possível atualizar este testemunho.");
    } finally {
      setBusyReviewId("");
    }
  }

  useEffect(() => {
    if (screen !== "admin") {
      return;
    }

    const activeSession = sessionRef.current || session;
    const targetStoreId = String(activeSession?.storeId || "").trim();
    if (!authService.available || activeSession?.user?.role === "super_admin" || !targetStoreId) {
      return;
    }

    if (merchantPlanCatalogStoreId === targetStoreId || merchantPlanCatalogLoading) {
      return;
    }

    loadMerchantPlanOptions({
      force: true,
      silent: true,
      activeSession,
    }).catch(() => {});
  }, [screen, session, authService.available, merchantPlanCatalogStoreId, merchantPlanCatalogLoading]);

  useEffect(() => {
    if (screen !== "admin" || tab !== "pedidos" || !(sid || session?.storeId)) {
      return;
    }

    let cancelled = false;
    setOrdersLoading(true);
    setOrdersLoadingMore(false);

    (async () => {
      try {
        const nextOrders = await loadMerchantOrders("", {
          limit: tab === "avaliacoes" ? 100 : ORDERS_PAGE_SIZE,
          cursor: "",
        });
        if (!cancelled) {
          applyMerchantOrdersState(nextOrders.orders, nextOrders.summary, nextOrders.pageInfo);
        }
      } catch (error) {
        if (!cancelled) {
          showToast(error.message || "Não foi possível carregar as encomendas.");
        }
      } finally {
        if (!cancelled) {
          setOrdersLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [screen, tab, sid, session?.storeId]);

  useEffect(() => {
    if (screen !== "admin" || tab !== "avaliacoes" || !(sid || session?.storeId)) {
      return;
    }

    let cancelled = false;
    setMerchantReviewsLoading(true);
    setMerchantReviewsLoadingMore(false);

    (async () => {
      try {
        const nextReviews = await loadMerchantReviews("", {
          limit: REVIEWS_PAGE_SIZE,
          offset: 0,
        });
        if (!cancelled) {
          applyMerchantReviewsState(nextReviews.reviews, nextReviews.pageInfo);
        }
      } catch (error) {
        if (!cancelled) {
          showToast(error.message || "Não foi possível carregar as avaliações.");
        }
      } finally {
        if (!cancelled) {
          setMerchantReviewsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [screen, tab, sid, session?.storeId]);

  useEffect(() => {
    if (screen !== "admin" || tab !== "avaliacoes" || !(sid || session?.storeId)) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (merchantReviewsLoading || merchantReviewsLoadingMore || busyReviewId) {
        return;
      }

      refreshMerchantReviews({
        silent: true,
        preserveVisibleCount: true,
      }).catch((error) => {
        if (error?.status === 401 || error?.status === 403) {
          handleUnauthorizedSession();
        }
      });
    }, MERCHANT_REVIEWS_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    screen,
    tab,
    sid,
    session?.storeId,
    merchantReviewsLoading,
    merchantReviewsLoadingMore,
    busyReviewId,
  ]);

  useEffect(() => {
    if (screen !== "admin" || tab === "pedidos" || tab === "avaliacoes") {
      return;
    }

    const activeStoreId = String(sid || session?.storeId || "").trim();
    if (!activeStoreId) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const insights = await loadMerchantOrders(activeStoreId, {
          limit: 1,
          cursor: "",
        });
        if (!cancelled) {
          applyMerchantInsightsState(insights.summary);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error.status === 401 || error.status === 403) {
          handleUnauthorizedSession();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [screen, tab, sid, session?.storeId]);

  return {
    state: {
      store,
      prods,
      sid,
      tab,
      modal,
      orders,
      ordersSummary,
      ordersLoading,
      ordersPageInfo,
      ordersLoadingMore,
      merchantReviews,
      merchantReviewsLoading,
      merchantReviewsPageInfo,
      merchantReviewsLoadingMore,
      busyOrderId,
      busyCustomerKey,
      busyReviewId,
      merchantPlanCatalog,
      merchantPlanCatalogLoading,
      merchantPlanCatalogError,
      merchantPlanCatalogStoreId,
    },
    actions: {
      setStore,
      setProds,
      setSid,
      setTab,
      setModal,
      applyMerchantOrdersState,
      applyMerchantInsightsState,
      applyMerchantReviewsState,
      replaceCatalogState,
      clearCatalogState,
      loadCatalogState,
      loadMerchantOrders,
      loadMerchantReviews,
      refreshMerchantReviews,
      loadMerchantPlanOptions,
      updateMerchantPlanRequest,
      resetMerchantSessionState,
      resetMerchantWorkspace,
      saveStore,
      saveProd,
      delProd,
      handleOrdersRefresh,
      handleOrdersLoadMore,
      handleMerchantReviewsRefresh,
      handleMerchantReviewsLoadMore,
      handleOrderStatusChange,
      handleCustomerDiscountSave,
      handleStoreReviewFeatureToggle,
      handleMerchantPlanActivationRequest,
      handleMerchantPlanPaymentProofSubmit,
    },
  };
}
