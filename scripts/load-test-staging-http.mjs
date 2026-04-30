import { performance } from "node:perf_hooks";
import { isMainThread, parentPort, workerData, Worker } from "node:worker_threads";
import {
  buildFunctionsBaseUrl,
  buildRequestError,
  buildSiteBaseUrl,
  buildSyntheticOrderPayload,
  createSessionPool,
  fetchAdminCatalog,
  fetchPublicCatalog,
  formatNumber,
  isDirectRun,
  loginWithCookieJar,
  parseArgs,
  parseBoolean,
  parseNonNegativeInt,
  parsePositiveInt,
  parseStages,
  readConfigValue,
  requestJson,
  summarizeStageResults,
  writeReportArtifacts,
} from "./loadtest/common.mjs";
import { seedSyntheticCatalog } from "./seed-staging-synthetic-catalog.mjs";

const DEFAULT_CATALOG_STAGES = "1x10x15,2x10x15,4x10x15,8x10x15";
const DEFAULT_ORDER_STAGES = "1x4x15,2x4x15,4x4x15";
const DEFAULT_MERCHANT_STAGES = "1x2x15,2x2x15,4x2x15";
const DEFAULT_MERCHANT_PAGE_LIMIT = 50;
const DEFAULT_SCENARIOS = ["catalog-get", "merchant-orders", "order-create"];

const SCENARIO_THRESHOLDS = Object.freeze({
  "catalog-get": { p95Ms: 500, p99Ms: 1500, errorRate: 1 },
  "merchant-orders": { p95Ms: 1200, p99Ms: 3000, errorRate: 1 },
  "order-create": { p95Ms: 1200, p99Ms: 2500, errorRate: 1 },
});

function normalizeScenarioList(rawScenarios) {
  const requested = String(rawScenarios || "")
    .trim()
    .toLowerCase();

  if (!requested || requested === "all") {
    return [...DEFAULT_SCENARIOS];
  }

  const normalized = requested
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const supported = new Set(DEFAULT_SCENARIOS);
  const invalid = normalized.filter((entry) => !supported.has(entry));
  if (invalid.length) {
    throw new Error(`Cenarios nao suportados: ${invalid.join(", ")}.`);
  }

  return normalized;
}

function buildScenarioThresholds(scenarioName) {
  return SCENARIO_THRESHOLDS[scenarioName] || SCENARIO_THRESHOLDS["catalog-get"];
}

function evaluateStageHealth(stageResult, thresholds) {
  if (!stageResult) return false;

  return (
    stageResult.errorRate <= thresholds.errorRate
    && stageResult.latencySummary.p95Ms <= thresholds.p95Ms
    && stageResult.latencySummary.p99Ms <= thresholds.p99Ms
  );
}

function detectScenarioDegradation(stageResults = [], scenarioName) {
  const thresholds = buildScenarioThresholds(scenarioName);
  let lastHealthy = null;
  let firstDegraded = null;

  for (const stageResult of stageResults) {
    const healthy = evaluateStageHealth(stageResult, thresholds);
    if (healthy) {
      lastHealthy = stageResult;
      continue;
    }

    firstDegraded = stageResult;
    break;
  }

  const recommendedBase = lastHealthy || stageResults[0] || null;
  return {
    thresholds,
    firstDegraded,
    lastHealthy,
    recommendedTarget: recommendedBase
      ? {
          concurrency: Math.max(1, Math.floor(recommendedBase.totalConcurrency * 0.7)),
          requestsPerSecond: Math.max(1, Math.floor(recommendedBase.requestsPerSecond * 0.7)),
        }
      : {
          concurrency: 0,
          requestsPerSecond: 0,
        },
  };
}

async function prefillOrders({
  functionsBaseUrl,
  storeId,
  products,
  currentOrderCount,
  targetOrderCount,
  concurrency,
  timeoutMs,
}) {
  const missingOrders = Math.max(0, targetOrderCount - currentOrderCount);
  if (!missingOrders) {
    return {
      requested: targetOrderCount,
      before: currentOrderCount,
      created: 0,
      after: currentOrderCount,
      durationSeconds: 0,
      errors: 0,
    };
  }

  let nextIndex = currentOrderCount;
  let created = 0;
  let errors = 0;
  const startedAt = performance.now();

  async function loop() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= currentOrderCount + missingOrders) {
        return;
      }

      const payload = buildSyntheticOrderPayload(storeId, products, currentIndex);
      const result = await requestJson({
        url: `${functionsBaseUrl}/order-create`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        timeoutMs,
      });

      if (!result.ok) {
        errors += 1;
        throw buildRequestError(result, "Falha ao pre-preencher pedidos sinteticos.");
      }

      created += 1;
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => loop()),
  );

  return {
    requested: targetOrderCount,
    before: currentOrderCount,
    created,
    after: currentOrderCount + created,
    durationSeconds: (performance.now() - startedAt) / 1000,
    errors,
  };
}

function buildScenarioDefinitions({
  scenarios,
  functionsBaseUrl,
  storeId,
  products,
  merchantSessionCookies,
  merchantPageLimit,
  timeoutMs,
  catalogStages,
  orderStages,
  merchantStages,
}) {
  const definitions = [];

  if (scenarios.includes("catalog-get")) {
    definitions.push({
      name: "catalog-get",
      displayName: "Catalogo Publico",
      stages: catalogStages,
      timeoutMs,
      workerInput: {
        scenarioName: "catalog-get",
        functionsBaseUrl,
        storeId,
      },
    });
  }

  if (scenarios.includes("merchant-orders")) {
    definitions.push({
      name: "merchant-orders",
      displayName: "Lista do Lojista",
      stages: merchantStages,
      timeoutMs,
      workerInput: {
        scenarioName: "merchant-orders",
        functionsBaseUrl,
        sessionCookies: merchantSessionCookies,
        merchantPageLimit,
      },
    });
  }

  if (scenarios.includes("order-create")) {
    definitions.push({
      name: "order-create",
      displayName: "Criacao de Pedido",
      stages: orderStages,
      timeoutMs,
      workerInput: {
        scenarioName: "order-create",
        functionsBaseUrl,
        storeId,
        products,
      },
    });
  }

  return definitions;
}

async function runWorkerScenario({ stage, scenarioDefinition }) {
  const stageStart = performance.now();
  const workers = Array.from({ length: stage.workers }, (_, workerIndex) =>
    new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: {
          ...scenarioDefinition.workerInput,
          timeoutMs: scenarioDefinition.timeoutMs,
          workerIndex,
          concurrency: stage.concurrencyPerWorker,
          durationSeconds: stage.durationSeconds,
        },
      });

      worker.once("message", resolve);
      worker.once("error", reject);
      worker.once("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker terminou com codigo ${code}.`));
        }
      });
    }),
  );

  const workerResults = await Promise.all(workers);
  const elapsedSeconds = (performance.now() - stageStart) / 1000;
  const summary = summarizeStageResults(workerResults, elapsedSeconds);

  return {
    ...stage,
    ...summary,
    elapsedSeconds,
  };
}

function printStageSummary(scenarioDefinition, stageResult) {
  console.log("");
  console.log(`${scenarioDefinition.displayName} | Stage ${stageResult.label}`);
  console.log(
    `Conc total: ${stageResult.totalConcurrency} | Requests: ${stageResult.requestCount} | RPS: ${formatNumber(stageResult.requestsPerSecond)} | Erros: ${stageResult.errorCount} (${formatNumber(stageResult.errorRate)}%)`,
  );
  console.log(
    `Latencia ms | avg ${formatNumber(stageResult.latencySummary.avgMs)} | p50 ${formatNumber(stageResult.latencySummary.p50Ms)} | p95 ${formatNumber(stageResult.latencySummary.p95Ms)} | p99 ${formatNumber(stageResult.latencySummary.p99Ms)} | max ${formatNumber(stageResult.latencySummary.maxMs)}`,
  );
  console.log(
    `Throughput resposta: ${formatNumber(stageResult.megabytesPerSecond, 3)} MB/s | Status: ${JSON.stringify(stageResult.statusCounts)}`,
  );
}

function buildMarkdownReport({
  reportLabel,
  siteBaseUrl,
  merchantPageLimit,
  seedSummary,
  storeSummary,
  prefillSummary,
  scenarioReports,
}) {
  const lines = [];
  lines.push(`# ${reportLabel}`);
  lines.push("");
  lines.push(`- Ambiente: ${siteBaseUrl}`);
  lines.push(`- Loja: ${storeSummary.name} (${storeSummary.storeId})`);
  lines.push(`- Produtos visiveis: ${storeSummary.productCount}`);
  lines.push(`- Pedidos atuais antes do teste: ${storeSummary.orderCount}`);
  lines.push(`- Merchant page limit: ${merchantPageLimit}`);

  if (seedSummary) {
    lines.push(`- Seed previo: ${seedSummary.productCountSaved}/${seedSummary.productCountRequested} produtos`);
    lines.push(`- Preparacao de plano: ${seedSummary.planPreparation.reason}`);
  }

  if (prefillSummary) {
    lines.push(
      `- Prefill de pedidos: ${prefillSummary.created} criados (${prefillSummary.before} -> ${prefillSummary.after}) em ${formatNumber(prefillSummary.durationSeconds)}s`,
    );
  }

  for (const scenario of scenarioReports) {
    const degradation = scenario.degradation;
    lines.push("");
    lines.push(`## ${scenario.displayName}`);
    lines.push("");
    lines.push("| Stage | Conc total | Requests | RPS | p95 ms | p99 ms | Error % |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

    for (const stage of scenario.stageResults) {
      lines.push(
        `| ${stage.label} | ${stage.totalConcurrency} | ${stage.requestCount} | ${formatNumber(stage.requestsPerSecond)} | ${formatNumber(stage.latencySummary.p95Ms)} | ${formatNumber(stage.latencySummary.p99Ms)} | ${formatNumber(stage.errorRate)} |`,
      );
    }

    lines.push("");
    if (degradation.firstDegraded) {
      lines.push(
        `Ponto de degradacao observado: \`${degradation.firstDegraded.label}\` com p95 ${formatNumber(degradation.firstDegraded.latencySummary.p95Ms)} ms, p99 ${formatNumber(degradation.firstDegraded.latencySummary.p99Ms)} ms e erro ${formatNumber(degradation.firstDegraded.errorRate)}%.`,
      );
    } else {
      lines.push("Ponto de degradacao nao foi atingido nas stages executadas.");
    }

    if (degradation.lastHealthy) {
      lines.push(
        `Ultima stage saudavel: \`${degradation.lastHealthy.label}\`. Meta operacional conservadora sugerida: ate ${degradation.recommendedTarget.concurrency} concorrentes e ~${degradation.recommendedTarget.requestsPerSecond} RPS para este cenario.`,
      );
    } else {
      lines.push("Nenhuma stage ficou dentro dos thresholds definidos; revisto ajuste de carga ou arquitetura antes de escalar.");
    }
  }

  lines.push("");
  lines.push("## Thresholds");
  lines.push("");
  for (const scenario of scenarioReports) {
    lines.push(
      `- ${scenario.displayName}: p95 <= ${scenario.degradation.thresholds.p95Ms} ms, p99 <= ${scenario.degradation.thresholds.p99Ms} ms, erro <= ${scenario.degradation.thresholds.errorRate}%`,
    );
  }

  return `${lines.join("\n")}\n`;
}

async function runMainThread() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = parseBoolean(readConfigValue(args, "dryRun", "LOADTEST_DRY_RUN", "false"));
  const baseUrl = readConfigValue(args, "baseUrl", "LOADTEST_BASE_URL");
  const merchantEmail = readConfigValue(args, "merchantEmail", "LOADTEST_MERCHANT_EMAIL");
  const merchantPassword = readConfigValue(args, "merchantPassword", "LOADTEST_MERCHANT_PASSWORD");
  const functionsBaseUrl = baseUrl ? buildFunctionsBaseUrl(baseUrl) : "";
  const siteBaseUrl = buildSiteBaseUrl(baseUrl);
  const reportLabel = readConfigValue(args, "reportLabel", "LOADTEST_REPORT_LABEL", "staging-load-test");
  const timeoutMs = parsePositiveInt(readConfigValue(args, "timeoutMs", "LOADTEST_TIMEOUT_MS", "30000"), 30000);
  const sessionPoolSize = parsePositiveInt(readConfigValue(args, "privateSessionPoolSize", "LOADTEST_PRIVATE_SESSION_POOL_SIZE", "4"), 4);
  const prefillTargetOrders = parseNonNegativeInt(readConfigValue(args, "prefillOrders", "LOADTEST_PREFILL_ORDERS", "0"), 0);
  const prefillConcurrency = parsePositiveInt(readConfigValue(args, "prefillConcurrency", "LOADTEST_PREFILL_CONCURRENCY", "8"), 8);
  const merchantPageLimit = parsePositiveInt(
    readConfigValue(args, "merchantPageLimit", "LOADTEST_MERCHANT_PAGE_LIMIT", String(DEFAULT_MERCHANT_PAGE_LIMIT)),
    DEFAULT_MERCHANT_PAGE_LIMIT,
  );
  const scenarios = normalizeScenarioList(readConfigValue(args, "scenarios", "LOADTEST_SCENARIOS", "all"));
  const catalogStages = parseStages(readConfigValue(args, "catalogStages", "LOADTEST_CATALOG_STAGES", DEFAULT_CATALOG_STAGES), DEFAULT_CATALOG_STAGES);
  const orderStages = parseStages(readConfigValue(args, "orderStages", "LOADTEST_ORDER_STAGES", DEFAULT_ORDER_STAGES), DEFAULT_ORDER_STAGES);
  const merchantStages = parseStages(readConfigValue(args, "merchantStages", "LOADTEST_MERCHANT_STAGES", DEFAULT_MERCHANT_STAGES), DEFAULT_MERCHANT_STAGES);
  const seedProductCount = parseNonNegativeInt(readConfigValue(args, "seedProductCount", "LOADTEST_SEED_PRODUCT_COUNT", "0"), 0);

  if (dryRun) {
    console.log("Dry run do load test HTTP");
    console.log(`Base URL: ${baseUrl || "(nao definida)"}`);
    console.log(`Cenarios: ${scenarios.join(", ")}`);
    console.log(`Seed previo: ${seedProductCount || 0} produtos`);
    console.log(`Merchant page limit: ${merchantPageLimit}`);
    console.log(`Catalog stages: ${catalogStages.map((stage) => stage.label).join(", ")}`);
    console.log(`Merchant stages: ${merchantStages.map((stage) => stage.label).join(", ")}`);
    console.log(`Order stages: ${orderStages.map((stage) => stage.label).join(", ")}`);
    return;
  }

  if (!functionsBaseUrl || !merchantEmail || !merchantPassword) {
    throw new Error("Define --baseUrl, --merchantEmail e --merchantPassword antes de correr o load test de staging.");
  }

  let seedSummary = null;
  if (seedProductCount > 0) {
    seedSummary = await seedSyntheticCatalog({
      baseUrl,
      merchantEmail,
      merchantPassword,
      superAdminEmail: readConfigValue(args, "superAdminEmail", "LOADTEST_SUPER_ADMIN_EMAIL"),
      superAdminPassword: readConfigValue(args, "superAdminPassword", "LOADTEST_SUPER_ADMIN_PASSWORD"),
      productCount: seedProductCount,
      categoryCount: parsePositiveInt(readConfigValue(args, "categoryCount", "LOADTEST_CATEGORY_COUNT", "10"), 10),
      productPrefix: readConfigValue(args, "productPrefix", "LOADTEST_PRODUCT_PREFIX", "Load Test"),
      storeName: readConfigValue(args, "storeName", "LOADTEST_STORE_NAME"),
      storeDescription: readConfigValue(args, "storeDescription", "LOADTEST_STORE_DESCRIPTION"),
      planId: readConfigValue(args, "planId", "LOADTEST_PLAN_ID"),
      planDurationDays: parsePositiveInt(readConfigValue(args, "planDurationDays", "LOADTEST_PLAN_DURATION_DAYS", "30"), 30),
      publicEnabled: true,
      timeoutMs: Math.max(timeoutMs, 45000),
    });
  }

  const merchantSessions = await createSessionPool(
    functionsBaseUrl,
    merchantEmail,
    merchantPassword,
    sessionPoolSize,
  );
  const primaryMerchantSession = merchantSessions[0];
  const storeId = readConfigValue(args, "storeId", "LOADTEST_STORE_ID", primaryMerchantSession?.data?.storeId || "");

  if (!storeId) {
    throw new Error("Nao foi possivel determinar o storeId do lojista de teste.");
  }

  const [adminCatalog, publicCatalog] = await Promise.all([
    fetchAdminCatalog(functionsBaseUrl, storeId, primaryMerchantSession.cookieHeader, timeoutMs),
    fetchPublicCatalog(functionsBaseUrl, storeId, timeoutMs),
  ]);

  const merchantOrdersSnapshot = await requestJson({
    url: `${functionsBaseUrl}/merchant-orders?tzOffsetMinutes=0&limit=${merchantPageLimit}`,
    method: "GET",
    cookie: primaryMerchantSession.cookieHeader,
    timeoutMs,
  });
  if (!merchantOrdersSnapshot.ok) {
    throw buildRequestError(merchantOrdersSnapshot, "Nao foi possivel consultar as encomendas do lojista antes do teste.");
  }

  const currentOrders = Array.isArray(merchantOrdersSnapshot?.jsonBody?.orders)
    ? merchantOrdersSnapshot.jsonBody.orders
    : [];
  const currentOrderCount = Number(merchantOrdersSnapshot?.jsonBody?.summary?.totalCount || currentOrders.length);

  let prefillSummary = null;
  if (prefillTargetOrders > 0) {
    prefillSummary = await prefillOrders({
      functionsBaseUrl,
      storeId,
      products: Array.isArray(publicCatalog?.products) ? publicCatalog.products : [],
      currentOrderCount,
      targetOrderCount: prefillTargetOrders,
      concurrency: prefillConcurrency,
      timeoutMs,
    });
  }

  const scenarioDefinitions = buildScenarioDefinitions({
    scenarios,
    functionsBaseUrl,
    storeId,
    products: Array.isArray(publicCatalog?.products) ? publicCatalog.products : [],
    merchantSessionCookies: merchantSessions.map((entry) => entry.cookieHeader),
    merchantPageLimit,
    timeoutMs,
    catalogStages,
    orderStages,
    merchantStages,
  });

  const scenarioReports = [];
  console.log("Teste de carga HTTP em staging");
  console.log(`Ambiente: ${siteBaseUrl}`);
  console.log(`Loja: ${adminCatalog?.store?.name || "(sem nome)"} (${storeId})`);
  console.log(`Produtos: ${Array.isArray(publicCatalog?.products) ? publicCatalog.products.length : 0}`);
  console.log(`Sessoes privadas no pool: ${merchantSessions.length}`);
  console.log(`Merchant page limit: ${merchantPageLimit}`);
  if (prefillSummary) {
    console.log(`Prefill de pedidos: ${prefillSummary.before} -> ${prefillSummary.after}`);
  }

  for (const scenarioDefinition of scenarioDefinitions) {
    const stageResults = [];
    for (const stage of scenarioDefinition.stages) {
      const stageResult = await runWorkerScenario({ stage, scenarioDefinition });
      stageResults.push(stageResult);
      printStageSummary(scenarioDefinition, stageResult);
    }

    scenarioReports.push({
      name: scenarioDefinition.name,
      displayName: scenarioDefinition.displayName,
      stageResults,
      degradation: detectScenarioDegradation(stageResults, scenarioDefinition.name),
    });
  }

  const reportPayload = {
    generatedAt: new Date().toISOString(),
    reportLabel,
    merchantPageLimit,
    environment: {
      siteBaseUrl,
      functionsBaseUrl,
    },
    config: {
      merchantPageLimit,
    },
    seedSummary,
    storeSummary: {
      storeId,
      name: adminCatalog?.store?.name || "",
      productCount: Array.isArray(publicCatalog?.products) ? publicCatalog.products.length : 0,
      orderCount: currentOrderCount,
      publicEnabled: Boolean(publicCatalog?.store?.publicEnabled),
    },
    prefillSummary,
    scenarioReports,
  };
  const markdownReport = buildMarkdownReport(reportPayload);
  const artifactPaths = writeReportArtifacts({
    reportLabel,
    jsonPayload: reportPayload,
    markdown: markdownReport,
  });

  console.log("");
  console.log("Relatorio gerado");
  console.log(`JSON: ${artifactPaths.jsonPath}`);
  console.log(`Markdown: ${artifactPaths.markdownPath}`);
}

async function runWorkerThread() {
  const {
    scenarioName,
    functionsBaseUrl,
    storeId,
    sessionCookies = [],
    products = [],
    merchantPageLimit = DEFAULT_MERCHANT_PAGE_LIMIT,
    workerIndex = 0,
    concurrency = 1,
    durationSeconds = 10,
    timeoutMs = 30000,
  } = workerData || {};

  const deadline = performance.now() + durationSeconds * 1000;
  const latencies = [];
  const statusCounts = {};
  let errorCount = 0;
  let bytes = 0;
  let requestCount = 0;
  let nextRequestIndex = workerIndex * 1_000_000;
  const sessionCookie = Array.isArray(sessionCookies) && sessionCookies.length
    ? sessionCookies[workerIndex % sessionCookies.length]
    : "";

  async function loop() {
    while (performance.now() < deadline) {
      const startedAt = performance.now();
      let result;

      try {
        if (scenarioName === "catalog-get") {
          result = await requestJson({
            url: `${functionsBaseUrl}/catalog-get?id=${encodeURIComponent(storeId)}`,
            method: "GET",
            timeoutMs,
          });
        } else if (scenarioName === "merchant-orders") {
          result = await requestJson({
            url: `${functionsBaseUrl}/merchant-orders?tzOffsetMinutes=0&limit=${merchantPageLimit}`,
            method: "GET",
            cookie: sessionCookie,
            timeoutMs,
          });
        } else if (scenarioName === "order-create") {
          const payload = buildSyntheticOrderPayload(storeId, products, nextRequestIndex);
          nextRequestIndex += 1;
          result = await requestJson({
            url: `${functionsBaseUrl}/order-create`,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            timeoutMs,
          });
        } else {
          throw new Error(`Scenario nao suportado no worker: ${scenarioName}`);
        }

        const elapsedMs = performance.now() - startedAt;
        latencies.push(elapsedMs);
        requestCount += 1;
        bytes += Number(result.bytes || 0);
        const status = String(result.status || 0);
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (!result.ok) {
          errorCount += 1;
        }
      } catch (error) {
        const elapsedMs = performance.now() - startedAt;
        latencies.push(elapsedMs);
        requestCount += 1;
        errorCount += 1;
        statusCounts.error = (statusCounts.error || 0) + 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => loop()));

  return {
    requestCount,
    errorCount,
    bytes,
    statusCounts,
    latencies,
  };
}

if (isMainThread) {
  if (isDirectRun(import.meta.url)) {
    runMainThread().catch((error) => {
      console.error("Falha no load test HTTP de staging.");
      console.error(error.message || error);
      process.exitCode = 1;
    });
  }
} else {
  runWorkerThread()
    .then((result) => {
      parentPort.postMessage(result);
    })
    .catch((error) => {
      parentPort.postMessage({
        requestCount: 0,
        errorCount: 1,
        bytes: 0,
        statusCounts: { error: 1 },
        latencies: [],
        workerError: error.message || String(error),
      });
    });
}
