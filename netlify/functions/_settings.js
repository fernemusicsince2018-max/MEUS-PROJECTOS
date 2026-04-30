const DEFAULT_SYSTEM_SETTINGS = Object.freeze({
  supportWhatsApp: "244900000000",
  trialEnabled: true,
  trialDays: 7,
  maintenanceMode: false,
  merchantRegistrationEnabled: true,
  maxFreeProducts: 10,
  paymentProofDeadlineHours: 72,
  paymentMethodLabel: "Transferencia bancaria",
  paymentInstructions: "",
  paymentBankName: "",
  paymentAccountName: "",
  paymentAccountNumber: "",
  paymentIban: "",
});

const GLOBAL_STATE_KEY = "__catalogSystemSettingsState";
const globalState = globalThis[GLOBAL_STATE_KEY] || (globalThis[GLOBAL_STATE_KEY] = {
  cache: null,
});

if (!("cache" in globalState)) {
  globalState.cache = null;
}

const SETTING_KEY_ALIASES = Object.freeze({
  supportWhatsApp: ["support_whatsapp"],
  trialEnabled: ["trial_enabled"],
  trialDays: ["trial_days", "default_plan_days"],
  maintenanceMode: ["maintenance_mode", "app_maintenance"],
  merchantRegistrationEnabled: ["merchant_registration_enabled", "public_registration_enabled"],
  maxFreeProducts: ["max_free_products"],
  paymentProofDeadlineHours: ["payment_proof_deadline_hours"],
  paymentMethodLabel: ["payment_method_label"],
  paymentInstructions: ["payment_instructions"],
  paymentBankName: ["payment_bank_name"],
  paymentAccountName: ["payment_account_name"],
  paymentAccountNumber: ["payment_account_number"],
  paymentIban: ["payment_iban"],
});

const SYSTEM_SETTING_DEFINITIONS = Object.freeze({
  support_whatsapp: {
    defaultValue: DEFAULT_SYSTEM_SETTINGS.supportWhatsApp,
    category: "general",
    description: "Numero de WhatsApp para suporte e vendas.",
  },
  trial_enabled: {
    defaultValue: String(DEFAULT_SYSTEM_SETTINGS.trialEnabled),
    category: "plans",
    description: "Ativa ou desativa o trial gratuito para novas contas de lojista.",
  },
  trial_days: {
    defaultValue: String(DEFAULT_SYSTEM_SETTINGS.trialDays),
    category: "plans",
    description: "Quantidade de dias de teste gratuito para novos lojistas.",
  },
  maintenance_mode: {
    defaultValue: String(DEFAULT_SYSTEM_SETTINGS.maintenanceMode),
    category: "system",
    description: 'Se "true", bloqueia o acesso publico a todos os catalogos.',
  },
  merchant_registration_enabled: {
    defaultValue: String(DEFAULT_SYSTEM_SETTINGS.merchantRegistrationEnabled),
    category: "system",
    description: 'Se "false", bloqueia novos cadastros publicos de lojistas.',
  },
  max_free_products: {
    defaultValue: String(DEFAULT_SYSTEM_SETTINGS.maxFreeProducts),
    category: "plans",
    description: "Limite de produtos para o plano Trial.",
  },
  payment_proof_deadline_hours: {
    defaultValue: String(DEFAULT_SYSTEM_SETTINGS.paymentProofDeadlineHours),
    category: "payments",
    description: "Prazo em horas para o lojista enviar o comprovativo depois de pedir o plano.",
  },
  payment_method_label: {
    defaultValue: DEFAULT_SYSTEM_SETTINGS.paymentMethodLabel,
    category: "payments",
    description: "Nome curto do metodo de pagamento mostrado ao lojista.",
  },
  payment_instructions: {
    defaultValue: DEFAULT_SYSTEM_SETTINGS.paymentInstructions,
    category: "payments",
    description: "Instrucoes de pagamento que aparecem no painel do lojista.",
  },
  payment_bank_name: {
    defaultValue: DEFAULT_SYSTEM_SETTINGS.paymentBankName,
    category: "payments",
    description: "Banco usado para receber os pagamentos dos planos.",
  },
  payment_account_name: {
    defaultValue: DEFAULT_SYSTEM_SETTINGS.paymentAccountName,
    category: "payments",
    description: "Nome da conta bancario que recebe os pagamentos.",
  },
  payment_account_number: {
    defaultValue: DEFAULT_SYSTEM_SETTINGS.paymentAccountNumber,
    category: "payments",
    description: "Numero da conta para pagamentos dos planos.",
  },
  payment_iban: {
    defaultValue: DEFAULT_SYSTEM_SETTINGS.paymentIban,
    category: "payments",
    description: "IBAN ou referencia bancaria apresentada ao lojista.",
  },
});

function normalizeDigits(value, maxLength = 32) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
}

function parsePositiveInteger(value, fallback, minimum = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.floor(numeric);
  if (rounded < minimum) return fallback;
  return rounded;
}

function getSystemSettingsCacheTtlMs() {
  return parsePositiveInteger(process.env.SYSTEM_SETTINGS_CACHE_TTL_MS, 10000, 1000);
}

function cloneSystemSettings(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseBooleanSetting(value, fallback = false) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["1", "true", "yes", "on", "sim"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "nao", "não"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveIntegerSetting(value, fallback) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return fallback;
  return numeric;
}

function resolveSettingValue(settings, aliases = []) {
  for (const key of aliases) {
    const raw = settings[key]?.value;
    if (raw == null) continue;

    const normalized = String(raw).trim();
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

async function loadSettingsMap(queryable) {
  try {
    const result = await queryable.query(
      `select key, value, category, description
       from public.catalog_settings`,
    );

    return result.rows.reduce((acc, row) => {
      acc[row.key] = {
        value: row.value,
        category: row.category || "general",
        description: row.description || "",
      };
      return acc;
    }, {});
  } catch (error) {
    if (error.code === "42P01") {
      return {};
    }

    throw error;
  }
}

function readCachedSystemSettings() {
  const cached = globalState.cache;
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    globalState.cache = null;
    return null;
  }

  return cloneSystemSettings(cached.value);
}

function writeCachedSystemSettings(value) {
  globalState.cache = {
    expiresAt: Date.now() + getSystemSettingsCacheTtlMs(),
    value: cloneSystemSettings(value),
  };
}

function invalidateSystemSettingsCache() {
  globalState.cache = null;
}

function buildSystemSettingsCatalog(storedSettings = {}) {
  const catalog = Object.fromEntries(
    Object.entries(SYSTEM_SETTING_DEFINITIONS).map(([key, definition]) => [
      key,
      {
        value: String(definition.defaultValue ?? ""),
        category: definition.category || "general",
        description: definition.description || "",
      },
    ]),
  );

  for (const [key, info] of Object.entries(storedSettings || {})) {
    const fallback = catalog[key] || { value: "", category: "general", description: "" };
    catalog[key] = {
      value: String(info?.value ?? fallback.value ?? ""),
      category: info?.category || fallback.category,
      description: info?.description || fallback.description,
    };
  }

  return catalog;
}

async function getSystemSettings(queryable, options = {}) {
  const bypassCache = options?.bypassCache === true;
  if (!bypassCache) {
    const cached = readCachedSystemSettings();
    if (cached) {
      return cached;
    }
  }

  const storedSettings = await loadSettingsMap(queryable);
  const settings = buildSystemSettingsCatalog(storedSettings);
  const resolvedSettings = {
    settings,
    supportWhatsApp:
      normalizeDigits(resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.supportWhatsApp)) ||
      DEFAULT_SYSTEM_SETTINGS.supportWhatsApp,
    trialEnabled: parseBooleanSetting(
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.trialEnabled),
      DEFAULT_SYSTEM_SETTINGS.trialEnabled,
    ),
    trialDays: parsePositiveIntegerSetting(
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.trialDays),
      DEFAULT_SYSTEM_SETTINGS.trialDays,
    ),
    maintenanceMode: parseBooleanSetting(
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.maintenanceMode),
      DEFAULT_SYSTEM_SETTINGS.maintenanceMode,
    ),
    merchantRegistrationEnabled: parseBooleanSetting(
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.merchantRegistrationEnabled),
      DEFAULT_SYSTEM_SETTINGS.merchantRegistrationEnabled,
    ),
    maxFreeProducts: parsePositiveIntegerSetting(
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.maxFreeProducts),
      DEFAULT_SYSTEM_SETTINGS.maxFreeProducts,
    ),
    paymentProofDeadlineHours: parsePositiveIntegerSetting(
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.paymentProofDeadlineHours),
      DEFAULT_SYSTEM_SETTINGS.paymentProofDeadlineHours,
    ),
    paymentMethodLabel:
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.paymentMethodLabel)
      || DEFAULT_SYSTEM_SETTINGS.paymentMethodLabel,
    paymentInstructions:
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.paymentInstructions)
      || DEFAULT_SYSTEM_SETTINGS.paymentInstructions,
    paymentBankName:
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.paymentBankName)
      || DEFAULT_SYSTEM_SETTINGS.paymentBankName,
    paymentAccountName:
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.paymentAccountName)
      || DEFAULT_SYSTEM_SETTINGS.paymentAccountName,
    paymentAccountNumber:
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.paymentAccountNumber)
      || DEFAULT_SYSTEM_SETTINGS.paymentAccountNumber,
    paymentIban:
      resolveSettingValue(storedSettings, SETTING_KEY_ALIASES.paymentIban)
      || DEFAULT_SYSTEM_SETTINGS.paymentIban,
  };

  if (!bypassCache) {
    writeCachedSystemSettings(resolvedSettings);
  }

  return resolvedSettings;
}

export {
  DEFAULT_SYSTEM_SETTINGS,
  SYSTEM_SETTING_DEFINITIONS,
  buildSystemSettingsCatalog,
  getSystemSettings,
  invalidateSystemSettingsCache,
  loadSettingsMap,
};
