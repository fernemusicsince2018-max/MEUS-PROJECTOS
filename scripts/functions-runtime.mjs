import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const API_PREFIX = "/api/";
export const LEGACY_FUNCTIONS_PREFIX = "/.netlify/functions/";
export const SUPPORTED_FUNCTION_PREFIXES = [API_PREFIX, LEGACY_FUNCTIONS_PREFIX];

function getJsonBody(bodyChunks) {
  if (!bodyChunks?.length) return "";
  return Buffer.concat(bodyChunks).toString("utf8");
}

async function runRequestStyleFunction(mod, request, rawBody) {
  const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
  const method = request.method || "GET";
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers || {})) {
    if (value == null) continue;
    headers.set(key, String(value));
  }

  const req = new Request(url.toString(), {
    method,
    headers,
    body: ["GET", "HEAD"].includes(method.toUpperCase()) ? undefined : rawBody || undefined,
  });

  const result = await mod.default(req, {});

  if (result instanceof Response) {
    return {
      statusCode: result.status,
      headers: Object.fromEntries(result.headers.entries()),
      body: await result.text(),
    };
  }

  return {
    statusCode: 204,
    headers: {},
    body: "",
  };
}

function buildEventFromRequest(request, rawBody) {
  const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
  return {
    httpMethod: request.method || "GET",
    headers: Object.fromEntries(
      Object.entries(request.headers || {}).map(([key, value]) => [key, String(value ?? "")]),
    ),
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    path: url.pathname,
    rawUrl: url.toString(),
    body: rawBody || null,
    isBase64Encoded: false,
  };
}

function createFreshFunctionsWorkspace() {
  const sourceDir = path.resolve("netlify/functions");
  const tempRoot = path.resolve(".netlify/functions-cache");
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(tempRoot, "run-"));
  fs.cpSync(sourceDir, tempDir, { recursive: true });
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ type: "module" }));
  return tempDir;
}

export function resolveFunctionNameFromPath(pathname = "") {
  const normalizedPath = String(pathname || "").trim();

  for (const prefix of SUPPORTED_FUNCTION_PREFIXES) {
    if (!normalizedPath.startsWith(prefix)) continue;
    const functionName = normalizedPath.slice(prefix.length).split("/")[0].trim();
    return functionName || "";
  }

  return "";
}

export async function runFunctionByName(functionName, request, bodyChunks, options = {}) {
  const normalizedFunctionName = String(functionName || "").trim();
  if (!normalizedFunctionName) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Funcao nao encontrada." }),
    };
  }

  let tempDir = "";

  if (options.fresh) {
    tempDir = createFreshFunctionsWorkspace();
  }

  try {
    const sourceFunctionPath = options.fresh
      ? path.join(tempDir, `${normalizedFunctionName}.js`)
      : path.resolve("netlify/functions", `${normalizedFunctionName}.js`);

    if (!fs.existsSync(sourceFunctionPath)) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Funcao nao encontrada." }),
      };
    }

    const moduleUrl = options.fresh
      ? `${pathToFileURL(sourceFunctionPath).href}?t=${Date.now()}`
      : pathToFileURL(sourceFunctionPath).href;
    const mod = await import(moduleUrl);
    const rawBody = getJsonBody(bodyChunks) || null;

    if (typeof mod.default === "function") {
      return runRequestStyleFunction(mod, request, rawBody);
    }

    if (typeof mod.handler !== "function") {
      throw new Error(`A funcao ${normalizedFunctionName} nao exporta handler nem default.`);
    }

    return mod.handler(buildEventFromRequest(request, rawBody));
  } finally {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
