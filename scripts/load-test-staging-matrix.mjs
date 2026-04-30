import { spawn } from "node:child_process";
import path from "node:path";
import { loadLocalEnv } from "./loadEnv.mjs";

function parseArgs(argv = []) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || "");
    if (!current.startsWith("--")) {
      continue;
    }

    const stripped = current.slice(2);
    const separatorIndex = stripped.indexOf("=");

    if (separatorIndex >= 0) {
      const key = stripped.slice(0, separatorIndex).trim();
      const value = stripped.slice(separatorIndex + 1);
      args[key] = value;
      continue;
    }

    const next = String(argv[index + 1] || "");
    if (next && !next.startsWith("--")) {
      args[stripped.trim()] = next;
      index += 1;
      continue;
    }

    args[stripped.trim()] = "true";
  }

  return args;
}

function readConfigValue(args, key, envKey, fallback = "") {
  const rawValue =
    args?.[key]
    ?? (envKey ? process.env[envKey] : undefined)
    ?? fallback;
  return String(rawValue ?? "").trim();
}

function parseBoolean(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on", "sim"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "nao"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveIntList(value, fallback = []) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return [...fallback];
  }

  return normalized
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}

function stripHandledArgs(argv = []) {
  const passthrough = [];
  const handledKeys = new Set([
    "envName",
    "merchantPageLimit",
    "merchantPageLimits",
    "reportLabel",
    "reportLabelPrefix",
    "stopOnFailure",
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

  const merchantPageLimits = parsePositiveIntList(
    readConfigValue(args, "merchantPageLimits", "LOADTEST_MERCHANT_PAGE_LIMITS", "20,50,100"),
    [20, 50, 100],
  );
  if (!merchantPageLimits.length) {
    throw new Error("Define pelo menos um merchantPageLimit positivo em --merchantPageLimits ou LOADTEST_MERCHANT_PAGE_LIMITS.");
  }
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
  const passthroughArgs = stripHandledArgs(argv);
  const results = [];

  console.log("Matriz de load test em staging");
  console.log(`Env mode: ${envName}`);
  console.log(`Merchant page limits: ${merchantPageLimits.join(", ")}`);

  for (const merchantPageLimit of merchantPageLimits) {
    const reportLabel = `${reportLabelPrefix}-mpl-${merchantPageLimit}`;
    console.log("");
    console.log(`=== merchantPageLimit=${merchantPageLimit} | reportLabel=${reportLabel} ===`);

    const exitCode = await runLoadTestProcess({
      env: {
        ...process.env,
        LOADTEST_ENV: envName,
        LOADTEST_MERCHANT_PAGE_LIMIT: String(merchantPageLimit),
        LOADTEST_REPORT_LABEL: reportLabel,
      },
      passthroughArgs,
    });

    results.push({
      merchantPageLimit,
      reportLabel,
      exitCode,
    });

    if (exitCode !== 0 && stopOnFailure) {
      break;
    }
  }

  console.log("");
  console.log("Resumo da matriz");
  for (const result of results) {
    console.log(
      `- merchantPageLimit=${result.merchantPageLimit} | reportLabel=${result.reportLabel} | status=${result.exitCode === 0 ? "OK" : "FALHOU"}`,
    );
  }

  if (results.some((result) => result.exitCode !== 0)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Falha ao correr a matriz de load test em staging.");
  console.error(error.message || error);
  process.exitCode = 1;
});
