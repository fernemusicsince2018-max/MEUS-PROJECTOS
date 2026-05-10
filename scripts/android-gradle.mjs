import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const androidDir = path.resolve("android");
const gradleArgs = process.argv.slice(2);

function normalizePathValue(value) {
  return String(value || "").trim();
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function getJavaBinaryName(platform = process.platform) {
  return platform === "win32" ? "java.exe" : "java";
}

function isUsableJavaHome(javaHome, existsSync = fs.existsSync, platform = process.platform) {
  const normalized = normalizePathValue(javaHome);
  if (!normalized) return false;

  return existsSync(path.join(normalized, "bin", getJavaBinaryName(platform)));
}

function listSubdirectories(dirPath, readdirSync = fs.readdirSync) {
  const normalized = normalizePathValue(dirPath);
  if (!normalized) return [];

  try {
    return readdirSync(normalized, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(normalized, entry.name));
  } catch (error) {
    return [];
  }
}

export function detectJavaHome(options = {}) {
  const env = options.env || process.env;
  const existsSync = options.existsSync || fs.existsSync;
  const readdirSync = options.readdirSync || fs.readdirSync;
  const platform = options.platform || process.platform;
  const javaHomeKeys = ["JAVA_HOME", "JDK_HOME", "ANDROID_STUDIO_JDK"];

  for (const key of javaHomeKeys) {
    const value = normalizePathValue(env[key]);
    if (isUsableJavaHome(value, existsSync, platform)) {
      return value;
    }
  }

  const localAppData = normalizePathValue(env.LOCALAPPDATA);
  const programFiles = normalizePathValue(env.ProgramFiles);
  const programFilesX86 = normalizePathValue(env["ProgramFiles(x86)"]);

  const fixedCandidates = uniqueValues([
    localAppData && path.join(localAppData, "Programs", "Android Studio", "jbr"),
    localAppData && path.join(localAppData, "Programs", "Android Studio", "jre"),
    programFiles && path.join(programFiles, "Android", "Android Studio", "jbr"),
    programFiles && path.join(programFiles, "Android", "Android Studio", "jre"),
    programFiles && path.join(programFiles, "Android", "openjdk"),
    programFilesX86 && path.join(programFilesX86, "Android", "Android Studio", "jbr"),
    programFilesX86 && path.join(programFilesX86, "Android", "Android Studio", "jre"),
    programFilesX86 && path.join(programFilesX86, "Android", "openjdk"),
  ]);

  for (const candidate of fixedCandidates) {
    if (isUsableJavaHome(candidate, existsSync, platform)) {
      return candidate;
    }

    const nestedMatches = listSubdirectories(candidate, readdirSync);
    for (const nestedCandidate of nestedMatches) {
      if (isUsableJavaHome(nestedCandidate, existsSync, platform)) {
        return nestedCandidate;
      }
    }
  }

  const scannedRoots = uniqueValues([
    programFiles && path.join(programFiles, "Java"),
    programFiles && path.join(programFiles, "Microsoft"),
    programFilesX86 && path.join(programFilesX86, "Java"),
    programFilesX86 && path.join(programFilesX86, "Microsoft"),
  ]);

  for (const root of scannedRoots) {
    const matches = listSubdirectories(root, readdirSync).filter((candidate) =>
      /(jdk|jre|temurin|zulu|corretto|graalvm)/i.test(path.basename(candidate)),
    );

    for (const candidate of matches) {
      if (isUsableJavaHome(candidate, existsSync, platform)) {
        return candidate;
      }
    }
  }

  return "";
}

export function buildGradleEnv(options = {}) {
  const env = { ...(options.env || process.env) };
  const platform = options.platform || process.platform;
  const pathKey = platform === "win32" ? "Path" : "PATH";
  const currentJavaHome = normalizePathValue(env.JAVA_HOME);
  const detectedJavaHome = isUsableJavaHome(currentJavaHome, options.existsSync || fs.existsSync, platform)
    ? currentJavaHome
    : detectJavaHome(options);

  if (!detectedJavaHome) {
    return {
      env,
      javaHome: "",
      autoDetected: false,
    };
  }

  const javaBin = path.join(detectedJavaHome, "bin");
  const currentPath = normalizePathValue(env[pathKey] || env.PATH || env.Path);
  const pathSegments = currentPath ? currentPath.split(path.delimiter) : [];

  env.JAVA_HOME = detectedJavaHome;
  env[pathKey] = uniqueValues([javaBin, ...pathSegments]).join(path.delimiter);

  return {
    env,
    javaHome: detectedJavaHome,
    autoDetected: detectedJavaHome !== currentJavaHome,
  };
}

export async function main() {
  if (!gradleArgs.length) {
    console.error("Uso: node scripts/android-gradle.mjs <gradle-task> [args...]");
    console.error("Exemplo: node scripts/android-gradle.mjs bundleRelease");
    process.exit(1);
  }

  const isWindows = process.platform === "win32";
  const command = isWindows ? "cmd.exe" : "./gradlew";
  const args = isWindows ? ["/c", "gradlew.bat", ...gradleArgs] : gradleArgs;
  const { env, javaHome, autoDetected } = buildGradleEnv();

  if (autoDetected && javaHome) {
    console.log(`A usar Java detectado automaticamente em: ${javaHome}`);
  }

  const child = spawn(command, args, {
    cwd: androidDir,
    stdio: "inherit",
    env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

const modulePath = fileURLToPath(import.meta.url);
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (modulePath === entryPath) {
  await main();
}
