import { useEffect, useRef, useState } from "react";
import { STORE_DEFAULTS } from "../constants.js";
import { normalizeProduct, normalizeProducts, normalizeStore } from "../utils/catalog.js";
import { buildMerchantOrderSummary, EMPTY_MERCHANT_ORDER_SUMMARY } from "../../../shared/orderAnalytics.js";
import { EMPTY_MERCHANT_ORDERS_PAGE_INFO } from "../../../shared/merchantOrdersPagination.js";
import { EMPTY_MERCHANT_PLAN_CATALOG } from "./controllerState.js";

const ORDERS_PAGE_SIZE = EMPTY_MERCHANT_ORDERS_PAGE_INFO.limit;

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
  sessionRef,
  screen,
  handleUnauthorizedSession,
  showToast,
  updateSyncStatusFromResponse,
}) {
  const [store, setStore] = useState(STORE_DEFAULTS);
  const [prods, setProds] = useState([]);
  const [sid, setSid] = useState("");
  const [tab, setTab] = useState("loja");
  const [modal, setModal] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersSummary, setOrdersSummary] = useState(EMPTY_MERCHANT_ORDER_SUMMARY);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPageInfo, setOrdersPageInfo] = useState(EMPTY_MERCHANT_ORDERS_PAGE_INFO);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState("");
  const [busyCustomerKey, setBusyCustomerKey] = useState("");
  const [merchantPlanCatalog, setMerchantPlanCatalog] = useState(EMPTY_MERCHANT_PLAN_CATALOG);
  const [merchantPlanCatalogStoreId, setMerchantPlanCatalogStoreId] = useState("");
  const [merchantPlanCatalogLoading, setMerchantPlanCatalogLoading] = useState(false);
  const [merchantPlanCatalogError, setMerchantPlanCatalogError] = useState("");
  const ordersRef = useRef([]);
  const ordersSummaryRef = useRef(EMPTY_MERCHANT_ORDER_SUMMARY);
  const ordersPageInfoRef = useRef(EMPTY_MERCHANT_ORDERS_PAGE_INFO);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    ordersSummaryRef.current = ordersSummary;
  }, [ordersSummary]);

  useEffect(() => {
    ordersPageInfoRef.current = ordersPageInfo;
  }, [ordersPageInfo]);

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

  function resetMerchantSessionState() {
    ordersRef.current = [];
    ordersSummaryRef.current = EMPTY_MERCHANT_ORDER_SUMMARY;
    ordersPageInfoRef.current = EMPTY_MERCHANT_ORDERS_PAGE_INFO;
    setOrders([]);
    setOrdersSummary(EMPTY_MERCHANT_ORDER_SUMMARY);
    setOrdersPageInfo(EMPTY_MERCHANT_ORDERS_PAGE_INFO);
    setOrdersLoading(false);
    setOrdersLoadingMore(false);
    setBusyOrderId("");
    setBusyCustomerKey("");
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
    setTab("loja");
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

  async function loadCatalogState(id, options = {}) {
    const { admin = false } = options;
    setSid(id);

    try {
      const response = admin ? await catalogStorage.getAdmin(`cat:${id}`) : await catalogStorage.get(`cat:${id}`);
      if (response) {
        updateSyncStatusFromResponse(response, admin ? "catalogo_admin" : "catalogo_publico");
        const data = JSON.parse(response.value);
        replaceCatalogState(data.s || {}, data.p || [], id);
        return {
          store: normalizeStore(data.s || {}),
          products: normalizeProducts(data.p || []),
        };
      }

      clearCatalogState();
      return {
        store: STORE_DEFAULTS,
        products: [],
      };
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
    return {
      orders: Array.isArray(response?.orders) ? response.orders : [],
      summary: response?.summary || null,
      pageInfo: response?.pageInfo || EMPTY_MERCHANT_ORDERS_PAGE_INFO,
    };
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
      setMerchantPlanCatalog({
        store: {
          ...EMPTY_MERCHANT_PLAN_CATALOG.store,
          ...(response?.store || {}),
        },
        activeRequest: response?.activeRequest || null,
        plans: Array.isArray(response?.plans) ? response.plans : [],
      });
      return response;
    } catch (error) {
      setMerchantPlanCatalogError(error.message || "Nao foi possivel carregar os planos disponiveis.");
      if (!silent) {
        showToast(error.message || "Nao foi possivel carregar os planos disponiveis.");
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
      showToast(error.message || "Nao foi possivel guardar a loja.");
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
      showToast(error.message || "Nao foi possivel guardar o produto.");
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
      showToast(error.message || "Nao foi possivel remover o produto.");
    }
  }

  async function handleMerchantPlanActivationRequest(payload) {
    try {
      const response = await authService.requestPlanActivation(payload);
      updateMerchantPlanRequest(response?.request || null);

      if (response?.blockedPlanSelection) {
        showToast(
          response?.locked
            ? "Ja tens um pedido em analise. Usa o painel do pagamento para acompanhar ou falar com o suporte."
            : "Ja tens um pedido de plano em aberto. Primeiro conclui esse pagamento ou fala com o suporte.",
        );
      } else if (response?.duplicate) {
        showToast("Ja existia um pedido deste plano. Abrimos o painel do pagamento para continuares.");
      } else {
        showToast("Pedido de plano criado. Segue os dados de pagamento e envia o comprovativo no painel.");
      }

      return response;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Nao foi possivel registar o pedido de ativacao.");
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
      showToast(error.message || "Nao foi possivel enviar o comprovativo do plano.");
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
      showToast(error.message || "Nao foi possivel carregar as encomendas.");
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
      showToast(error.message || "Nao foi possivel carregar mais encomendas.");
    } finally {
      setOrdersLoadingMore(false);
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
      showToast(error.message || "Nao foi possivel atualizar o estado da encomenda.");
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
      showToast(error.message || "Nao foi possivel guardar o desconto do cliente.");
    } finally {
      setBusyCustomerKey("");
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
        const nextOrders = await loadMerchantOrders("", { limit: ORDERS_PAGE_SIZE, cursor: "" });
        if (!cancelled) {
          applyMerchantOrdersState(nextOrders.orders, nextOrders.summary, nextOrders.pageInfo);
        }
      } catch (error) {
        if (!cancelled) {
          showToast(error.message || "Nao foi possivel carregar as encomendas.");
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
      busyOrderId,
      busyCustomerKey,
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
      replaceCatalogState,
      clearCatalogState,
      loadCatalogState,
      loadMerchantOrders,
      loadMerchantPlanOptions,
      updateMerchantPlanRequest,
      resetMerchantSessionState,
      resetMerchantWorkspace,
      saveStore,
      saveProd,
      delProd,
      handleOrdersRefresh,
      handleOrdersLoadMore,
      handleOrderStatusChange,
      handleCustomerDiscountSave,
      handleMerchantPlanActivationRequest,
      handleMerchantPlanPaymentProofSubmit,
    },
  };
}
