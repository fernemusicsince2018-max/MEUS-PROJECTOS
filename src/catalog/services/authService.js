const SESSION_CACHE_KEY = "cat:auth-session-cache";
const SUPER_ADMIN_CACHE_KEY = "cat:super-admin-dashboard-cache";
const MERCHANT_PLAN_OPTIONS_CACHE_KEY = "cat:merchant-plan-options-cache";

function getStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

function readCachedValue(key) {
  const storage = getStorage();
  if (!storage || !key) return null;

  try {
    const rawValue = storage.getItem(key);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || !("payload" in parsed)) {
      return null;
    }

    return {
      payload: parsed.payload,
      updatedAt: parsed.updatedAt || "",
    };
  } catch (error) {
    return null;
  }
}

function writeCachedValue(key, payload) {
  const storage = getStorage();
  if (!storage || !key) return "";

  const updatedAt = new Date().toISOString();

  try {
    storage.setItem(
      key,
      JSON.stringify({
        payload,
        updatedAt,
      }),
    );
  } catch (error) {}

  return updatedAt;
}

function clearCachedValue(key) {
  const storage = getStorage();
  if (!storage || !key) return;

  try {
    storage.removeItem(key);
  } catch (error) {}
}

function patchCachedValue(key, patcher) {
  const cached = readCachedValue(key);
  if (!cached?.payload || typeof patcher !== "function") {
    return "";
  }

  const nextPayload = patcher(cached.payload);
  if (!nextPayload) {
    return "";
  }

  return writeCachedValue(key, nextPayload);
}

export function createAuthService(config) {
  const base = (config.apiBaseUrl || "").replace(/\/$/, "");
  const requestCredentials = config.requestCredentials || "same-origin";
  const apiRequiredMessage =
    config.apiRequiredMessage
    || "Esta aplicacao precisa da API configurada para autenticar e gravar dados.";

  function ensureBase() {
    if (!base) {
      throw new Error(apiRequiredMessage);
    }
  }

  async function parseResponse(response, fallbackMessage) {
    let data = {};

    try {
      data = await response.json();
    } catch (error) {}

    if (!response.ok) {
      const message = data?.error || fallbackMessage;
      const failure = new Error(message);
      failure.status = response.status;
      throw failure;
    }

    return data;
  }

  function buildQueryString(params = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value == null) return;
      const normalizedValue = String(value).trim();
      if (!normalizedValue) return;
      searchParams.set(key, normalizedValue);
    });

    const serialized = searchParams.toString();
    return serialized ? `?${serialized}` : "";
  }

  return {
    available: Boolean(base),
    async register(payload) {
      ensureBase();
      const response = await fetch(`${base}/auth-register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      const data = await parseResponse(response, "Nao foi possivel criar a conta.");
      const syncedAt = data?.authenticated
        ? writeCachedValue(SESSION_CACHE_KEY, data)
        : "";
      return {
        ...data,
        syncedAt,
      };
    },
    async checkRegisterAvailability(payload) {
      ensureBase();
      const response = await fetch(`${base}/auth-register-availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      return parseResponse(response, "Nao foi possivel validar os dados do cadastro.");
    },
    async confirmRegisterApproval(payload) {
      ensureBase();
      const response = await fetch(`${base}/auth-register-approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      return parseResponse(response, "Nao foi possivel aprovar a loja.");
    },
    async login(payload) {
      ensureBase();
      const response = await fetch(`${base}/auth-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      const data = await parseResponse(response, "Nao foi possivel iniciar sessao.");
      return {
        ...data,
        syncedAt: writeCachedValue(SESSION_CACHE_KEY, data),
      };
    },
    async requestPasswordReset(payload) {
      ensureBase();
      const response = await fetch(`${base}/auth-request-password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      return parseResponse(response, "Nao foi possivel preparar a recuperacao da palavra-passe.");
    },
    async resetPassword(payload) {
      ensureBase();
      const response = await fetch(`${base}/auth-reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      return parseResponse(response, "Nao foi possivel atualizar a palavra-passe.");
    },
    async getSession() {
      ensureBase();
      let response;

      try {
        response = await fetch(`${base}/auth-me`, {
          method: "GET",
          credentials: requestCredentials,
        });
      } catch (error) {
        const cached = readCachedValue(SESSION_CACHE_KEY);
        if (cached?.payload) {
          return {
            ...cached.payload,
            cachedAt: cached.updatedAt || "",
            offlineFallback: true,
          };
        }
        throw error;
      }

      if (response.status === 401) {
        clearCachedValue(SESSION_CACHE_KEY);
        clearCachedValue(MERCHANT_PLAN_OPTIONS_CACHE_KEY);
        return null;
      }

      const data = await parseResponse(response, "Nao foi possivel validar a sessao.");
      return {
        ...data,
        syncedAt: writeCachedValue(SESSION_CACHE_KEY, data),
      };
    },
    async logout() {
      ensureBase();
      const response = await fetch(`${base}/auth-logout`, {
        method: "POST",
        credentials: requestCredentials,
      });

      clearCachedValue(SESSION_CACHE_KEY);
      clearCachedValue(SUPER_ADMIN_CACHE_KEY);
      clearCachedValue(MERCHANT_PLAN_OPTIONS_CACHE_KEY);
      return parseResponse(response, "Nao foi possivel terminar a sessao.");
    },
    async getMerchantPlanOptions() {
      ensureBase();
      let response;

      try {
        response = await fetch(`${base}/merchant-plan-options`, {
          method: "GET",
          credentials: requestCredentials,
        });
      } catch (error) {
        const cached = readCachedValue(MERCHANT_PLAN_OPTIONS_CACHE_KEY);
        if (cached?.payload) {
          return {
            ...cached.payload,
            cachedAt: cached.updatedAt || "",
            offlineFallback: true,
          };
        }
        throw error;
      }

      if (response.status === 401) {
        clearCachedValue(MERCHANT_PLAN_OPTIONS_CACHE_KEY);
      }

      const data = await parseResponse(response, "Nao foi possivel carregar os planos disponiveis.");
      return {
        ...data,
        syncedAt: writeCachedValue(MERCHANT_PLAN_OPTIONS_CACHE_KEY, data),
      };
    },
    async requestPlanActivation(payload) {
      ensureBase();
      const response = await fetch(`${base}/merchant-plan-activation-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      const data = await parseResponse(response, "Nao foi possivel registar o pedido de ativacao.");
      if (data?.request) {
        patchCachedValue(MERCHANT_PLAN_OPTIONS_CACHE_KEY, (current) => ({
          ...current,
          activeRequest: data.request,
        }));
      }
      return data;
    },
    async submitPlanPaymentProof(payload) {
      ensureBase();
      const response = await fetch(`${base}/merchant-plan-payment-proof-submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      const data = await parseResponse(response, "Nao foi possivel enviar o comprovativo do plano.");
      if (data?.request) {
        patchCachedValue(MERCHANT_PLAN_OPTIONS_CACHE_KEY, (current) => ({
          ...current,
          activeRequest: data.request,
        }));
      }
      return data;
    },
    async getSuperAdminDashboard(options = {}) {
      ensureBase();
      const normalizedOptions = options && typeof options === "object" ? options : {};
      const queryString = buildQueryString(normalizedOptions);
      const canUseCache = !queryString || queryString === "?scope=full";
      let response;

      try {
        response = await fetch(`${base}/super-admin-dashboard${queryString}`, {
          method: "GET",
          credentials: requestCredentials,
        });
      } catch (error) {
        const cached = canUseCache ? readCachedValue(SUPER_ADMIN_CACHE_KEY) : null;
        if (cached?.payload) {
          return {
            ...cached.payload,
            cachedAt: cached.updatedAt || "",
            offlineFallback: true,
          };
        }
        throw error;
      }

      const data = await parseResponse(response, "Nao foi possivel carregar o painel do super admin.");
      if (!canUseCache) {
        return data;
      }

      return {
        ...data,
        syncedAt: writeCachedValue(SUPER_ADMIN_CACHE_KEY, data),
      };
    },
    async saveSuperAdminClient(payload) {
      ensureBase();
      const response = await fetch(`${base}/super-admin-client-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      const data = await parseResponse(response, "Nao foi possivel atualizar o cliente.");
      if (data?.session) {
        writeCachedValue(SESSION_CACHE_KEY, data.session);
      }
      return data;
    },
    async saveSuperAdminAdminUser(payload) {
      ensureBase();
      const response = await fetch(`${base}/super-admin-admin-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      return parseResponse(response, "Nao foi possivel guardar o admin auxiliar.");
    },
    async updateSuperAdminClientLifecycle(payload) {
      ensureBase();
      const response = await fetch(`${base}/super-admin-client-lifecycle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      return parseResponse(response, "Nao foi possivel atualizar o estado desta empresa.");
    },
    async saveSuperAdminPlan(payload) {
      ensureBase();
      const response = await fetch(`${base}/super-admin-plan-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      return parseResponse(response, "Nao foi possivel guardar o plano.");
    },
    async saveSuperAdminSetting(payload) {
      ensureBase();
      const response = await fetch(`${base}/super-admin-settings-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      return parseResponse(response, "Nao foi possivel guardar a configuracao.");
    },
    async reviewPlanActivationRequest(payload) {
      ensureBase();
      const response = await fetch(`${base}/super-admin-plan-request-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: requestCredentials,
        body: JSON.stringify(payload),
      });

      return parseResponse(response, "Nao foi possivel rever o pedido do plano.");
    },
  };
}
