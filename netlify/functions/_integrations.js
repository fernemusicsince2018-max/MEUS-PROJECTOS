function cleanText(value) {
  return String(value || "").trim();
}

function parseBooleanFlag(value) {
  const normalized = cleanText(value).toLowerCase();
  return ["1", "true", "yes", "on", "sim"].includes(normalized);
}

function isAbsoluteHttpsUrl(value) {
  const text = cleanText(value);
  if (!text) return false;

  try {
    const parsed = new URL(text);
    return parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function listIncludesValue(listLikeValue, expectedValue) {
  const expected = cleanText(expectedValue).toLowerCase();
  if (!expected) return false;

  return String(listLikeValue || "")
    .split(",")
    .map((entry) => cleanText(entry).toLowerCase())
    .filter(Boolean)
    .includes(expected);
}

function createStatus(id, title, ready, details, missing = [], options = {}) {
  return {
    id,
    title,
    ready: Boolean(ready),
    details,
    missing,
    required: options.required !== false,
    nextStep: options.nextStep || "",
  };
}

function getCatalogApiStatus() {
  const apiBaseUrl = cleanText(process.env.VITE_CATALOG_API_BASE || process.env.CATALOG_API_BASE);
  const allowLocalFallback = parseBooleanFlag(
    process.env.VITE_ALLOW_LOCAL_FALLBACK || process.env.CATALOG_ALLOW_LOCAL_FALLBACK,
  );
  const missing = [];

  if (!apiBaseUrl) {
    missing.push("VITE_CATALOG_API_BASE");
  }

  const apiDetails = apiBaseUrl === "/api"
    ? "A ligacao online da loja esta pronta em /api."
    : apiBaseUrl.startsWith("/.netlify/functions")
      ? `A ligacao online da loja esta pronta em ${apiBaseUrl}.`
      : `A ligacao online da loja esta pronta em ${apiBaseUrl}.`;

  return createStatus(
    "catalog_api",
    "Ligacao online da loja",
    Boolean(apiBaseUrl),
    apiBaseUrl
      ? apiDetails
      : allowLocalFallback
        ? "O modo local de seguranca esta ativo. Usa isto apenas em desenvolvimento."
        : "Sem VITE_CATALOG_API_BASE, a app bloqueia o arranque fora de localhost para evitar gravacao local em producao.",
    missing,
    {
      nextStep: "Define VITE_CATALOG_API_BASE com a ligacao real da loja antes do deploy.",
    },
  );
}

function getPasswordResetEmailStatus() {
  const configuredSender = cleanText(process.env.PASSWORD_RESET_FROM_EMAIL);
  const missing = [];
  if (!cleanText(process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || process.env.SITE_URL || process.env.URL)) {
    missing.push("APP_BASE_URL");
  }
  if (!cleanText(process.env.RESEND_API_KEY)) {
    missing.push("RESEND_API_KEY");
  }
  if (!cleanText(process.env.PASSWORD_RESET_FROM_EMAIL)) {
    missing.push("PASSWORD_RESET_FROM_EMAIL");
  }

  return createStatus(
    "password_reset_email",
    "Emails transacionais",
    missing.length === 0,
    missing.length === 0
      ? `Email transacional pronto para links reais de recuperacao e aprovacao da loja. Obrigatorias: APP_BASE_URL, RESEND_API_KEY e PASSWORD_RESET_FROM_EMAIL. Opcionais: PASSWORD_RESET_FROM_NAME e PASSWORD_RESET_REPLY_TO. Sender atual: ${configuredSender}.`
      : "Faltam variaveis obrigatorias para envio real de recuperacao e aprovacao da loja por email. PASSWORD_RESET_FROM_NAME e PASSWORD_RESET_REPLY_TO sao opcionais, mas PASSWORD_RESET_FROM_EMAIL precisa ser um remetente verificado no Resend.",
    missing,
    {
      required: false,
      nextStep: "Define APP_BASE_URL, RESEND_API_KEY e PASSWORD_RESET_FROM_EMAIL com um sender verificado no Resend. PASSWORD_RESET_FROM_NAME e PASSWORD_RESET_REPLY_TO podem ser adicionados depois como opcionais.",
    },
  );
}

function getWhatsAppCloudStatus() {
  const missing = [];
  if (!cleanText(process.env.WHATSAPP_CLOUD_API_TOKEN)) {
    missing.push("WHATSAPP_CLOUD_API_TOKEN");
  }
  if (!cleanText(process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID)) {
    missing.push("WHATSAPP_CLOUD_PHONE_NUMBER_ID");
  }

  return createStatus(
    "whatsapp_cloud",
    "Envio automatico no WhatsApp",
    missing.length === 0,
    missing.length === 0
      ? "Notificacao oficial pronta para envio automatico ao lojista."
      : "O pedido continua a abrir o WhatsApp manualmente enquanto o envio automatico nao estiver configurado.",
    missing,
    {
      required: false,
      nextStep: "Adiciona WHATSAPP_CLOUD_API_TOKEN e WHATSAPP_CLOUD_PHONE_NUMBER_ID se quiseres notificacao automatica oficial.",
    },
  );
}

function getNotificationDispatchStatus() {
  const hasWhatsAppCloud =
    cleanText(process.env.WHATSAPP_CLOUD_API_TOKEN)
    && cleanText(process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID);
  const missing = [];

  if (!cleanText(process.env.NOTIFICATION_DISPATCH_SECRET || process.env.INTERNAL_QUEUE_SECRET || process.env.CRON_SECRET)) {
    missing.push("NOTIFICATION_DISPATCH_SECRET");
  }

  return createStatus(
    "notification_dispatch",
    "Fila automatica de notificacoes",
    !hasWhatsAppCloud || missing.length === 0,
    !hasWhatsAppCloud
      ? "Opcional enquanto o envio automatico no WhatsApp nao estiver ativo."
      : missing.length === 0
        ? "Pronto para processar a fila automatica de notificacoes."
        : "A fila automatica existe, mas ainda falta proteger este fluxo com segredo.",
    hasWhatsAppCloud ? missing : [],
    {
      required: false,
      nextStep:
        "Configura NOTIFICATION_DISPATCH_SECRET e agenda execucoes regulares do envio automatico.",
    },
  );
}

function getMediaStorageStatus() {
  const missing = [];
  if (!cleanText(process.env.SUPABASE_URL)) {
    missing.push("SUPABASE_URL");
  }
  if (!cleanText(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return createStatus(
    "media_storage",
    "Imagens da loja",
    missing.length === 0,
    missing.length === 0
      ? `As imagens locais podem ser convertidas em links publicos no espaco ${cleanText(process.env.SUPABASE_STORAGE_BUCKET) || "catalog-assets"}.`
      : "Sem o servico de imagens configurado, as imagens devem entrar por link publico e os uploads de ficheiro ficam bloqueados.",
    missing,
    {
      required: false,
      nextStep: "Configura SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para habilitar uploads de ficheiro e links publicos.",
    },
  );
}

function getNativeAppSessionStatus() {
  const nativeApiBaseUrl = cleanText(process.env.VITE_NATIVE_CATALOG_API_BASE);
  if (!nativeApiBaseUrl) {
    return createStatus(
      "native_app_session",
      "App movel",
      true,
      "Nao configurado neste ambiente. Se o deploy for so web, nao existe nenhum requisito extra aqui.",
      [],
      {
        required: false,
      },
    );
  }

  const appBaseUrl = cleanText(
    process.env.APP_BASE_URL
    || process.env.PUBLIC_APP_URL
    || process.env.SITE_URL
    || process.env.URL,
  );
  const publicCatalogBaseUrl = cleanText(
    process.env.VITE_PUBLIC_CATALOG_BASE_URL
    || process.env.PUBLIC_CATALOG_BASE_URL,
  );
  const missing = [];

  if (!isAbsoluteHttpsUrl(nativeApiBaseUrl)) {
    missing.push("VITE_NATIVE_CATALOG_API_BASE=https://.../api");
  }

  if (!isAbsoluteHttpsUrl(appBaseUrl)) {
    missing.push("APP_BASE_URL=https://...");
  }

  if (publicCatalogBaseUrl && !isAbsoluteHttpsUrl(publicCatalogBaseUrl)) {
    missing.push("VITE_PUBLIC_CATALOG_BASE_URL=https://...");
  }

  if (cleanText(process.env.SESSION_COOKIE_SAME_SITE).toLowerCase() !== "none") {
    missing.push("SESSION_COOKIE_SAME_SITE=None");
  }

  if (!parseBooleanFlag(process.env.SESSION_COOKIE_SECURE)) {
    missing.push("SESSION_COOKIE_SECURE=true");
  }

  if (!listIncludesValue(process.env.CORS_ALLOWED_ORIGINS, "capacitor://localhost")) {
    missing.push("CORS_ALLOWED_ORIGINS+=capacitor://localhost");
  }

  if (!listIncludesValue(process.env.CORS_ALLOWED_ORIGINS, "http://localhost")) {
    missing.push("CORS_ALLOWED_ORIGINS+=http://localhost");
  }

  return createStatus(
    "native_app_session",
    "App movel",
    missing.length === 0,
    missing.length === 0
      ? "A entrada no app movel esta pronta, com ligacao segura e origens autorizadas."
      : "O app movel esta configurado, mas ainda faltam alguns ajustes para uma entrada segura.",
    missing,
    {
      required: false,
      nextStep:
        "Mantem VITE_NATIVE_CATALOG_API_BASE em HTTPS absoluto e alinha APP_BASE_URL, CORS_ALLOWED_ORIGINS, SESSION_COOKIE_SAME_SITE=None e SESSION_COOKIE_SECURE=true antes da release do app.",
    },
  );
}

function getDatabaseStatus() {
  const poolerUrl = cleanText(process.env.POSTGRES_POOLER_URL);
  const hasConnectionString = Boolean(cleanText(poolerUrl || process.env.DATABASE_URL || process.env.POSTGRES_URL));
  const hasSplitConfig = Boolean(
    cleanText(process.env.POSTGRES_HOST || process.env.PGHOST)
    && cleanText(process.env.POSTGRES_DATABASE || process.env.PGDATABASE)
    && cleanText(process.env.POSTGRES_USER || process.env.PGUSER)
    && cleanText(process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD),
  );
  const ready = hasConnectionString || hasSplitConfig;

  return createStatus(
    "database",
    "Base de dados",
    ready,
    poolerUrl
      ? "Ligacao da base de dados configurada com reforco de desempenho."
      : hasConnectionString
        ? "Ligacao da base de dados configurada por endereco unico."
        : hasSplitConfig
          ? "Ligacao da base de dados configurada por dados separados."
          : "Falta a configuracao de ligacao da base de dados.",
    ready
      ? []
      : ["POSTGRES_POOLER_URL ou DATABASE_URL ou POSTGRES_HOST/POSTGRES_DATABASE/POSTGRES_USER/POSTGRES_PASSWORD"],
    {
      nextStep:
        "Define a ligacao real da base de dados usada pelas funcoes do sistema. Em staging/producao, prefere POSTGRES_POOLER_URL com POSTGRES_USE_POOLER=true.",
    },
  );
}

export function getSystemReadiness() {
  const items = [
    getDatabaseStatus(),
    getCatalogApiStatus(),
    getNativeAppSessionStatus(),
    getPasswordResetEmailStatus(),
    getWhatsAppCloudStatus(),
    getNotificationDispatchStatus(),
    getMediaStorageStatus(),
  ];

  const readyCount = items.filter((item) => item.ready).length;
  const requiredItems = items.filter((item) => item.required);
  const requiredReadyCount = requiredItems.filter((item) => item.ready).length;
  const missingVariables = [...new Set(items.flatMap((item) => item.missing || []))];

  return {
    items,
    readyCount,
    totalCount: items.length,
    requiredReadyCount,
    requiredTotalCount: requiredItems.length,
    coreReady: requiredReadyCount === requiredItems.length,
    ready: readyCount === items.length,
    missingVariables,
  };
}
