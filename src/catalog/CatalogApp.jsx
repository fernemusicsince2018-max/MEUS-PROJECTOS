import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "./components/common/UiBits.jsx";
import Loading from "./components/system/Loading.jsx";
import Maintenance from "./components/system/Maintenance.jsx";
import NotFound from "./components/system/NotFound.jsx";
import OfflineFallback from "./components/system/OfflineFallback.jsx";
import RuntimeConfigRequired from "./components/system/RuntimeConfigRequired.jsx";
import { catalogStorage } from "./services/catalogStorage.js";
import { createAuthService } from "./services/authService.js";
import { createOrderService } from "./services/orderService.js";
import { getRuntimeConfig } from "./services/runtimeConfig.js";
import { useAppShellController } from "./controllers/useAppShellController.js";
import { useAppPresentationController } from "./controllers/useAppPresentationController.js";
import { useMerchantController } from "./controllers/useMerchantController.js";
import { usePublicController } from "./controllers/usePublicController.js";
import { useSuperAdminController } from "./controllers/useSuperAdminController.js";

const AuthRoute = lazy(() => import("./routes/merchant/AuthRoute.jsx"));
const MerchantAppRoute = lazy(() => import("./routes/merchant/MerchantAppRoute.jsx"));
const PublicHomeRoute = lazy(() => import("./routes/public/PublicHomeRoute.jsx"));
const PublicCatalogRoute = lazy(() => import("./routes/public/PublicCatalogRoute.jsx"));
const OrderTrackingRoute = lazy(() => import("./routes/public/OrderTrackingRoute.jsx"));
const BlockedCatalogRoute = lazy(() => import("./routes/public/BlockedCatalogRoute.jsx"));
const SuperAdminRoute = lazy(() => import("./routes/superadmin/SuperAdminRoute.jsx"));

const genId = () => Math.random().toString(36).slice(2, 9);

function buildOfflineView(kind) {
  const views = {
    merchantApp: {
      title: "Este painel ainda nao abre offline",
      message: "O teu telemovel ainda nao guardou uma sessao valida para entrares sem internet.",
      hint: "Assim que entrares online no painel, a proxima abertura fica muito mais preparada para acontecer offline.",
    },
    publicCatalog: {
      title: "Esta vitrine ainda nao ficou guardada",
      message: "Para abrir esta loja sem rede, este telemovel precisa de a ter visitado pelo menos uma vez online.",
      hint: "Assim que a vitrine carregar com internet, a copia local fica pronta para uma proxima abertura offline.",
    },
    tracking: {
      title: "Este tracking ainda nao ficou guardado",
      message: "Ainda nao existe uma copia local deste pedido neste dispositivo.",
      hint: "Quando voltares a ter internet, abre de novo o link para deixar o estado pronto para consulta offline.",
    },
    superadmin: {
      title: "Esta area precisa de internet",
      message: "O painel super admin ainda nao tem uma copia local pronta neste telemovel.",
      hint: "Abre esta area online sempre que precisares de a consultar mais tarde fora de rede.",
    },
    default: {
      title: "Sem ligacao agora",
      message: "Esta area precisa de internet ou de uma copia local ja guardada para abrir bem.",
      hint: "Volta a tentar quando a ligacao estiver estavel.",
    },
  };

  return views[kind] || views.default;
}

export default function CatalogApp() {
  const [toast, setToast] = useState("");
  const toastTimer = useRef();
  const merchantBridgeRef = useRef(null);
  const publicBridgeRef = useRef(null);
  const superAdminBridgeRef = useRef(null);
  const storageStatus = catalogStorage.getStatus();
  const runtimeConfig = useMemo(() => getRuntimeConfig(), []);
  const authService = useMemo(() => createAuthService(runtimeConfig), [runtimeConfig]);
  const orderService = useMemo(() => createOrderService(runtimeConfig), [runtimeConfig]);

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  const { state: shellState, actions: shellActions } = useAppShellController({
    authService,
    catalogStorage,
    runtimeConfig,
    merchantBridgeRef,
    publicBridgeRef,
    superAdminBridgeRef,
    showToast,
    buildOfflineView,
    createAnonymousStoreId: genId,
  });

  const {
    screen,
    session,
    authBusy,
    offlineState,
    isOnline,
    syncStatus,
    sessionRef,
  } = shellState;

  const merchantController = useMerchantController({
    authService,
    orderService,
    catalogStorage,
    session,
    sessionRef,
    screen,
    handleUnauthorizedSession: shellActions.handleUnauthorizedSession,
    showToast,
    updateSyncStatusFromResponse: shellActions.updateSyncStatusFromResponse,
  });
  const publicController = usePublicController({
    orderService,
    session,
    sessionRef,
    store: merchantController.state.store,
    prods: merchantController.state.prods,
    sid: merchantController.state.sid,
    showToast,
    showOfflineRoute: shellActions.showOfflineRoute,
    updateSyncStatusFromResponse: shellActions.updateSyncStatusFromResponse,
    getActiveSessionFromRuntime: shellActions.getActiveSessionFromRuntime,
    loadCatalogState: merchantController.actions.loadCatalogState,
    replaceCatalogState: merchantController.actions.replaceCatalogState,
    navigateToPath: shellActions.navigateToPath,
    setSession: shellActions.setSession,
    setScreen: shellActions.setScreen,
    setOfflineState: shellActions.setOfflineState,
  });
  const superAdminController = useSuperAdminController({
    authService,
    session,
    setSession: shellActions.setSession,
    sessionRef,
    updateSyncStatusFromResponse: shellActions.updateSyncStatusFromResponse,
    handleUnauthorizedSession: shellActions.handleUnauthorizedSession,
    showToast,
    setScreen: shellActions.setScreen,
    setCatalogMode: publicController.actions.setCatalogMode,
  });

  merchantBridgeRef.current = merchantController;
  publicBridgeRef.current = publicController;
  superAdminBridgeRef.current = superAdminController;

  const { state: merchantState, actions: merchantActions } = merchantController;
  const { state: publicState, actions: publicActions } = publicController;
  const { state: superAdminState, actions: superAdminActions } = superAdminController;

  const {
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
  } = merchantState;
  const {
    catalogMode,
    cart,
    cartOpen,
    checkoutBusy,
    orderReceipt,
    trackedOrder,
    trackingLoading,
    trackingError,
    search,
    orderMeta,
    blockedCatalog,
    cartTotal,
    cartCount,
    filtered,
  } = publicState;
  const { superAdminBusy, superAdminData, superAdminTab } = superAdminState;

  const { state: presentationState, actions: presentationActions } = useAppPresentationController({
    runtimeBrand: runtimeConfig.brand,
    runtimeConfig,
    store,
    sid,
    screen,
    tab,
    superAdminTab,
    catalogMode,
    trackedOrder,
    trackingError,
    session,
    blockedCatalog,
    offlineState,
    cartCount,
    isOnline,
    storageStatus,
    syncStatus,
    resetOrderExperience: publicActions.resetOrderExperience,
    setCatalogMode: publicActions.setCatalogMode,
    navigateToPath: shellActions.navigateToPath,
    setScreen: shellActions.setScreen,
  });
  const { brand, catUrl, connectionState } = presentationState;
  const toastNode = toast ? <Toast msg={toast} /> : null;

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
    },
    [],
  );

  function renderLazyRoute(node) {
    return <Suspense fallback={<Loading />}>{node}</Suspense>;
  }

  if (screen === "loading") return <Loading />;
  if (screen === "maintenance") return <Maintenance />;
  if (screen === "config-required") {
    return <RuntimeConfigRequired message={runtimeConfig.apiRequiredMessage} />;
  }
  if (screen === "offline") {
    return (
      <OfflineFallback
        brand={runtimeConfig.brand}
        title={offlineState?.title}
        message={offlineState?.message}
        hint={offlineState?.hint}
        onRetry={shellActions.retryCurrentLocation}
      />
    );
  }
  if (screen === "tracking") {
    return renderLazyRoute(
      <OrderTrackingRoute
        order={trackedOrder}
        loading={trackingLoading}
        error={trackingError}
        onBackToStore={publicActions.handleBackToTrackedStore}
      />,
    );
  }
  if (screen === "blocked") {
    return renderLazyRoute(
      <BlockedCatalogRoute
        platformBrand={runtimeConfig.brand}
        store={blockedCatalog.store}
        message={blockedCatalog.message || "Esta loja esta temporariamente bloqueada para clientes porque o plano nao esta ativo."}
        planStatus={blockedCatalog.planStatus}
        planExpiresAt={blockedCatalog.planExpiresAt}
        onRetry={() => window.location.reload()}
      />,
    );
  }
  if (screen === "notfound") return <NotFound />;

  if (screen === "home") {
    return renderLazyRoute(
      <PublicHomeRoute
        brand={runtimeConfig.brand}
        hasActiveSession={Boolean(session)}
        sessionRole={session?.user?.role || ""}
      />,
    );
  }

  if (screen === "auth") {
    return renderLazyRoute(
      <AuthRoute
        brand={runtimeConfig.brand}
        busy={authBusy}
        onLogin={shellActions.handleLogin}
        onRegister={shellActions.handleRegister}
        onRequestPasswordReset={shellActions.handleRequestPasswordReset}
        onResetPassword={shellActions.handleResetPassword}
      />,
    );
  }

  if (screen === "catalog") {
    return renderLazyRoute(
      <PublicCatalogRoute
        brand={brand}
        mode={catalogMode}
        store={store}
        prods={filtered}
        cart={cart}
        cartCount={cartCount}
        cartTotal={cartTotal}
        cartOpen={cartOpen}
        setCartOpen={publicActions.setCartOpen}
        search={search}
        setSearch={publicActions.setSearch}
        orderMeta={orderMeta}
        setOrderMeta={publicActions.setOrderMeta}
        onAdd={publicActions.addCart}
        onUpd={publicActions.updCart}
        onCheckout={publicActions.checkout}
        checkoutBusy={checkoutBusy}
        orderReceipt={orderReceipt}
        onCloseOrderReceipt={() => publicActions.setOrderReceipt(null)}
        onTrackOrderReceipt={publicActions.handleTrackReceipt}
        onOpenReceiptWhatsApp={publicActions.handleOpenReceiptWhatsApp}
        toast={toast}
        toastNode={toastNode}
        onBack={publicActions.navigateBackFromCatalog}
      />,
    );
  }

  if (screen === "superadmin") {
    return renderLazyRoute(
      <SuperAdminRoute
        brand={runtimeConfig.brand}
        session={session}
        data={superAdminData}
        tab={superAdminTab}
        setTab={superAdminActions.setSuperAdminTab}
        onClientsQueryChange={superAdminActions.handleSuperAdminClientsQueryChange}
        onLoadMoreClients={superAdminActions.handleSuperAdminLoadMoreClients}
        onTrashedClientsQueryChange={superAdminActions.handleSuperAdminTrashedQueryChange}
        onLoadMoreTrashedClients={superAdminActions.handleSuperAdminLoadMoreTrashedClients}
        onLoadMoreFinancialEvents={superAdminActions.handleSuperAdminLoadMoreFinancialEvents}
        onLogout={authService.available ? shellActions.handleLogout : null}
        onRefresh={superAdminActions.handleSuperAdminRefresh}
        onSaveClient={superAdminActions.handleSuperAdminClientSave}
        onSaveAdminUser={superAdminActions.handleSuperAdminAdminUserSave}
        onClientLifecycle={superAdminActions.handleSuperAdminClientLifecycle}
        onSavePlan={superAdminActions.handleSuperAdminPlanSave}
        onSaveSetting={superAdminActions.handleSuperAdminSettingSave}
        onReviewPlanRequest={superAdminActions.handleSuperAdminPlanRequestReview}
        busy={superAdminBusy}
        toast={showToast}
        toastNode={toastNode}
      />,
    );
  }

  return renderLazyRoute(
    <MerchantAppRoute
      brand={brand}
      store={store}
      prods={prods}
      orders={orders}
      ordersSummary={ordersSummary}
      ordersLoading={ordersLoading}
      ordersPageInfo={ordersPageInfo}
      ordersLoadingMore={ordersLoadingMore}
      busyOrderId={busyOrderId}
      busyCustomerKey={busyCustomerKey}
      catUrl={catUrl}
      tab={tab}
      setTab={merchantActions.setTab}
      modal={modal}
      setModal={merchantActions.setModal}
      onSaveStore={merchantActions.saveStore}
      onSaveProd={merchantActions.saveProd}
      onDel={merchantActions.delProd}
      onPreview={presentationActions.handleMerchantPreview}
      onOrdersRefresh={merchantActions.handleOrdersRefresh}
      onOrdersLoadMore={merchantActions.handleOrdersLoadMore}
      onOrderStatusChange={merchantActions.handleOrderStatusChange}
      onCustomerDiscountSave={merchantActions.handleCustomerDiscountSave}
      planCatalog={merchantPlanCatalog}
      planCatalogLoading={merchantPlanCatalogLoading}
      planCatalogError={merchantPlanCatalogError}
      onPlanActivationRequest={merchantActions.handleMerchantPlanActivationRequest}
      onPlanPaymentProofSubmit={merchantActions.handleMerchantPlanPaymentProofSubmit}
      onOpenPlans={() => {
        merchantActions.setTab("planos");
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
        }
        merchantActions.loadMerchantPlanOptions({
          force: merchantPlanCatalog.store?.id !== String(session?.storeId || "").trim(),
        }).catch(() => {});
      }}
      onRefreshPlans={() => merchantActions.loadMerchantPlanOptions({ force: true })}
      onLogout={authService.available ? shellActions.handleLogout : null}
      session={session}
      toast={toast}
      toastNode={toastNode}
      storageStatus={storageStatus}
      connectionState={connectionState}
    />,
  );
}
