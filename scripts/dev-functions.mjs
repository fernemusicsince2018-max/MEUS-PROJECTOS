import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadLocalEnv } from "./loadEnv.mjs";
import { resolveFunctionNameFromPath, runFunctionByName } from "./functions-runtime.mjs";

function writeResponse(response, result) {
  response.statusCode = result?.statusCode || 200;

  for (const [key, value] of Object.entries(result?.headers || {})) {
    response.setHeader(key, value);
  }

  response.end(result?.body || "");
}

export function startDevFunctionsServer(port, options = {}) {
  loadLocalEnv(options.mode, options.cwd, options.loadEnvOptions);
  const resolvedPort = Number(port || process.env.LOCAL_FUNCTIONS_PORT || 8888);
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);

    if (url.pathname === "/health") {
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    const functionName = resolveFunctionNameFromPath(url.pathname);
    if (!functionName) {
      response.statusCode = 404;
      response.end("Not Found");
      return;
    }

    const bodyChunks = [];

    request.on("data", (chunk) => bodyChunks.push(chunk));
    request.on("end", async () => {
      try {
        const result = await runFunctionByName(functionName, request, bodyChunks, {
          fresh: true,
        });
        writeResponse(response, result);
      } catch (error) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: error.message || "Erro interno." }));
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(resolvedPort, () => {
      console.log(`API local em http://127.0.0.1:${resolvedPort}`);
      resolve(server);
    });
  });
}

const directRunPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";

if (directRunPath === import.meta.url) {
  startDevFunctionsServer().catch((error) => {
    console.error("Falha ao arrancar a API local.");
    console.error(error.message || error);
    process.exit(1);
  });
}
