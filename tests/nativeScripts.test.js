import assert from "node:assert/strict";
import path from "node:path";
import {
  getJavaAvailability,
  getReleasePreflightIssues,
  getReleaseSigningStatus,
  resolveExecutable,
  shouldUseWindowsShell,
} from "../scripts/capacitor-android.mjs";
import { buildGradleEnv, detectJavaHome } from "../scripts/android-gradle.mjs";

function createExistsSync(existingPaths) {
  const normalized = new Set(existingPaths.map((value) => path.normalize(value)));
  return (targetPath) => normalized.has(path.normalize(targetPath));
}

export function runNativeScriptsTests() {
  assert.equal(resolveExecutable("npm", "win32"), "npm.cmd");
  assert.equal(resolveExecutable("npx", "win32"), "npx.cmd");
  assert.equal(resolveExecutable("npm", "linux"), "npm");
  assert.equal(shouldUseWindowsShell("npm.cmd", "win32"), true);
  assert.equal(shouldUseWindowsShell("C:\\Program Files\\nodejs\\node.exe", "win32"), false);
  assert.equal(
    resolveExecutable("C:\\Program Files\\nodejs\\node.exe", "win32"),
    "C:\\Program Files\\nodejs\\node.exe",
  );

  const localAppData = "C:\\Users\\demo\\AppData\\Local";
  const detectedJavaHome = path.join(localAppData, "Programs", "Android Studio", "jbr");
  const existsSync = createExistsSync([
    path.join(detectedJavaHome, "bin", "java.exe"),
  ]);

  assert.equal(
    detectJavaHome({
      platform: "win32",
      env: {
        LOCALAPPDATA: localAppData,
      },
      existsSync,
    }),
    detectedJavaHome,
  );

  const programFiles = "C:\\Program Files";
  const androidOpenJdk = path.join(programFiles, "Android", "openjdk", "jdk-21.0.8");
  assert.equal(
    detectJavaHome({
      platform: "win32",
      env: {
        ProgramFiles: programFiles,
      },
      existsSync: createExistsSync([
        path.join(androidOpenJdk, "bin", "java.exe"),
      ]),
      readdirSync(targetPath) {
        if (path.normalize(targetPath) === path.normalize(path.join(programFiles, "Android", "openjdk"))) {
          return [
            {
              name: "jdk-21.0.8",
              isDirectory() {
                return true;
              },
            },
          ];
        }

        throw new Error(`Unexpected path: ${targetPath}`);
      },
    }),
    androidOpenJdk,
  );

  const presetJavaHome = "D:\\Java\\jdk-21";
  const gradleEnv = buildGradleEnv({
    platform: "win32",
    env: {
      JAVA_HOME: presetJavaHome,
      Path: "C:\\Windows\\System32",
    },
    existsSync: createExistsSync([
      path.join(presetJavaHome, "bin", "java.exe"),
    ]),
  });

  assert.equal(gradleEnv.javaHome, presetJavaHome);
  assert.equal(gradleEnv.autoDetected, false);
  assert.match(String(gradleEnv.env.Path || ""), /D:\\Java\\jdk-21\\bin/i);

  const projectRoot = "C:\\repo\\KASTROZAP";
  const signingFile = path.join(projectRoot, "android", "app", "kastrozapp-upload.jks");
  const signingStatus = getReleaseSigningStatus({
    cwd: projectRoot,
    env: {
      KASTROZAPP_UPLOAD_STORE_FILE: "app/kastrozapp-upload.jks",
      KASTROZAPP_UPLOAD_STORE_PASSWORD: "secret",
      KASTROZAPP_UPLOAD_KEY_ALIAS: "kastrozapp-upload",
      KASTROZAPP_UPLOAD_KEY_PASSWORD: "secret",
      ANDROID_VERSION_CODE: "7",
      ANDROID_VERSION_NAME: "1.0.7",
    },
    existsSync: createExistsSync([signingFile]),
    readFileSync() {
      return "";
    },
  });

  assert.equal(signingStatus.ready, true);
  assert.deepEqual(signingStatus.missing, []);

  const javaAvailability = getJavaAvailability({
    platform: "win32",
    env: {},
    existsSync: createExistsSync([]),
    spawnSync() {
      return {
        status: 0,
      };
    },
  });

  assert.equal(javaAvailability.available, true);
  assert.equal(javaAvailability.source, "path");

  const preflightIssues = getReleasePreflightIssues({
    cwd: projectRoot,
    platform: "win32",
    env: {},
    existsSync: createExistsSync([]),
    readFileSync() {
      return "";
    },
    spawnSync() {
      return {
        status: 1,
      };
    },
  });

  assert.equal(preflightIssues.length, 2);
  assert.match(preflightIssues[0], /Java\/JDK nao encontrado/i);
  assert.match(preflightIssues[1], /assinatura de release incompleta/i);
}
