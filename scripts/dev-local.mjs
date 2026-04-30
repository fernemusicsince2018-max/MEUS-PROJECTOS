import { spawn } from "node:child_process";
import path from "node:path";

function startProcess(command, args, label) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  child.on("error", (error) => {
    console.error(`${label} falhou ao iniciar.`);
    console.error(error.message || error);
  });

  return child;
}

function stopProcess(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
}

async function main() {
  const node = process.execPath;
  const uiPort = String(process.env.VITE_PORT || "").trim();
  const apiProcess = startProcess(node, [path.resolve("scripts/dev-functions.mjs")], "API local");
  const uiArgs = [path.resolve("node_modules/vite/bin/vite.js")];
  if (uiPort) {
    uiArgs.push("--port", uiPort);
  }
  const uiProcess = startProcess(node, uiArgs, "Frontend");

  const shutdown = () => {
    stopProcess(apiProcess);
    stopProcess(uiProcess);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  apiProcess.on("exit", (code) => {
    if (code && !uiProcess.killed) {
      stopProcess(uiProcess);
      process.exit(code);
    }
  });

  uiProcess.on("exit", (code) => {
    if (code && !apiProcess.killed) {
      stopProcess(apiProcess);
      process.exit(code);
    }
  });
}

main().catch((error) => {
  console.error("Falha ao arrancar o ambiente local.");
  console.error(error.message || error);
  process.exit(1);
});
