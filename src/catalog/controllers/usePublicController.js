import { useEffect, useMemo, useState } from "react";
import { normalizeStore, buildWaMsg, getMaxQty } from "../utils/catalog.js";
import { getCanonicalCountry, getCountryRegionLabel, getCountryRegions } from "../utils/countryRegions.js";
import { isLikelyOfflineError } from "../utils/network.js";
import { getOrderValidationError } from "../utils/orderOptions.js";
import { buildOrderTrackingUrl } from "../utils/orders.js";
import {
  buildMerchantAppPath,
  buildPublicCatalogPath,
  buildRootPath,
  buildSuperAdminPath,
  buildTrackingPath,
} from "../utils/appRoutes.js";
import { EMPTY_BLOCKED_CATALOG, EMPTY_ORDER_META } from "./controllerState.js";

export function usePublicController({
  orderService,
  session,
  sessionRef,
  store,
  prods,
  sid,
  showToast,
  showOfflineRoute,
  updateSyncStatusFromResponse,
  getActiveSessionFromRuntime,
  loadCatalogState,
  replaceCatalogState,
  navigateToPath,
  setSession,
  setScreen,
  setOfflineState,
}) {
  const [catalogMode, setCatalogMode] = useState("preview");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [orderReceipt, setOrderReceipt] = useState(null);
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const [activeTrackingToken, setActiveTrackingToken] = useState("");
  const [search, setSearch] = useState("");
  const [orderMeta, setOrderMeta] = useState(EMPTY_ORDER_META);
  const [blockedCatalog, setBlockedCatalog] = useState(EMPTY_BLOCKED_CATALOG);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart],
  );
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return prods.filter((product) => {
      if (!query) return true;
      const haystack = [product.name, product.description, product.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [prods, search]);

  function resetOrderExperience() {
    setSearch("");
    setCart([]);
    setCartOpen(false);
    setOrderMeta(EMPTY_ORDER_META);
    setOrderReceipt(null);
  }

  function resetPublicDomain() {
    setCatalogMode("preview");
    setCart([]);
    setCartOpen(false);
    setCheckoutBusy(false);
    setOrderReceipt(null);
    setTrackedOrder(null);
    setTrackingLoading(false);
    setTrackingError("");
    setActiveTrackingToken("");
    setSearch("");
    setOrderMeta(EMPTY_ORDER_META);
    setBlockedCatalog(EMPTY_BLOCKED_CATALOG);
  }

  async function openPublicCatalog(storeId) {
    setTrackedOrder(null);
    setTrackingError("");
    setBlockedCatalog(EMPTY_BLOCKED_CATALOG);
    setOfflineState(null);

    try {
      await loadCatalogState(storeId, { admin: false });
      setCatalogMode("public");
      setScreen("catalog");
    } catch (error) {
      if (error?.status === 503) {
        setScreen("maintenance");
        return;
      }

      if (error?.status === 403) {
        const blockedStore = normalizeStore(error?.payload?.store || {});
        replaceCatalogState(blockedStore, [], storeId);
        setBlockedCatalog({
          message: error.message || "Esta loja esta temporariamente bloqueada para clientes porque o plano nao esta ativo.",
          store: blockedStore,
          planStatus: error?.payload?.planStatus || "",
          planExpiresAt: error?.payload?.planExpiresAt || "",
        });
        setScreen("blocked");
        return;
      }

      if (isLikelyOfflineError(error)) {
        showOfflineRoute("publicCatalog");
        return;
      }

      setScreen("notfound");
    }
  }

  async function loadTrackedOrder(token, options = {}) {
    const { silent = false } = options;
    if (!silent) {
      setTrackingLoading(true);
      setTrackingError("");
      setTrackedOrder(null);
      setScreen("tracking");
    }
    setActiveTrackingToken(token);

    try {
      const response = await orderService.getTrackedOrder(token);
      updateSyncStatusFromResponse(response, "tracking");
      if (!silent) {
        setOfflineState(null);
      }
      setTrackedOrder(response?.order || null);
      return response?.order || null;
    } catch (error) {
      if (!silent) {
        setTrackingError(
          isLikelyOfflineError(error)
            ? "Sem ligacao e sem uma copia local desta encomenda neste dispositivo."
            : error.message || "Nao foi possivel acompanhar a encomenda.",
        );
        setTrackedOrder(null);
      }
      return null;
    } finally {
      if (!silent) {
        setTrackingLoading(false);
      }
    }
  }

  async function openCatalogFromRoute(storeId, options = {}) {
    const { preview = false } = options;

    resetOrderExperience();
    setTrackedOrder(null);
    setTrackingError("");

    if (preview) {
      const activeSession = await getActiveSessionFromRuntime();
      const canPreviewOwnStore =
        activeSession?.user?.role !== "super_admin"
        && String(activeSession?.storeId || "").trim() === String(storeId || "").trim();

      if (canPreviewOwnStore) {
        sessionRef.current = activeSession;
        setSession(activeSession);
        await loadCatalogState(storeId, { admin: true });
        setCatalogMode("preview");
        setScreen("catalog");
        return;
      }

      navigateToPath(buildPublicCatalogPath(storeId), { replace: true });
    }

    await openPublicCatalog(storeId);
  }

  function addCart(product) {
    const fresh = prods.find((item) => item.id === product.id) || product;
    const maxQty = getMaxQty(fresh);

    if (maxQty < 1) {
      showToast("Este produto nao esta disponivel agora.");
      return;
    }

    const existing = cart.find((item) => item.id === fresh.id);
    const currentQty = existing?.qty || 0;

    if (currentQty >= maxQty) {
      showToast("Ja chegaste ao limite deste produto.");
      return;
    }

    const nextCart = existing
      ? cart.map((item) => (item.id === fresh.id ? { ...fresh, qty: item.qty + 1 } : item))
      : [...cart, { ...fresh, qty: 1 }];

    setCart(nextCart);
    showToast(`${fresh.name} adicionado ao carrinho.`);
  }

  function updCart(id, qty) {
    const fresh = prods.find((product) => product.id === id);
    if (!fresh) {
      setCart(cart.filter((item) => item.id !== id));
      return;
    }

    const maxQty = getMaxQty(fresh);
    const nextQty = Math.min(qty, maxQty);
    const nextCart =
      nextQty < 1
        ? cart.filter((item) => item.id !== id)
        : cart.map((item) => (item.id === id ? { ...fresh, qty: nextQty } : item));

    setCart(nextCart);
  }

  async function checkout() {
    const phone = store.whatsapp?.replace(/\D/g, "");
    const canonicalCountry = getCanonicalCountry(store.country);
    const regionOptions = getCountryRegions(canonicalCountry);
    const regionLabel = regionOptions.length > 0 ? getCountryRegionLabel(canonicalCountry) : "Provincia / Estado / Regiao";
    const orderValidationError = getOrderValidationError(orderMeta, regionLabel);

    if (!phone) {
      showToast("Configura o WhatsApp da loja primeiro.");
      return;
    }

    if (orderValidationError) {
      showToast(orderValidationError);
      return;
    }

    if (!cart.length) return;
    const popup = window.open("", "_blank");
    setCheckoutBusy(true);

    try {
      const response = await orderService.createOrder({
        storeId: sid,
        customerName: orderMeta.customerName,
        customerPhone: orderMeta.customerPhone,
        fulfillmentType: orderMeta.fulfillmentType,
        region: orderMeta.province,
        area: orderMeta.area,
        pickupTime: orderMeta.pickupTime,
        deliveryTime: orderMeta.deliveryTime,
        notes: orderMeta.notes,
        items: cart.map((item) => ({
          id: item.id,
          qty: item.qty,
        })),
      });

      const createdOrder = response?.order;
      if (!createdOrder?.trackingToken || !createdOrder?.trackingCode) {
        throw new Error("Nao foi possivel preparar o acompanhamento do pedido.");
      }

      const trackingUrl = buildOrderTrackingUrl(createdOrder.trackingToken);
      const whatsappUrl = `https://wa.me/${phone}?text=${buildWaMsg(store, cart, orderMeta, {
        trackingCode: createdOrder.trackingCode,
        trackingUrl,
        customerPhone: createdOrder.customerPhone,
        subtotalAmount: createdOrder.subtotalAmount,
        discountPercent: createdOrder.discountPercent,
        discountAmount: createdOrder.discountAmount,
        totalAmount: createdOrder.totalAmount,
      })}`;
      const merchantNotification = response?.merchantNotification || null;
      const queuedByCloudApi = merchantNotification?.channel === "whatsapp_cloud_api" && merchantNotification?.queued;
      const deliveredByCloudApi = merchantNotification?.channel === "whatsapp_cloud_api" && merchantNotification?.delivered;

      if (deliveredByCloudApi || queuedByCloudApi) {
        if (popup && !popup.closed) {
          popup.close();
        }
      } else if (popup) {
        popup.location.href = whatsappUrl;
      } else {
        window.open(whatsappUrl, "_blank");
      }

      setOrderReceipt({
        order: createdOrder,
        trackingUrl,
        whatsappUrl,
        merchantNotification,
      });
      setCart([]);
      setCartOpen(false);
      setOrderMeta(EMPTY_ORDER_META);
      if (deliveredByCloudApi) {
        showToast(`Pedido ${createdOrder.trackingCode} criado e enviado ao WhatsApp do lojista.`);
      } else if (queuedByCloudApi) {
        showToast(`Pedido ${createdOrder.trackingCode} criado. O lojista sera notificado automaticamente.`);
      } else if (merchantNotification?.attempted && !merchantNotification?.delivered) {
        showToast(`Pedido ${createdOrder.trackingCode} criado. Abrimos o WhatsApp como alternativa.`);
      } else {
        showToast(`Pedido ${createdOrder.trackingCode} criado com sucesso.`);
      }
    } catch (error) {
      if (popup && !popup.closed) {
        popup.close();
      }
      showToast(error.message || "Nao foi possivel criar o pedido.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function handleTrackReceipt() {
    const token = orderReceipt?.order?.trackingToken;
    if (!token) return;

    setOrderReceipt(null);
    navigateToPath(buildTrackingPath(token));
    await loadTrackedOrder(token);
  }

  function handleOpenReceiptWhatsApp() {
    const whatsappUrl = orderReceipt?.whatsappUrl;
    if (!whatsappUrl) return;
    window.open(whatsappUrl, "_blank");
  }

  async function handleBackToTrackedStore() {
    const storeId = trackedOrder?.store?.id || trackedOrder?.storeId;
    if (!storeId) {
      navigateToPath(buildRootPath(), { replace: true });
      setScreen("notfound");
      return;
    }

    navigateToPath(buildPublicCatalogPath(storeId));
    await openCatalogFromRoute(storeId);
  }

  function navigateBackFromCatalog() {
    resetOrderExperience();
    setCatalogMode("preview");
    if (session?.user?.role === "super_admin") {
      navigateToPath(buildSuperAdminPath());
      setScreen("superadmin");
      return;
    }

    navigateToPath(buildMerchantAppPath());
    setScreen("admin");
  }

  useEffect(() => {
    setCart((previous) =>
      previous.flatMap((item) => {
        const fresh = prods.find((product) => product.id === item.id);
        if (!fresh) return [];

        const maxQty = getMaxQty(fresh);
        if (maxQty < 1) return [];

        return [{ ...fresh, qty: Math.min(item.qty, maxQty) }];
      }),
    );
  }, [prods]);

  useEffect(() => {
    if (screen !== "tracking" || !activeTrackingToken) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadTrackedOrder(activeTrackingToken, { silent: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [screen, activeTrackingToken]);

  return {
    state: {
      catalogMode,
      cart,
      cartOpen,
      checkoutBusy,
      orderReceipt,
      trackedOrder,
      trackingLoading,
      trackingError,
      activeTrackingToken,
      search,
      orderMeta,
      blockedCatalog,
      cartTotal,
      cartCount,
      filtered,
    },
    actions: {
      setCatalogMode,
      setCart,
      setCartOpen,
      setOrderReceipt,
      setSearch,
      setOrderMeta,
      setTrackedOrder,
      setTrackingError,
      resetOrderExperience,
      resetPublicDomain,
      openPublicCatalog,
      loadTrackedOrder,
      openCatalogFromRoute,
      addCart,
      updCart,
      checkout,
      handleTrackReceipt,
      handleOpenReceiptWhatsApp,
      handleBackToTrackedStore,
      navigateBackFromCatalog,
      setBlockedCatalog,
    },
  };
}
