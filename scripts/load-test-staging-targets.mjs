import { spawn } from "node:child_process";
import path from "node:path";
import { loadLocalEnv } from "./loadEnv.mjs";
import {
  parseArgs,
  parseBoolean,
  parsePositiveInt,
  parsePositiveIntList,
  readConfigValue,
} from "./loadtest/common.mjs";

function parsePositiveNumberList(value, fallback = []) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return [...fallback];
  }

  return normalized
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

function normalizeRatioList(values = [], fallback = [0.1, 0.25, 0.5, 1]) {
  const source = values.length ? values : fallback;
  const normalized = source.map((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    if (numeric > 1.5 && numeric <= 100) {
      return numeric / 100;
    }
    return numeric;
  });

  const filtered = normalized
    .filter((entry) => entry > 0)
    .map((entry) => Math.min(entry, 1))
    .sort((left, right) => left - right);

  if (!filtered.length) {
    return [...fallback];
  }

  if (filtered[filtered.length - 1] < 1) {
    filtered.push(1);
  } else {
    filtered[filtered.length - 1] = 1;
  }

  return filtered;
}

function normalizeDurationList(values = [], ratios = []) {
  const filtered = values
    .map((value) => parsePositiveInt(value, 0))
    .filter((entry) => entry > 0);

  if (!filtered.length) {
    return ratios.map((_, index) => (index === ratios.length - 1 ? 30 : 20));
  }

  const durations = [];
  for (let index = 0; index < ratios.length; index += 1) {
    durations.push(filtered[index] || filtered[filtered.length - 1]);
  }

  return durations;
}

function buildTargetDefaults(target) {
  if (target >= 10000) {
    return {
      seedProductCount: 1000,
      prefillOrders: 10000,
      prefillConcurrency: 16,
    };
  }

  if (target >= 5000) {
    return {
      seedProductCount: 600,
      prefillOrders: 5000,
      prefillConcurrency: 12,
    };
  }

  return {
    seedProductCount: 300,
    prefillOrders: 1000,
    prefillConcurrency: 8,
  };
}

function formatStageLabel(workers, concurrencyPerWorker, durationSeconds) {
  return `${workers}x${concurrencyPerWorker}x${durationSeconds}`;
}

function buildStageSpecs(target, options = {}) {
  const {
    factor = 1,
    ratios = [0.1, 0.25, 0.5, 1],
    durations = [15, 20, 20, 30],
    maxWorkers = 24,
    targetConcurrencyPerWorker = 125,
  } = options;

  const effectiveTarget = Math.max(1, Math.round(Number(target || 0) * Number(factor || 1)));
  const specs = [];
  let lastStageTarget = 0;

  for (let index = 0; index < ratios.length; index += 1) {
    const ratio = Number(ratios[index] || 0);
    const durationSeconds = parsePositiveInt(durations[index], 20);
    const rawTarget =
      index === ratios.length - 1
        ? effectiveTarget
        : Math.max(1, Math.round(effectiveTarget * ratio));
    const stageTarget = Math.max(lastStageTarget + 1, Math.min(effectiveTarget, rawTarget));
    lastStageTarget = stageTarget;

    const workers = Math.min(
      Math.max(1, parsePositiveInt(maxWorkers, 24)),
      Math.max(1, Math.ceil(stageTarget / Math.max(1, parsePositiveInt(targetConcurrencyPerWorker, 125)))),
    );
    const concurrencyPerWorker = Math.max(1, Math.ceil(stageTarget / workers));

    specs.push({
      targetConcurrency: stageTarget,
      totalConcurrency: workers * concurrencyPerWorker,
      workers,
      concurrencyPerWorker,
      durationSeconds,
      label: formatStageLabel(workers, concurrencyPerWorker, durationSeconds),
    });
  }

  return specs;
}

function formatStageSpecs(specs = []) {
  return specs.map((entry) => entry.label).join(",");
}

function buildSessionPoolSize(stageSpecs = [], fallback = 4) {
  const maxWorkers = stageSpecs.reduce(
    (maxValue, stage) => Math.max(maxValue, Number(stage?.workers || 0)),
    0,
  );
  return Math.max(fallback, maxWorkers);
}

function stripHandledArgs(argv = []) {
  const passthrough = [];
  const handledKeys = new Set([
    "catalogConcurrencyPerWorker",
    "catalogTargetFactor",
    "dryRun",
    "envName",
    "maxWorkers",
    "merchantConcurrencyPerWorker",
    "merchantPageLimits",
    "merchantTargetFactor",
    "orderConcurrencyPerWorker",
    "orderTargetFactor",
    "reportLabelPrefix",
    "stageDurations",
    "stageRatios",
    "stopOnFailure",
    "targets",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || "");
    if (!current.startsWith("--")) {
      passthrough.push(current);
      continue;
    }

    const stripped = current.slice(2);
    const separatorIndex = stripped.indexOf("=");
    const key = separatorIndex >= 0 ? stripped.slice(0, separatorIndex).trim() : stripped.trim();

    if (handledKeys.has(key)) {
      if (separatorIndex < 0) {
        const next = String(argv[index + 1] || "");
        if (next && !next.startsWith("--")) {
          index += 1;
        }
      }
      continue;
    }

    passthrough.push(current);
    if (separatorIndex < 0) {
      const next = String(argv[index + 1] || "");
      if (next && !next.startsWith("--")) {
        passthrough.push(next);
        index += 1;
      }
    }
  }

  return passthrough;
}

function runLoadTestProcess({ env, passthroughArgs }) {
  const scriptPath = path.resolve("scripts", "load-test-staging-http.mjs");

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...passthroughArgs], {
      stdio: "inherit",
      env,
    });

    child.once("exit", (code) => {
      resolve(Number(code || 0));
    });

    child.once("error", () => {
      resolve(1);
    });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const envName = readConfigValue(args, "envName", "LOADTEST_ENV", "staging") || "staging";

  loadLocalEnv(envName);

  const targets = parsePositiveIntList(
    readConfigValue(args, "targets", "LOADTEST_TARGETS", "1000,5000,10000"),
    [1000, 5000, 10000],
  );
  if (!targets.length) {
    throw new Error("Define pelo menos um alvo positivo em --targets ou LOADTEST_TARGETS.");
  }

  const merchantPageLimits = parsePositiveIntList(
    readConfigValue(args, "merchantPageLimits", "LOADTEST_MERCHANT_PAGE_LIMITS", "50"),
    [50],
  );
  const reportLabelPrefix = readConfigValue(
    args,
    "reportLabelPrefix",
    "LOADTEST_REPORT_LABEL",
    "staging-load-test",
  );
  const stopOnFailure = parseBoolean(
    readConfigValue(args, "stopOnFailure", "LOADTEST_STOP_ON_FAILURE", "true"),
    true,
  );
  const dryRun = parseBoolean(
    readConfigValue(args, "dryRun", "LOADTEST_DRY_RUN", "false"),
    false,
  );
  const maxWorkers = parsePositiveInt(readConfigValue(args, "maxWorkers", "LOADTEST_MAX_WORKERS", "24"), 24);
  const stageRatios = normalizeRatioList(
    parsePositiveNumberList(readConfigValue(args, "stageRatios", "LOADTEST_STAGE_RATIOS", "0.1,0.25,0.5,1")),
  );
  const stageDurations = normalizeDurationList(
    parsePositiveIntList(readConfigValue(args, "stageDurations", "LOADTEST_STAGE_DURATIONS", "15,20,20,30")),
    stageRatios,
  );

  const catalogTargetFactor = Number(
    readConfigValue(args, "catalogTargetFactor", "LOADTEST_CATALOG_TARGET_FACTOR", "1"),
  ) || 1;
  const orderTargetFactor = Number(
    readConfigValue(args, "orderTargetFactor", "LOADTEST_ORDER_TARGET_FACTOR", "1"),
  ) || 1;
  const merchantTargetFactor = Number(
    readConfigValue(args, "merchantTargetFactor", "LOADTEST_MERCHANT_TARGET_FACTOR", "0.1"),
  ) || 0.1;

  const catalogConcurrencyPerWorker = parsePositiveInt(
    readConfigValue(args, "catalogConcurrencyPerWorker", "LOADTEST_CATALOG_TARGET_CONCURRENCY_PER_WORKER", "125"),
    125,
  );
  const orderConcurrencyPerWorker = parsePositiveInt(
    readConfigValue(args, "orderConcurrencyPerWorker", "LOADTEST_ORDER_TARGET_CONCURRENCY_PER_WORKER", "100"),
    100,
  );
  const merchantConcurrencyPerWorker = parsePositiveInt(
    readConfigValue(args, "merchantConcurrencyPerWorker", "LOADTEST_MERCHANT_TARGET_CONCURRENCY_PER_WORKER", "75"),
    75,
  );

  const passthroughArgs = stripHandledArgs(argv);
  const runs = [];

  for (const target of targets) {
    const defaults = buildTargetDefaults(target);
    const catalogStages = buildStageSpecs(target, {
      factor: catalogTargetFactor,
      ratios: stageRatios,
      durations: stageDurations,
      maxWorkers,
      targetConcurrencyPerWorker: catalogConcurrencyPerWorker,
    });
    const orderStages = buildStageSpecs(target, {
      factor: orderTargetFactor,
      ratios: stageRatios,
      durations: stageDurations,
      maxWorkers,
      targetConcurrencyPerWorker: orderConcurrencyPerWorker,
    });
    const merchantStages = buildStageSpecs(target, {
      factor: merchantTargetFactor,
      ratios: stageRatios,
      durations: stageDurations,
      maxWorkers,
      targetConcurrencyPerWorker: merchantConcurrencyPerWorker,
    });
    const privateSessionPoolSize = buildSessionPoolSize(merchantStages, 4);

    for (const merchantPageLimit of merchantPageLimits) {
      runs.push({
        target,
        merchantPageLimit,
        reportLabel: `${reportLabelPrefix}-target-${target}-mpl-${merchantPageLimit}`,
        env: {
          LOADTEST_TARGET_CONCURRENCY: String(target),
          LOADTEST_MERCHANT_PAGE_LIMIT: String(merchantPageLimit),
          LOADTEST_CATALOG_STAGES: formatStageSpecs(catalogStages),
          LOADTEST_ORDER_STAGES: formatStageSpecs(orderStages),
          LOADTEST_MERCHANT_STAGES: formatStageSpecs(merchantStages),
          LOADTEST_SEED_PRODUCT_COUNT: String(defaults.seedProductCount),
          LOADTEST_PREFILL_ORDERS: String(defaults.prefillOrders),
          LOADTEST_PREFILL_CONCURRENCY: String(defaults.prefillConcurrency),
          LOADTEST_PRIVATE_SESSION_POOL_SIZE: String(privateSessionPoolSize),
        },
        catalogStages,
        orderStages,
        merchantStages,
      });
    }
  }

  console.log("Perfis de load test em staging");
  console.log(`Env mode: ${envName}`);
  console.log(`Targets: ${targets.join(", ")}`);
  console.log(`Merchant page limits: ${merchantPageLimits.join(", ")}`);
  console.log(`Ratios: ${stageRatios.join(", ")}`);
  console.log(`Duracoes: ${stageDurations.join(", ")}`);
  console.log(`Max workers: ${maxWorkers}`);
  console.log(`Target factors | catalog=${catalogTargetFactor} order=${orderTargetFactor} merchant=${merchantTargetFactor}`);

  for (const run of runs) {
    console.log("");
    console.log(`=== target=${run.target} | merchantPageLimit=${run.merchantPageLimit} | reportLabel=${run.reportLabel} ===`);
    console.log(`Catalog stages: ${run.env.LOADTEST_CATALOG_STAGES}`);
    console.log(`Order stages: ${run.env.LOADTEST_ORDER_STAGES}`);
    console.log(`Merchant stages: ${run.env.LOADTEST_MERCHANT_STAGES}`);
    console.log(`Seed products: ${run.env.LOADTEST_SEED_PRODUCT_COUNT} | Prefill orders: ${run.env.LOADTEST_PREFILL_ORDERS} | Session pool: ${run.env.LOADTEST_PRIVATE_SESSION_POOL_SIZE}`);
  }

  if (dryRun) {
    return;
  }

  const results = [];

  for (const run of runs) {
    console.log("");
    console.log(`>>> Executar target=${run.target} | merchantPageLimit=${run.merchantPageLimit}`);

    const exitCode = await runLoadTestProcess({
      env: {
        ...process.env,
        LOADTEST_ENV: envName,
        LOADTEST_REPORT_LABEL: run.reportLabel,
        ...run.env,
      },
      passthroughArgs,
    });

    results.push({
      target: run.target,
      merchantPageLimit: run.merchantPageLimit,
      reportLabel: run.reportLabel,
      exitCode,
    });

    if (exitCode !== 0 && stopOnFailure) {
      break;
    }
  }

  console.log("");
  console.log("Resumo dos targets");
  for (const result of results) {
    console.log(
      `- target=${result.target} | merchantPageLimit=${result.merchantPageLimit} | reportLabel=${result.reportLabel} | status=${result.exitCode === 0 ? "OK" : "FALHOU"}`,
    );
  }

  if (results.some((result) => result.exitCode !== 0)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Falha ao preparar os perfis de load test em staging.");
  console.error(error.message || error);
  process.exitCode = 1;
});
