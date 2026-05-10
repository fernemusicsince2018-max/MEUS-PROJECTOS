import { useRef, useState } from "react";
import {
  EMPTY_SUPER_ADMIN_DATA,
  EMPTY_SUPER_ADMIN_FINANCIAL_PAGE_INFO,
  EMPTY_SUPER_ADMIN_PAGE_INFO,
  INITIAL_SUPER_ADMIN_LIST_QUERY,
  SUPER_ADMIN_CLIENT_PAGE_SIZE,
  SUPER_ADMIN_FINANCIAL_EVENTS_PAGE_SIZE,
} from "./controllerState.js";

function normalizeSuperAdminListQuery(query = {}) {
  return {
    search: String(query?.search || "").trim(),
    dateFrom: String(query?.dateFrom || "").trim(),
    dateTo: String(query?.dateTo || "").trim(),
  };
}

function buildSuperAdminDashboardParams(query = {}, options = {}) {
  const normalizedQuery = normalizeSuperAdminListQuery(query);
  const params = {
    scope: options.scope || "full",
    clientsLimit: String(options.clientsLimit || SUPER_ADMIN_CLIENT_PAGE_SIZE),
    trashedClientsLimit: String(options.trashedClientsLimit || SUPER_ADMIN_CLIENT_PAGE_SIZE),
    financialEventsLimit: String(options.financialEventsLimit || SUPER_ADMIN_FINANCIAL_EVENTS_PAGE_SIZE),
  };

  if (normalizedQuery.search) {
    params.search = normalizedQuery.search;
  }

  if (normalizedQuery.dateFrom) {
    params.dateFrom = normalizedQuery.dateFrom;
  }

  if (normalizedQuery.dateTo) {
    params.dateTo = normalizedQuery.dateTo;
  }

  if (options.clientsCursor) {
    params.clientsCursor = String(options.clientsCursor).trim();
  }

  if (options.trashedClientsCursor) {
    params.trashedClientsCursor = String(options.trashedClientsCursor).trim();
  }

  if (options.financialEventsCursor) {
    params.financialEventsCursor = String(options.financialEventsCursor).trim();
  }

  return params;
}

function mergeEntriesByUserId(previousEntries = [], incomingEntries = []) {
  const merged = [...previousEntries];
  const seenIds = new Set(previousEntries.map((entry) => entry?.userId).filter(Boolean));

  for (const entry of incomingEntries) {
    const userId = entry?.userId;
    if (userId && seenIds.has(userId)) {
      continue;
    }

    merged.push(entry);
    if (userId) {
      seenIds.add(userId);
    }
  }

  return merged;
}

function mergeEntriesById(previousEntries = [], incomingEntries = []) {
  const merged = [...previousEntries];
  const seenIds = new Set(previousEntries.map((entry) => entry?.id).filter(Boolean));

  for (const entry of incomingEntries) {
    const entryId = entry?.id;
    if (entryId && seenIds.has(entryId)) {
      continue;
    }

    merged.push(entry);
    if (entryId) {
      seenIds.add(entryId);
    }
  }

  return merged;
}

export function useSuperAdminController({
  authService,
  session,
  setSession,
  sessionRef,
  updateSyncStatusFromResponse,
  handleUnauthorizedSession,
  showToast,
  setScreen,
  setCatalogMode,
}) {
  const [superAdminBusy, setSuperAdminBusy] = useState(false);
  const [superAdminData, setSuperAdminData] = useState(EMPTY_SUPER_ADMIN_DATA);
  const [superAdminTab, setSuperAdminTab] = useState("clientes");
  const superAdminListQueryRef = useRef(INITIAL_SUPER_ADMIN_LIST_QUERY);
  const superAdminRequestIdRef = useRef(0);

  function resetSuperAdminDomain() {
    superAdminListQueryRef.current = INITIAL_SUPER_ADMIN_LIST_QUERY;
    superAdminRequestIdRef.current += 1;
    setSuperAdminData(EMPTY_SUPER_ADMIN_DATA);
    setSuperAdminTab("clientes");
    setSuperAdminBusy(false);
  }

  async function loadSuperAdminState(activeSession = session, options = {}) {
    const normalizedOptions = options && typeof options === "object" ? options : {};
    const scope = String(normalizedOptions.scope || "full").trim().toLowerCase();
    const query = normalizeSuperAdminListQuery(normalizedOptions.query || superAdminListQueryRef.current);
    const requestId = superAdminRequestIdRef.current + 1;
    superAdminListQueryRef.current = query;
    superAdminRequestIdRef.current = requestId;

    if (activeSession) {
      sessionRef.current = activeSession;
      setSession(activeSession);
    }

    const response = await authService.getSuperAdminDashboard(
      buildSuperAdminDashboardParams(query, {
        scope,
        clientsCursor: normalizedOptions.clientsCursor,
        trashedClientsCursor: normalizedOptions.trashedClientsCursor,
        financialEventsCursor: normalizedOptions.financialEventsCursor,
      }),
    );

    if (superAdminRequestIdRef.current !== requestId) {
      return response;
    }

    updateSyncStatusFromResponse(response, "superadmin");

    if (scope === "clients") {
      setSuperAdminData((current) => ({
        ...current,
        clients: normalizedOptions.appendClients
          ? mergeEntriesByUserId(current.clients, response?.clients || [])
          : (response?.clients || []),
        clientPageInfo: response?.clientPageInfo || EMPTY_SUPER_ADMIN_PAGE_INFO,
        pendingAccessRequests: response?.pendingAccessRequests || [],
        summary: {
          ...(current?.summary || EMPTY_SUPER_ADMIN_DATA.summary),
          pendingAccessRequests: Number(
            response?.pendingAccessRequestCount ?? current?.summary?.pendingAccessRequests ?? 0,
          ),
        },
      }));
      setScreen("superadmin");
      return response;
    }

    if (scope === "trashedclients") {
      setSuperAdminData((current) => ({
        ...current,
        trashedClients: normalizedOptions.appendTrashedClients
          ? mergeEntriesByUserId(current.trashedClients, response?.trashedClients || [])
          : (response?.trashedClients || []),
        trashedClientPageInfo: response?.trashedClientPageInfo || EMPTY_SUPER_ADMIN_PAGE_INFO,
      }));
      setScreen("superadmin");
      return response;
    }

    if (scope === "financialevents") {
      setSuperAdminData((current) => ({
        ...current,
        financialEvents: normalizedOptions.appendFinancialEvents
          ? mergeEntriesById(current.financialEvents, response?.financialEvents || [])
          : (response?.financialEvents || []),
        financialEventPageInfo: response?.financialEventPageInfo || EMPTY_SUPER_ADMIN_FINANCIAL_PAGE_INFO,
      }));
      setScreen("superadmin");
      return response;
    }

    setSuperAdminData({
      summary: response?.summary || EMPTY_SUPER_ADMIN_DATA.summary,
      clients: response?.clients || [],
      clientPageInfo: response?.clientPageInfo || EMPTY_SUPER_ADMIN_PAGE_INFO,
      trashedClients: response?.trashedClients || [],
      trashedClientPageInfo: response?.trashedClientPageInfo || EMPTY_SUPER_ADMIN_PAGE_INFO,
      recentClients: response?.recentClients || [],
      urgentClients: response?.urgentClients || [],
      urgentClientsTotal: Number(response?.urgentClientsTotal || 0),
      pendingAccessRequests: response?.pendingAccessRequests || [],
      adminUsers: response?.adminUsers || [],
      plans: response?.plans || [],
      settings: response?.settings || {},
      financialEvents: response?.financialEvents || [],
      financialEventPageInfo: response?.financialEventPageInfo || EMPTY_SUPER_ADMIN_FINANCIAL_PAGE_INFO,
      planActivationRequests: response?.planActivationRequests || [],
      permissions: response?.permissions || EMPTY_SUPER_ADMIN_DATA.permissions,
    });
    setCatalogMode("preview");
    setScreen("superadmin");
    return response;
  }

  async function handleSuperAdminRefresh() {
    setSuperAdminBusy(true);

    try {
      await loadSuperAdminState();
      showToast("Painel do super admin atualizado.");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Nao foi possivel atualizar o painel do super admin.");
    } finally {
      setSuperAdminBusy(false);
    }
  }

  async function handleSuperAdminClientsQueryChange(query) {
    setSuperAdminBusy(true);

    try {
      await loadSuperAdminState(sessionRef.current || session, {
        scope: "clients",
        query,
      });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
        return;
      }
      showToast(error.message || "Nao foi possivel atualizar a lista de clientes.");
    } finally {
      setSuperAdminBusy(false);
    }
  }

  async function handleSuperAdminLoadMoreClients() {
    const endCursor = String(superAdminData?.clientPageInfo?.endCursor || "").trim();
    if (!superAdminData?.clientPageInfo?.hasMore || !endCursor) {
      return;
    }

    setSuperAdminBusy(true);

    try {
      await loadSuperAdminState(sessionRef.current || session, {
        scope: "clients",
        query: superAdminListQueryRef.current,
        clientsCursor: endCursor,
        appendClients: true,
      });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
        return;
      }
      showToast(error.message || "Nao foi possivel carregar mais clientes.");
    } finally {
      setSuperAdminBusy(false);
    }
  }

  async function handleSuperAdminTrashedQueryChange(query) {
    setSuperAdminBusy(true);

    try {
      await loadSuperAdminState(sessionRef.current || session, {
        scope: "trashedclients",
        query,
      });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
        return;
      }
      showToast(error.message || "Nao foi possivel atualizar o lixo de empresas.");
    } finally {
      setSuperAdminBusy(false);
    }
  }

  async function handleSuperAdminLoadMoreTrashedClients() {
    const endCursor = String(superAdminData?.trashedClientPageInfo?.endCursor || "").trim();
    if (!superAdminData?.trashedClientPageInfo?.hasMore || !endCursor) {
      return;
    }

    setSuperAdminBusy(true);

    try {
      await loadSuperAdminState(sessionRef.current || session, {
        scope: "trashedclients",
        query: superAdminListQueryRef.current,
        trashedClientsCursor: endCursor,
        appendTrashedClients: true,
      });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
        return;
      }
      showToast(error.message || "Nao foi possivel carregar mais empresas do lixo.");
    } finally {
      setSuperAdminBusy(false);
    }
  }

  async function handleSuperAdminLoadMoreFinancialEvents() {
    const endCursor = String(superAdminData?.financialEventPageInfo?.endCursor || "").trim();
    if (!superAdminData?.financialEventPageInfo?.hasMore || !endCursor) {
      return;
    }

    setSuperAdminBusy(true);

    try {
      await loadSuperAdminState(sessionRef.current || session, {
        scope: "financialevents",
        financialEventsCursor: endCursor,
        appendFinancialEvents: true,
      });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
        return;
      }
      showToast(error.message || "Nao foi possivel carregar mais eventos financeiros.");
    } finally {
      setSuperAdminBusy(false);
    }
  }

  async function handleSuperAdminClientSave(payload) {
    setSuperAdminBusy(true);

    try {
      const response = await authService.saveSuperAdminClient(payload);
      const nextSession = response?.session || session;
      if (response?.session) {
        sessionRef.current = response.session;
        setSession(response.session);
        updateSyncStatusFromResponse(response.session, "sessao");
      }
      await loadSuperAdminState(nextSession);
      const successMessage = payload?.userId === session?.user?.id ? "Perfil atualizado com sucesso." : "Cliente atualizado com sucesso.";
      const notificationSummary = String(response?.planActivationNotification?.summary || "").trim();
      showToast(notificationSummary ? `${successMessage} ${notificationSummary}` : successMessage);
      return { ok: true, response };
    } catch (error) {
      const exactMessage = error.message || "Nao foi possivel atualizar o cliente.";
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(
        payload?.userId === session?.user?.id
          ? `Erro ao guardar perfil: ${exactMessage}`
          : exactMessage,
      );
      return { ok: false, errorMessage: exactMessage };
    } finally {
      setSuperAdminBusy(false);
    }
  }

  async function handleSuperAdminPlanSave(payload) {
    setSuperAdminBusy(true);

    try {
      await authService.saveSuperAdminPlan(payload);
      await loadSuperAdminState();
      showToast("Pacote guardado com sucesso.");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Nao foi possivel guardar o pacote.");
    } finally {
      setSuperAdminBusy(false);
    }
  }

  async function handleSuperAdminAdminUserSave(payload) {
    setSuperAdminBusy(true);

    try {
      await authService.saveSuperAdminAdminUser(payload);
      await loadSuperAdminState();
      showToast(payload?.userId ? "Admin auxiliar atualizado com sucesso." : "Admin auxiliar criado com sucesso.");
      return { ok: true };
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      const exactMessage = error.message || "Nao foi possivel guardar o admin auxiliar.";
      showToast(exactMessage);
      return { ok: false, errorMessage: exactMessage };
    } finally {
      setSuperAdminBusy(false);
    }
  }

  async function handleSuperAdminSettingSave(payload) {
    setSuperAdminBusy(true);

    try {
      await authService.saveSuperAdminSetting(payload);
      setSuperAdminData((current) => ({
        ...current,
        settings: {
          ...(current?.settings || {}),
          [payload.key]: {
            ...(current?.settings?.[payload.key] || {}),
            value: String(payload.value ?? ""),
          },
        },
      }));
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      throw error;
    } finally {
      setSuperAdminBusy(false);
    }
  }

  async function handleSuperAdminPlanRequestReview(payload) {
    setSuperAdminBusy(true);

    try {
      const response = await authService.reviewPlanActivationRequest(payload);
      await loadSuperAdminState();

      const action = String(payload?.action || "").trim().toLowerCase();
      if (action === "activated") {
        const summary = response?.planActivationNotification?.summary || "";
        showToast(summary || "Pedido aprovado e plano ativado com sucesso.");
      } else if (action === "needs_correction") {
        showToast("Pedido devolvido ao lojista para corrigir o comprovativo.");
      } else if (action === "rejected") {
        showToast("Pedido rejeitado com sucesso.");
      } else {
        showToast("Pedido marcado como em revisao.");
      }

      return response;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Nao foi possivel rever o pedido do plano.");
      throw error;
    } finally {
      setSuperAdminBusy(false);
    }
  }

  async function handleSuperAdminClientLifecycle(payload) {
    setSuperAdminBusy(true);

    try {
      const userIds = Array.isArray(payload?.userIds)
        ? [...new Set(payload.userIds.map((value) => String(value || "").trim()).filter(Boolean))]
        : [String(payload?.userId || "").trim()].filter(Boolean);

      if (!userIds.length) {
        throw new Error("Nenhum lojista foi selecionado.");
      }

      let successCount = 0;
      let firstError = "";

      for (const userId of userIds) {
        try {
          await authService.updateSuperAdminClientLifecycle({ userId, action: payload.action });
          successCount += 1;
        } catch (error) {
          if (error.status === 401 || error.status === 403) {
            handleUnauthorizedSession();
            return;
          }
          if (!firstError) {
            firstError = error.message || "Nao foi possivel atualizar o estado desta empresa.";
          }
        }
      }

      if (successCount > 0) {
        await loadSuperAdminState();
      }

      const actionMessages = {
        trash: "Empresa movida para o lixo.",
        restore: "Empresa recuperada do lixo.",
        delete_forever: "Empresa eliminada para sempre.",
      };

      const bulkActionMessages = {
        trash: "empresa(s) movida(s) para o lixo.",
        restore: "empresa(s) recuperada(s) do lixo.",
        delete_forever: "empresa(s) eliminada(s) para sempre.",
      };

      if (userIds.length === 1) {
        if (successCount === 1) {
          showToast(actionMessages[payload.action] || "Estado da empresa atualizado.");
          return;
        }
        throw new Error(firstError || "Nao foi possivel atualizar o estado desta empresa.");
      }

      if (successCount === userIds.length) {
        showToast(`${successCount} ${bulkActionMessages[payload.action] || "empresa(s) atualizada(s)."}`);
        return;
      }

      if (successCount > 0) {
        const failedCount = userIds.length - successCount;
        showToast(`${successCount} ${bulkActionMessages[payload.action] || "empresa(s) atualizada(s)."} ${failedCount} falharam${firstError ? `: ${firstError}` : "."}`);
        return;
      }

      throw new Error(firstError || "Nao foi possivel atualizar o estado das empresas selecionadas.");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        handleUnauthorizedSession();
      }
      showToast(error.message || "Nao foi possivel atualizar o estado desta empresa.");
    } finally {
      setSuperAdminBusy(false);
    }
  }

  return {
    state: {
      superAdminBusy,
      superAdminData,
      superAdminTab,
    },
    actions: {
      setSuperAdminTab,
      resetSuperAdminDomain,
      loadSuperAdminState,
      handleSuperAdminRefresh,
      handleSuperAdminClientsQueryChange,
      handleSuperAdminLoadMoreClients,
      handleSuperAdminTrashedQueryChange,
      handleSuperAdminLoadMoreTrashedClients,
      handleSuperAdminLoadMoreFinancialEvents,
      handleSuperAdminClientSave,
      handleSuperAdminPlanSave,
      handleSuperAdminAdminUserSave,
      handleSuperAdminSettingSave,
      handleSuperAdminPlanRequestReview,
      handleSuperAdminClientLifecycle,
    },
  };
}
