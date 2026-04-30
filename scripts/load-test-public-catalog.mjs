import { performance } from "node:perf_hooks";
import { isMainThread, parentPort, workerData, Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadLocalEnv } from "./loadEnv.mjs";

function parseArgs(argv = []) {
  return argv.reduce((accumulator, entry) => {
    if (!entry.startsWith("--")) return accumulator;
    const [rawKey, ...rawValue] = entry.slice(2).split("=");
    const key = rawKey.trim();
    const value = rawValue.length ? rawValue.join("=") : "true";
    accumulator[key] = value;
    return accumulator;
  }, {});
}

function parsePositiveInt(value, fallback) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return fallback;
  return numeric;
}

function parseStages(value) {
  const raw = String(value || "1x10x10,2x10x10,4x10x10,8x10x10")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return raw.map((entry, index) => {
    const parts = entry.split("x").map((segment) => Number(segment));
    if (parts.length !== 3 || parts.some((segment) => !Number.isInteger(segment) || segment < 1)) {
      throw new Error(`Stage invalida na posicao ${index + 1}: ${entry}. Usa o formato workers x concurrency x durationSeg.`);
    }

    const [workers, concurrencyPerWorker, durationSeconds] = parts;
    return {
      label: entry,
      workers,
      concurrencyPerWorker,
      durationSeconds,
      totalConcurrency: workers * concurrencyPerWorker,
    };
  });
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function summarizeLatencies(latencies = []) {
  if (!latencies.length) {
    return {
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
    };
  }

  const total = latencies.reduce((sum, value) => sum + value, 0);
  return {
    avgMs: total / latencies.length,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
    maxMs: Math.max(...latencies),
  };
}

function mergeStatusCounts(results = []) {
  return results.reduce((accumulator, result) => {
    for (const [status, count] of Object.entries(result.statusCounts || {})) {
      accumulator[status] = (accumulator[status] || 0) + Number(count || 0);
    }
    return accumulator;
  }, {});
}

function mergeLatencies(results = []) {
  return results.flatMap((result) => result.latencies || []);
}

function buildEvent(storeId) {
  return {
    httpMethod: "GET",
    headers: {
      host: "127.0.0.1",
    },
    queryStringParameters: {
      id: storeId,
    },
    path: "/api/catalog-get",
    rawUrl: `http://127.0.0.1/api/catalog-get?id=${encodeURIComponent(storeId)}`,
    body: null,
    isBase64Encoded: false,
  };
}

async function runWorkerLoadTest({ storeId, concurrency, durationSeconds }) {
  loadLocalEnv();

  const [{ handler }, postgresModule] = await Promise.all([
    import("../netlify/functions/catalog-get.js"),
    import("../netlify/functions/_postgres.js"),
  ]);
  const { ensureDatabaseReady, getPool } = postgresModule;

  await ensureDatabaseReady();

  const deadline = performance.now() + durationSeconds * 1000;
  const latencies = [];
  const statusCounts = {};
  let errorCount = 0;
  let bytes = 0;

  async function loop() {
    while (performance.now() < deadline) {
      const event = buildEvent(storeId);
      const startedAt = performance.now();

      try {
        const result = await handler(event);
        const elapsedMs = performance.now() - startedAt;
        latencies.push(elapsedMs);

        const statusCode = String(result?.statusCode || 200);
        statusCounts[statusCode] = (statusCounts[statusCode] || 0) + 1;
        bytes += Buffer.byteLength(String(result?.body || ""), "utf8");
      } catch (error) {
        const elapsedMs = performance.now() - startedAt;
        latencies.push(elapsedMs);
        errorCount += 1;
        statusCounts.error = (statusCounts.error || 0) + 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => loop()));
  await getPool().end().catch(() => {});

  return {
    latencies,
    statusCounts,
    errorCount,
    bytes,
    requestCount: latencies.length,
  };
}

async function fetchStoreSnapshot(storeId) {
  loadLocalEnv();
  const { getPool } = await import("../netlify/functions/_postgres.js");
  const pool = getPool();

  try {
    const result = await pool.query(
      `select
         id,
         name,
         public_enabled,
         deleted_at,
         (select count(*)::int from catalog_products where catalog_id = stores.id) as product_count
       from catalog_stores stores
       where id = $1
       limit 1`,
      [storeId],
    );
    return result.rows[0] || null;
  } finally {
    await pool.end().catch(() => {});
  }
}

async function runStage(stage, storeId) {
  const stageStart = performance.now();
  const workers = Array.from({ length: stage.workers }, () =>
    new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: {
          storeId,
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

  const results = await Promise.all(workers);
  const elapsedSeconds = (performance.now() - stageStart) / 1000;
  const latencies = mergeLatencies(results);
  const requestCount = results.reduce((sum, result) => sum + Number(result.requestCount || 0), 0);
  const errorCount = results.reduce((sum, result) => sum + Number(result.errorCount || 0), 0);
  const bytes = results.reduce((sum, result) => sum + Number(result.bytes || 0), 0);
  const statusCounts = mergeStatusCounts(results);
  const latencySummary = summarizeLatencies(latencies);

  return {
    ...stage,
    elapsedSeconds,
    requestCount,
    errorCount,
    bytes,
    statusCounts,
    latencySummary,
    requestsPerSecond: elapsedSeconds > 0 ? requestCount / elapsedSeconds : 0,
    megabytesPerSecond: elapsedSeconds > 0 ? bytes / elapsedSeconds / 1024 / 1024 : 0,
  };
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function printStageSummary(result) {
  const okCount = Object.entries(result.statusCounts)
    .filter(([status]) => /^\d+$/.test(status) && status.startsWith("2"))
    .reduce((sum, [, count]) => sum + Number(count || 0), 0);
  const successRate = result.requestCount ? (okCount / result.requestCount) * 100 : 0;
  const errorRate = result.requestCount ? (result.errorCount / result.requestCount) * 100 : 0;

  console.log("");
  console.log(`Stage ${result.label}`);
  console.log(
    `Workers: ${result.workers} | Conc/worker: ${result.concurrencyPerWorker} | Conc total: ${result.totalConcurrency} | Duracao alvo: ${result.durationSeconds}s`,
  );
  console.log(
    `Requests: ${result.requestCount} | RPS: ${formatNumber(result.requestsPerSecond)} | Sucesso 2xx: ${formatNumber(successRate)}% | Erros: ${result.errorCount} (${formatNumber(errorRate)}%)`,
  );
  console.log(
    `Latencia ms | avg: ${formatNumber(result.latencySummary.avgMs)} | p50: ${formatNumber(result.latencySummary.p50Ms)} | p95: ${formatNumber(result.latencySummary.p95Ms)} | p99: ${formatNumber(result.latencySummary.p99Ms)} | max: ${formatNumber(result.latencySummary.maxMs)}`,
  );
  console.log(
    `Throughput resposta: ${formatNumber(result.megabytesPerSecond, 3)} MB/s | Status: ${JSON.stringify(result.statusCounts)}`,
  );
}

async function runMainThread() {
  const args = parseArgs(process.argv.slice(2));
  const storeId = String(args.storeId || "").trim();

  if (!storeId) {
    throw new Error("Informa --storeId=<uuid-da-loja-publica>.");
  }

  const stages = parseStages(args.stages);
  const storeSnapshot = await fetchStoreSnapshot(storeId);

  if (!storeSnapshot) {
    throw new Error(`Loja nao encontrada para o id ${storeId}.`);
  }

  console.log("Teste de carga do catalogo publico");
  console.log(`Loja: ${storeSnapshot.name} (${storeSnapshot.id})`);
  console.log(`Publica: ${storeSnapshot.public_enabled} | Removida: ${storeSnapshot.deleted_at ? "sim" : "nao"} | Produtos: ${storeSnapshot.product_count}`);
  console.log(`Stages: ${stages.map((stage) => stage.label).join(", ")}`);

  for (const stage of stages) {
    const result = await runStage(stage, storeId);
    printStageSummary(result);
  }
}

if (isMainThread) {
  runMainThread().catch((error) => {
    console.error("Falha no teste de carga.");
    console.error(error.message || error);
    process.exitCode = 1;
  });
} else {
  runWorkerLoadTest(workerData)
    .then((result) => {
      parentPort.postMessage(result);
    })
    .catch((error) => {
      parentPort.postMessage({
        latencies: [],
        statusCounts: { error: 1 },
        errorCount: 1,
        bytes: 0,
        requestCount: 0,
        workerError: error.message || String(error),
      });
    });
}
