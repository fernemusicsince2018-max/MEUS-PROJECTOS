import { useEffect, useRef, useState } from "react";
import {
  buildAuthPath,
  buildMerchantAppPath,
  buildSuperAdminPath,
  readAppRoute,
  updateBrowserLocation,
} from "../utils/appRoutes.js";
import { isLikelyOfflineError, isNavigatorOnline } from "../utils/network.js";

const INITIAL_SYNC_STATUS = {
  mode: "live",
  timestamp: "",
  source: "",
};

function getActions(ref) {
  return ref?.current?.actions || {};
}

export function useAppShellController({
  authService,
  catalogStorage,
  runtimeConfig,
  merchantBridgeRef,
  publicBridgeRef,
  superAdminBridgeRef,
  showToast,
  buildOfflineView,
  createAnonymousStoreId,
}) {
  const [screen, setScreen] = useState("loading");
  const [session, setSession] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [offlineState, setOfflineState] = useState(null);
  const [isOnline, setIsOnline] = useState(() => isNavigatorOnline());
  const [syncStatus, setSyncStatus] = useState(INITIAL_SYNC_STATUS);
  const sessionRef = useRef(null);
  const sessionLoadErrorRef = useRef(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  function updateSyncStatusFromResponse(response, source) {
    if (!source || !response) return;

    if (response.offlineFallback) {
      setSyncStatus({
        mode: "cached",
        timestamp: response.cachedAt || "",
        source,
      });
      return;
    }

    if (response.syncedAt) {
      setSyncStatus({
        mode: "live",
        timestamp: response.syncedAt || "",
        source,
      });
    }
  }

  function navigateToPath(path, options = {}) {
    updateBrowserLocation(path, options);
  }

  function moveToAuthScreen(options = {}) {
    const search = options.keepSearch && typeof window !== "undefined" ? window.location.search : "";
    navigateToPath(`${buildAuthPath()}${search}`, { replace: options.replace });
    setScreen("auth");
  }

  function showOfflineRoute(kind) {
    setOfflineState(buildOfflineView(kind));
    setScreen("offline");
  }

  function handleUnauthorizedSession() {
    sessionRef.current = null;
    setSession(null);
    setOfflineState(null);
    setSyncStatus(INITIAL_SYNC_STATUS);
    getActions(merchantBridgeRef).resetMerchantSessionState?.();
    getActions(publicBridgeRef).resetPublicDomain?.();
    getActions(superAdminBridgeRef).resetSuperAdminDomain?.();
    moveToAuthScreen({ replace: true });
  }

  async function getActiveSessionFromRuntime() {
    if (sessionRef.current) return sessionRef.current;
    if (!authService.available) return null;

    try {
      const activeSession = await authService.getSession();
      sessionLoadErrorRef.current = null;
      updateSyncStatusFromResponse(activeSession, "sessao");
      return activeSession;
    } catch (error) {
      sessionLoadErrorRef.current = error;
      return null;
    }
  }

  async function bootstrapAuthenticatedSession(activeSession, options = {}) {
    const { replaceRoute = false } = options;
    const merchantActions = getActions(merchantBridgeRef);
    const publicActions = getActions(publicBridgeRef);
    const superAdminActions = getActions(superAdminBridgeRef);

    setOfflineState(null);

    if (activeSession?.user?.role === "super_admin") {
      sessionRef.current = activeSession;
      setSession(activeSession);
      merchantActions.resetMerchantWorkspace?.();
      publicActions.resetPublicDomain?.();
      await catalogStorage.set("cat:aid", "");
      await superAdminActions.loadSuperAdminState?.(activeSession);
      if (replaceRoute) {
        navigateToPath(buildSuperAdminPath(), { replace: true });
      }
      return;
    }

    if (!activeSession?.storeId) {
      throw new Error("Nao existe loja associada a esta conta.");
    }

    sessionRef.current = activeSession;
    setSession(activeSession);
    await catalogStorage.set("cat:aid", activeSession.storeId);
    await merchantActions.loadCatalogState?.(activeSession.storeId, { admin: true });
    publicActions.setCatalogMode?.("preview");
    setScreen("admin");
    if (replaceRoute) {
      navigateToPath(buildMerchantAppPath(), { replace: true });
    }
  }

  async function resolveCurrentLocation() {
    const merchantActions = getActions(merchantBridgeRef);
    const publicActions = getActions(publicBridgeRef);
    const superAdminActions = getActions(superAdminBridgeRef);

    if (runtimeConfig.requireRemoteApi && !authService.available) {
      setScreen("config-required");
      return;
    }

    setOfflineState(null);
    const route = readAppRoute();
    if (route.fromLegacyHash && route.canonicalPath) {
      navigateToPath(route.canonicalPath, { replace: true });
    }

    if (route.kind === "home") {
      setScreen("home");
      return;
    }

    if (route.kind === "tracking") {
      const order = await publicActions.loadTrackedOrder?.(route.token);
      if (!order && !isNavigatorOnline()) {
        showOfflineRoute("tracking");
      }
      return;
    }

    if (route.kind === "publicCatalog") {
      await publicActions.openCatalogFromRoute?.(route.storeId, { preview: route.preview });
      return;
    }

    if (authService.available) {
      const activeSession = await getActiveSessionFromRuntime();
      const sessionLoadError = sessionLoadErrorRef.current;

      if (route.kind === "auth") {
        if (activeSession) {
          try {
            await bootstrapAuthenticatedSession(activeSession, { replaceRoute: true });
          } catch (error) {
            if (isLikelyOfflineError(error)) {
              showOfflineRoute(activeSession?.user?.role === "super_admin" ? "superadmin" : "merchantApp");
              return;
            }

            throw error;
          }
          return;
        }

        sessionRef.current = null;
        setSession(null);
        moveToAuthScreen({ replace: true, keepSearch: true });
        return;
      }

      if (route.kind === "superadmin") {
        if (!activeSession) {
          if (isLikelyOfflineError(sessionLoadError)) {
            showOfflineRoute("superadmin");
            return;
          }

          handleUnauthorizedSession();
          return;
        }

        try {
          await bootstrapAuthenticatedSession(activeSession, {
            replaceRoute: activeSession?.user?.role !== "super_admin",
          });
        } catch (error) {
          if (isLikelyOfflineError(error)) {
            showOfflineRoute("superadmin");
            return;
          }

          throw error;
        }
        return;
      }

      if (route.kind === "merchantApp") {
        if (!activeSession) {
          if (isLikelyOfflineError(sessionLoadError)) {
            showOfflineRoute("merchantApp");
            return;
          }

          sessionRef.current = null;
          setSession(null);
          moveToAuthScreen({ replace: true, keepSearch: route.kind === "auth" });
          return;
        }

        try {
          await bootstrapAuthenticatedSession(activeSession, {
            replaceRoute:
              (activeSession?.user?.role === "super_admin" && route.kind !== "superadmin")
              || (activeSession?.user?.role !== "super_admin" && route.kind !== "merchantApp"),
          });
        } catch (error) {
          if (isLikelyOfflineError(error)) {
            showOfflineRoute(activeSession?.user?.role === "super_admin" ? "superadmin" : "merchantApp");
            return;
          }

          throw error;
        }
        return;
      }

      setScreen("notfound");
      return;
    }

    if (route.kind === "superadmin") {
      setScreen("notfound");
      return;
    }

    if (route.kind === "notFound") {
      setScreen("notfound");
      return;
    }

    let id;
    try {
      id = (await catalogStorage.get("cat:aid"))?.value;
    } catch (error) {}

    if (!id) {
      id = createAnonymousStoreId();
      await catalogStorage.set("cat:aid", id);
    }

    if (route.kind === "auth") {
      navigateToPath(buildMerchantAppPath(), { replace: true });
    }

    try {
      await merchantActions.loadCatalogState?.(id, { admin: false });
      publicActions.setCatalogMode?.("preview");
      setScreen("admin");
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        showOfflineRoute("merchantApp");
        return;
      }

      setScreen("admin");
    }
  }

  async function handleLogin(payload) {
    setAuthBusy(true);

    try {
      const activeSession = await authService.login(payload);
      updateSyncStatusFromResponse(activeSession, "sessao");
      await bootstrapAuthenticatedSession(activeSession, { replaceRoute: true });
      if (activeSession?.user?.role === "super_admin") {
        getActions(superAdminBridgeRef).setSuperAdminTab?.("clientes");
      } else {
        getActions(merchantBridgeRef).setTab?.("loja");
      }
      showToast("Sessao iniciada com sucesso.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegister(payload) {
    setAuthBusy(true);

    try {
      const response = await authService.register(payload);

      if (!response?.authenticated) {
        showToast(response?.message || "Conta criada com sucesso.");
        return response;
      }

      updateSyncStatusFromResponse(response, "sessao");
      await bootstrapAuthenticatedSession(response, { replaceRoute: true });
      if (response?.user?.role === "super_admin") {
        getActions(superAdminBridgeRef).setSuperAdminTab?.("clientes");
      } else {
        getActions(merchantBridgeRef).setTab?.("loja");
      }
      showToast("Conta criada com sucesso.");
      return response;
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleCheckRegisterAvailability(payload) {
    return authService.checkRegisterAvailability(payload);
  }

  async function handleConfirmRegisterApproval(payload) {
    setAuthBusy(true);

    try {
      return await authService.confirmRegisterApproval(payload);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRequestPasswordReset(payload) {
    setAuthBusy(true);

    try {
      return await authService.requestPasswordReset(payload);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleResetPassword(payload) {
    setAuthBusy(true);

    try {
      return await authService.resetPassword(payload);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    if (!authService.available) return;

    try {
      await authService.logout();
    } catch (error) {}

    sessionRef.current = null;
    setSession(null);
    setOfflineState(null);
    setSyncStatus(INITIAL_SYNC_STATUS);
    getActions(merchantBridgeRef).resetMerchantWorkspace?.();
    getActions(publicBridgeRef).resetPublicDomain?.();
    getActions(superAdminBridgeRef).resetSuperAdminDomain?.();
    await catalogStorage.set("cat:aid", "");
    moveToAuthScreen({ replace: true });
  }

  function handleRouteResolutionFailure(error, context = "atual") {
    console.error(`Falha ao resolver a rota ${context}.`, error);
    if (isLikelyOfflineError(error)) {
      showOfflineRoute(readAppRoute().kind);
      return;
    }

    setScreen("notfound");
  }

  function retryCurrentLocation() {
    return resolveCurrentLocation().catch((error) => {
      handleRouteResolutionFailure(error, "atual");
    });
  }

  useEffect(() => {
    resolveCurrentLocation().catch((error) => {
      handleRouteResolutionFailure(error, "inicial");
    });

    const handleLocationChange = () => {
      resolveCurrentLocation().catch((error) => {
        handleRouteResolutionFailure(error, "atual");
      });
    };

    const handleNetworkOnline = () => {
      setIsOnline(true);
    };

    const handleNetworkOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("online", handleNetworkOnline);
    window.addEventListener("offline", handleNetworkOffline);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("online", handleNetworkOnline);
      window.removeEventListener("offline", handleNetworkOffline);
    };
  }, []);

  return {
    state: {
      screen,
      session,
      authBusy,
      offlineState,
      isOnline,
      syncStatus,
      sessionRef,
    },
    actions: {
      setScreen,
      setSession,
      setOfflineState,
      setSyncStatus,
      navigateToPath,
      moveToAuthScreen,
      showOfflineRoute,
      updateSyncStatusFromResponse,
      handleUnauthorizedSession,
      getActiveSessionFromRuntime,
      resolveCurrentLocation,
      retryCurrentLocation,
      handleLogin,
      handleRegister,
      handleCheckRegisterAvailability,
      handleConfirmRegisterApproval,
      handleRequestPasswordReset,
      handleResetPassword,
      handleLogout,
    },
  };
}
