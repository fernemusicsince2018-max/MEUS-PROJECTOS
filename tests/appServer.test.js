import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createAppServer, shouldServeSpaShell } from "../shared/appServer.js";

function createTempDist() {
  const tempRoot = path.resolve("test-results");
  fs.mkdirSync(tempRoot, { recursive: true });

  const workspace = fs.mkdtempSync(path.join(tempRoot, "app-server-"));
  const distDir = path.join(workspace, "dist");
  fs.mkdirSync(path.join(distDir, "assets"), { recursive: true });

  fs.writeFileSync(
    path.join(distDir, "index.html"),
    "<!doctype html><html><body><div id=\"root\">shell</div></body></html>",
  );
  fs.writeFileSync(path.join(distDir, "assets", "app-abc123.js"), "console.log('asset');");
  fs.writeFileSync(path.join(distDir, "favicon.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");

  return {
    workspace,
    distDir,
  };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function requestWithHost(port, pathname, hostHeader) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method: "GET",
        headers: {
          Host: hostHeader,
        },
      },
      (response) => {
        const bodyChunks = [];
        response.on("data", (chunk) => bodyChunks.push(chunk));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(bodyChunks).toString("utf8"),
          });
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

export async function runAppServerTests() {
  assert.equal(shouldServeSpaShell("/"), true);
  assert.equal(shouldServeSpaShell("/app"), true);
  assert.equal(shouldServeSpaShell("/catalog/loja-demo"), true);
  assert.equal(shouldServeSpaShell("/api/catalog-get"), false);
  assert.equal(shouldServeSpaShell("/favicon.svg"), false);

  const { workspace, distDir } = createTempDist();
  const server = createAppServer({
    distDir,
    resolveFunctionName: () => "",
    runFunction: async (functionName) => {
      if (functionName === "catalog-get") {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store: {
              id: "store-demo",
              name: "Loja Demo",
              description: "Produtos frescos da loja demo.",
              color: "#118866",
              logo: "/favicon.svg",
            },
            products: [{ id: "prod-1", image: "/favicon.svg" }],
          }),
        };
      }

      if (functionName === "order-track") {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order: {
              trackingToken: "trk-1",
              trackingCode: "PED-123",
              store: {
                name: "Loja Demo",
                color: "#118866",
                logo: "/favicon.svg",
              },
            },
          }),
        };
      }

      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Nao devia correr." }),
      };
    },
    lookupStorefrontByHost: async (hostname) =>
      hostname === "demo.minhaloja.com" ? { id: "store-demo" } : null,
  });

  try {
    await listen(server);
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), { ok: true });

    const spaResponse = await fetch(`${baseUrl}/app`);
    assert.equal(spaResponse.status, 200);
    assert.match(String(spaResponse.headers.get("content-type") || ""), /text\/html/);
    assert.match(await spaResponse.text(), /shell/);

    const catalogResponse = await fetch(`${baseUrl}/catalog/loja-demo`);
    assert.equal(catalogResponse.status, 200);
    const catalogHtml = await catalogResponse.text();
    assert.match(catalogHtml, /shell/);
    assert.match(catalogHtml, /Loja Demo \| KASTROZAPP/);
    assert.match(catalogHtml, /Produtos frescos da loja demo/);

    const assetResponse = await fetch(`${baseUrl}/assets/app-abc123.js`);
    assert.equal(assetResponse.status, 200);
    assert.match(String(assetResponse.headers.get("cache-control") || ""), /immutable/);
    assert.match(await assetResponse.text(), /asset/);

    const missingApiResponse = await fetch(`${baseUrl}/api/unknown`);
    assert.equal(missingApiResponse.status, 404);
    assert.deepEqual(await missingApiResponse.json(), { error: "Endpoint nao encontrado." });

    const storefrontRedirectResponse = await requestWithHost(port, "/", "demo.minhaloja.com");
    assert.equal(storefrontRedirectResponse.statusCode, 302);
    assert.equal(storefrontRedirectResponse.headers.location, "/catalog/store-demo");
  } finally {
    await close(server);
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}
