import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { detectJavaHome } from "./android-gradle.mjs";

export function resolveExecutable(command, platform = process.platform) {
  if (platform !== "win32") return command;
  if (!command) return command;

  const lowerCommand = String(command).toLowerCase();
  if (
    lowerCommand.endsWith(".cmd")
    || lowerCommand.endsWith(".bat")
    || lowerCommand.endsWith(".exe")
    || path.isAbsolute(command)
    || command.includes("\\")
    || command.includes("/")
  ) {
    return command;
  }

  return `${command}.cmd`;
}

export function shouldUseWindowsShell(command, platform = process.platform) {
  if (platform !== "win32") return false;
  return /\.(cmd|bat)$/i.test(String(command || "").trim());
}

function parsePropertiesFile(content) {
  const values = {};

  for (const line of String(content || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

function readReleaseProperties(cwd = process.cwd(), existsSync = fs.existsSync, readFileSync = fs.readFileSync) {
  const propertiesPath = path.join(cwd, "android", "keystore.properties");
  if (!existsSync(propertiesPath)) {
    return {};
  }

  try {
    return parsePropertiesFile(readFileSync(propertiesPath, "utf8"));
  } catch (error) {
    return {};
  }
}

function resolveStoreFilePath(storeFile, cwd = process.cwd()) {
  const normalized = String(storeFile || "").trim();
  if (!normalized) return "";
  if (path.isAbsolute(normalized)) return normalized;
  return path.resolve(cwd, "android", normalized);
}

export function getJavaAvailability(options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const runSync = options.spawnSync || spawnSync;
  const detectedJavaHome = detectJavaHome({
    ...options,
    env,
    platform,
  });

  if (detectedJavaHome) {
    return {
      available: true,
      source: "java-home",
      javaHome: detectedJavaHome,
    };
  }

  const locator = platform === "win32" ? "where.exe" : "which";
  const lookup = runSync(locator, ["java"], {
    env,
    shell: false,
    stdio: "ignore",
  });

  return {
    available: lookup.status === 0,
    source: lookup.status === 0 ? "path" : "",
    javaHome: "",
  };
}

export function getReleaseSigningStatus(options = {}) {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const existsSync = options.existsSync || fs.existsSync;
  const readFileSync = options.readFileSync || fs.readFileSync;
  const releaseProperties = readReleaseProperties(cwd, existsSync, readFileSync);
  const readValue = (key) => String(env[key] || releaseProperties[key] || "").trim();
  const storeFile = readValue("KASTROZAPP_UPLOAD_STORE_FILE");
  const resolvedStoreFile = resolveStoreFilePath(storeFile, cwd);
  const missing = [];

  if (!storeFile) {
    missing.push("KASTROZAPP_UPLOAD_STORE_FILE");
  } else if (!existsSync(resolvedStoreFile)) {
    missing.push(`ficheiro da keystore nao encontrado (${resolvedStoreFile})`);
  }

  if (!readValue("KASTROZAPP_UPLOAD_STORE_PASSWORD")) {
    missing.push("KASTROZAPP_UPLOAD_STORE_PASSWORD");
  }

  if (!readValue("KASTROZAPP_UPLOAD_KEY_ALIAS")) {
    missing.push("KASTROZAPP_UPLOAD_KEY_ALIAS");
  }

  if (!readValue("KASTROZAPP_UPLOAD_KEY_PASSWORD")) {
    missing.push("KASTROZAPP_UPLOAD_KEY_PASSWORD");
  }

  if (!readValue("ANDROID_VERSION_CODE")) {
    missing.push("ANDROID_VERSION_CODE");
  }

  if (!readValue("ANDROID_VERSION_NAME")) {
    missing.push("ANDROID_VERSION_NAME");
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

export function getReleasePreflightIssues(options = {}) {
  const javaStatus = getJavaAvailability(options);
  const signingStatus = getReleaseSigningStatus(options);
  const issues = [];

  if (!javaStatus.available) {
    issues.push("Java/JDK nao encontrado. Configura JAVA_HOME ou instala um JDK compativel com o Android Gradle Plugin.");
  }

  if (!signingStatus.ready) {
    issues.push(
      `assinatura de release incompleta: ${signingStatus.missing.join(", ")}. Preenche android/keystore.properties ou exporta estas variaveis antes do bundle.`,
    );
  }

  return issues;
}

export function runStep(command, args, label, options = {}) {
  const platform = options.platform || process.platform;
  const resolvedCommand = resolveExecutable(command, platform);

  return new Promise((resolve, reject) => {
    const child = spawn(resolvedCommand, args, {
      stdio: "inherit",
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      shell: shouldUseWindowsShell(resolvedCommand, platform),
    });

    child.on("error", (error) => {
      reject(new Error(`${label} falhou ao arrancar: ${error.message}`));
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${label} terminou com sinal ${signal}.`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${label} terminou com codigo ${code}.`));
        return;
      }

      resolve();
    });
  });
}

export async function main() {
  const action = String(process.argv[2] || "").trim();
  const npmCmd = "npm";
  const npxCmd = "npx";
  const nodeCmd = process.execPath;

  if (!action) {
    console.error("Uso: node scripts/capacitor-android.mjs <sync|copy|bundleRelease|assembleRelease>");
    process.exit(1);
  }

  if (action === "bundleRelease" || action === "assembleRelease") {
    const preflightIssues = getReleasePreflightIssues();
    if (preflightIssues.length > 0) {
      throw new Error(`Pre-flight de release falhou:\n- ${preflightIssues.join("\n- ")}`);
    }
  }

  await runStep(npmCmd, ["run", "build"], "Build web");

  if (action === "sync") {
    await runStep(npxCmd, ["cap", "sync", "android"], "Capacitor sync");
    return;
  }

  if (action === "copy") {
    await runStep(npxCmd, ["cap", "copy", "android"], "Capacitor copy");
    return;
  }

  if (action === "bundleRelease" || action === "assembleRelease") {
    await runStep(npxCmd, ["cap", "sync", "android"], "Capacitor sync");
    await runStep(nodeCmd, ["scripts/android-gradle.mjs", action], `Gradle ${action}`);
    return;
  }

  console.error(`Acao desconhecida: ${action}`);
  process.exit(1);
}

const modulePath = fileURLToPath(import.meta.url);
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (modulePath === entryPath) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
