import {
  buildFunctionsBaseUrl,
  buildRequestError,
  buildSyntheticProducts,
  fetchAdminCatalog,
  fetchPublicCatalog,
  fetchSuperAdminDashboard,
  formatNumber,
  isDirectRun,
  loginWithCookieJar,
  parseArgs,
  parseBoolean,
  parsePositiveInt,
  readConfigValue,
  requestJson,
} from "./loadtest/common.mjs";

function buildStorePayload(currentStore, options = {}) {
  const storeName = String(options.storeName || "").trim();
  const description =
    String(options.storeDescription || "").trim()
    || `Catalogo sintetico para testes de carga com ${options.productCount} produtos.`;

  return {
    ...currentStore,
    name: storeName || currentStore?.name || "Load Test Store",
    description,
    publicEnabled: options.publicEnabled,
    pickupNote: currentStore?.pickupNote || "Retirada disponivel mediante confirmacao.",
    whatsappOrderFormat: currentStore?.whatsappOrderFormat || "text_only",
  };
}

async function ensureMerchantPlanCapacity({
  functionsBaseUrl,
  merchantSession,
  currentReferenceId,
  currentPlanStatus,
  requestedProductCount,
  superAdminEmail,
  superAdminPassword,
  preferredPlanId,
  planDurationDays,
  timeoutMs,
}) {
  if (requestedProductCount <= 10 && String(currentPlanStatus || "").toLowerCase() === "trial") {
    return {
      changed: false,
      reason: "A conta continua em trial porque o catalogo pedido cabe no limite atual.",
      selectedPlanId: "",
    };
  }

  if (!superAdminEmail || !superAdminPassword) {
    return {
      changed: false,
      reason: "Sem credenciais de super admin. O seed assume que a loja de teste ja tem plano ativo suficiente.",
      selectedPlanId: "",
    };
  }

  const superAdminSession = await loginWithCookieJar(functionsBaseUrl, superAdminEmail, superAdminPassword, timeoutMs);
  const dashboard = await fetchSuperAdminDashboard(functionsBaseUrl, superAdminSession.cookieHeader, timeoutMs);
  const plans = Array.isArray(dashboard?.plans) ? dashboard.plans : [];
  const selectedPlan =
    plans.find((plan) => plan.id === preferredPlanId)
    || plans.find((plan) => plan.active)
    || null;

  if (!selectedPlan) {
    throw new Error("Nao foi possivel encontrar um plano ativo no super admin para preparar a loja de teste.");
  }

  const result = await requestJson({
    url: `${functionsBaseUrl}/super-admin-client-save`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cookie: superAdminSession.cookieHeader,
    body: JSON.stringify({
      userId: merchantSession?.data?.user?.id || "",
      accountStatus: "active",
      planId: selectedPlan.id,
      planStatus: "active",
      planStartedAt: new Date().toISOString().slice(0, 10),
      planDurationDays: String(planDurationDays),
      publicEnabled: true,
      referenceId: currentReferenceId || merchantSession?.data?.referenceId || "",
      internalNotes: `Seed sintetico de carga para ${requestedProductCount} produtos.`,
    }),
    timeoutMs,
  });

  if (!result.ok) {
    throw buildRequestError(result, "Nao foi possivel ativar um plano para a loja de teste.");
  }

  return {
    changed: true,
    reason: `Loja preparada com o plano ${selectedPlan.name || selectedPlan.code || selectedPlan.id}.`,
    selectedPlanId: selectedPlan.id,
  };
}

async function seedSyntheticCatalog(options = {}) {
  const functionsBaseUrl = buildFunctionsBaseUrl(options.baseUrl);
  const timeoutMs = parsePositiveInt(options.timeoutMs, 45000);
  const productCount = parsePositiveInt(options.productCount, 100);
  const publicEnabled = options.publicEnabled !== false;
  const categoryCount = parsePositiveInt(options.categoryCount, 10);
  const planDurationDays = parsePositiveInt(options.planDurationDays, 30);

  const merchantSession = await loginWithCookieJar(
    functionsBaseUrl,
    options.merchantEmail,
    options.merchantPassword,
    timeoutMs,
  );

  const merchantStoreId = options.storeId || merchantSession?.data?.storeId;
  if (!merchantStoreId) {
    throw new Error("A conta de lojista nao devolveu storeId. Verifica se a loja de teste existe e esta ligada ao utilizador.");
  }

  const currentAdminCatalog = await fetchAdminCatalog(
    functionsBaseUrl,
    merchantStoreId,
    merchantSession.cookieHeader,
    timeoutMs,
  );
  const currentStore = currentAdminCatalog?.store || {};

  const planPreparation = await ensureMerchantPlanCapacity({
    functionsBaseUrl,
    merchantSession,
    currentReferenceId: merchantSession?.data?.referenceId || "",
    currentPlanStatus: merchantSession?.data?.planStatus || "",
    requestedProductCount: productCount,
    superAdminEmail: options.superAdminEmail,
    superAdminPassword: options.superAdminPassword,
    preferredPlanId: options.planId,
    planDurationDays,
    timeoutMs,
  });

  const storePayload = buildStorePayload(currentStore, {
    productCount,
    storeName: options.storeName,
    storeDescription: options.storeDescription,
    publicEnabled,
  });
  const products = buildSyntheticProducts({
    productCount,
    prefix: options.productPrefix || storePayload.name || "Load Test",
    categoryCount,
  });

  const saveResult = await requestJson({
    url: `${functionsBaseUrl}/catalog-save`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cookie: merchantSession.cookieHeader,
    body: JSON.stringify({
      id: merchantStoreId,
      store: storePayload,
      products,
    }),
    timeoutMs: Math.max(timeoutMs, 120000),
  });

  if (!saveResult.ok) {
    const maybeTrialLimit = String(saveResult?.jsonBody?.error || "").toLowerCase();
    if (maybeTrialLimit.includes("trial permite ate")) {
      throw new Error(
        "O seed bateu no limite de produtos do plano Trial. Ativa um plano na loja de teste ou informa credenciais de super admin para o script preparar a conta.",
      );
    }
    throw buildRequestError(saveResult, "Nao foi possivel gravar o catalogo sintetico.");
  }

  const publicCatalog = await fetchPublicCatalog(functionsBaseUrl, merchantStoreId, timeoutMs);
  const adminCatalog = await fetchAdminCatalog(functionsBaseUrl, merchantStoreId, merchantSession.cookieHeader, timeoutMs);

  return {
    baseUrl: functionsBaseUrl,
    storeId: merchantStoreId,
    planPreparation,
    merchantSession: {
      userId: merchantSession?.data?.user?.id || "",
      email: merchantSession?.data?.user?.email || options.merchantEmail,
      planStatus: merchantSession?.data?.planStatus || "",
    },
    store: {
      name: adminCatalog?.store?.name || storePayload.name,
      publicEnabled: Boolean(adminCatalog?.store?.publicEnabled),
      referenceId: merchantSession?.data?.referenceId || "",
    },
    productCountRequested: productCount,
    productCountSaved: Array.isArray(adminCatalog?.products) ? adminCatalog.products.length : 0,
    productCountPublic: Array.isArray(publicCatalog?.products) ? publicCatalog.products.length : 0,
    categoriesRequested: categoryCount,
    sampleProducts: products.slice(0, 3),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = parseBoolean(readConfigValue(args, "dryRun", "LOADTEST_DRY_RUN", "false"));
  const baseUrl = readConfigValue(args, "baseUrl", "LOADTEST_BASE_URL");
  const merchantEmail = readConfigValue(args, "merchantEmail", "LOADTEST_MERCHANT_EMAIL");
  const merchantPassword = readConfigValue(args, "merchantPassword", "LOADTEST_MERCHANT_PASSWORD");
  const productCount = parsePositiveInt(readConfigValue(args, "productCount", "LOADTEST_PRODUCT_COUNT", "100"), 100);
  const categoryCount = parsePositiveInt(readConfigValue(args, "categoryCount", "LOADTEST_CATEGORY_COUNT", "10"), 10);

  if (dryRun) {
    const sampleProducts = buildSyntheticProducts({
      productCount,
      prefix: readConfigValue(args, "productPrefix", "LOADTEST_PRODUCT_PREFIX", "Load Test"),
      categoryCount,
    }).slice(0, 3);

    console.log("Dry run do seed sintetico");
    console.log(`Produtos: ${productCount}`);
    console.log(`Categorias: ${categoryCount}`);
    console.log(`Exemplo de produtos: ${JSON.stringify(sampleProducts, null, 2)}`);
    return;
  }

  if (!baseUrl || !merchantEmail || !merchantPassword) {
    throw new Error("Define --baseUrl, --merchantEmail e --merchantPassword para semear o catalogo em staging.");
  }

  const result = await seedSyntheticCatalog({
    baseUrl,
    merchantEmail,
    merchantPassword,
    superAdminEmail: readConfigValue(args, "superAdminEmail", "LOADTEST_SUPER_ADMIN_EMAIL"),
    superAdminPassword: readConfigValue(args, "superAdminPassword", "LOADTEST_SUPER_ADMIN_PASSWORD"),
    productCount,
    categoryCount,
    productPrefix: readConfigValue(args, "productPrefix", "LOADTEST_PRODUCT_PREFIX", "Load Test"),
    storeName: readConfigValue(args, "storeName", "LOADTEST_STORE_NAME"),
    storeDescription: readConfigValue(args, "storeDescription", "LOADTEST_STORE_DESCRIPTION"),
    planId: readConfigValue(args, "planId", "LOADTEST_PLAN_ID"),
    planDurationDays: parsePositiveInt(readConfigValue(args, "planDurationDays", "LOADTEST_PLAN_DURATION_DAYS", "30"), 30),
    publicEnabled: parseBoolean(readConfigValue(args, "publicEnabled", "LOADTEST_PUBLIC_ENABLED", "true"), true),
    timeoutMs: parsePositiveInt(readConfigValue(args, "timeoutMs", "LOADTEST_TIMEOUT_MS", "45000"), 45000),
  });

  console.log("Seed sintetico concluido");
  console.log(`Loja: ${result.store.name} (${result.storeId})`);
  console.log(`Plano: ${result.merchantSession.planStatus || "(consultar auth-me)"}`);
  console.log(`Produtos guardados: ${formatNumber(result.productCountSaved, 0)}`);
  console.log(`Produtos publicos: ${formatNumber(result.productCountPublic, 0)}`);
  console.log(`Plano/preparacao: ${result.planPreparation.reason}`);
}

export { seedSyntheticCatalog };

if (isDirectRun(import.meta.url)) {
  main().catch((error) => {
    console.error("Falha no seed sintetico.");
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
