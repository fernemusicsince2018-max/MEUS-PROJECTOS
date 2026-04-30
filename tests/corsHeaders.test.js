import assert from "node:assert/strict";
import { jsonResponse, withCors } from "../netlify/functions/_postgres.js";

function createEvent(method, origin = "", extraHeaders = {}) {
  return {
    httpMethod: method,
    headers: {
      host: "api.example.com",
      "x-forwarded-proto": "https",
      ...(origin ? { origin } : {}),
      ...(extraHeaders || {}),
    },
    rawUrl: "https://api.example.com/.netlify/functions/demo",
  };
}

export async function runCorsHeadersTests() {
  const previousAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS;

  try {
    process.env.CORS_ALLOWED_ORIGINS =
      "capacitor://localhost,http://localhost,https://*.catalogofernagest.com";

    const wrappedGet = withCors(
      async () => jsonResponse(200, { ok: true }),
      { allowMethods: ["GET"] },
    );

    const allowedResponse = await wrappedGet(createEvent("GET", "capacitor://localhost"));
    assert.equal(allowedResponse.statusCode, 200);
    assert.equal(allowedResponse.headers["Access-Control-Allow-Origin"], "capacitor://localhost");
    assert.equal(allowedResponse.headers["Access-Control-Allow-Credentials"], "true");
    assert.match(String(allowedResponse.headers.Vary || ""), /Origin/);

    const wildcardResponse = await wrappedGet(
      createEvent("GET", "https://loja-1.catalogofernagest.com"),
    );
    assert.equal(
      wildcardResponse.headers["Access-Control-Allow-Origin"],
      "https://loja-1.catalogofernagest.com",
    );

    const preflightResponse = await wrappedGet(
      createEvent("OPTIONS", "capacitor://localhost", {
        "access-control-request-headers": "content-type",
      }),
    );
    assert.equal(preflightResponse.statusCode, 204);
    assert.equal(preflightResponse.body, "");
    assert.equal(
      preflightResponse.headers["Access-Control-Allow-Origin"],
      "capacitor://localhost",
    );
    assert.match(
      String(preflightResponse.headers["Access-Control-Allow-Methods"] || ""),
      /GET/,
    );
    assert.match(
      String(preflightResponse.headers["Access-Control-Allow-Methods"] || ""),
      /OPTIONS/,
    );
    assert.match(
      String(preflightResponse.headers["Access-Control-Allow-Headers"] || ""),
      /content-type/i,
    );

    const manualWrappedGet = withCors(
      async () => ({
        body: "{}",
        headers: {
          ETag: "\"demo\"",
          Vary: "Accept-Encoding",
        },
        statusCode: 200,
      }),
      { allowMethods: ["GET"] },
    );
    const manualResponse = await manualWrappedGet(createEvent("GET", "http://localhost"));
    assert.equal(manualResponse.headers["Access-Control-Allow-Origin"], "http://localhost");
    assert.match(String(manualResponse.headers.Vary || ""), /Origin/);
    assert.match(String(manualResponse.headers.Vary || ""), /Accept-Encoding/);
    assert.equal(manualResponse.headers.ETag, "\"demo\"");

    const cookieResponse = await withCors(
      async () =>
        jsonResponse(
          200,
          { ok: true },
          {
            "Set-Cookie": "catalog_session=abc; Path=/; HttpOnly",
          },
        ),
      { allowMethods: ["POST"] },
    )(createEvent("POST", "capacitor://localhost"));
    assert.equal(cookieResponse.headers["Access-Control-Allow-Credentials"], "true");
    assert.equal(
      cookieResponse.headers["Set-Cookie"],
      "catalog_session=abc; Path=/; HttpOnly",
    );

    const methodNotAllowedResponse = await wrappedGet(createEvent("POST", "capacitor://localhost"));
    assert.equal(methodNotAllowedResponse.statusCode, 405);
    assert.match(String(methodNotAllowedResponse.headers.Allow || ""), /GET/);
    assert.match(String(methodNotAllowedResponse.headers.Allow || ""), /OPTIONS/);
    assert.equal(
      methodNotAllowedResponse.headers["Access-Control-Allow-Origin"],
      "capacitor://localhost",
    );

    const deniedPreflightResponse = await wrappedGet(
      createEvent("OPTIONS", "https://evil.example.com", {
        "access-control-request-headers": "content-type",
      }),
    );
    assert.equal(deniedPreflightResponse.statusCode, 403);
    assert.equal(
      deniedPreflightResponse.headers["Access-Control-Allow-Origin"],
      undefined,
    );

    process.env.CORS_ALLOWED_ORIGINS = "";
    const sameOriginResponse = await wrappedGet(createEvent("GET", "https://api.example.com"));
    assert.equal(
      sameOriginResponse.headers["Access-Control-Allow-Origin"],
      "https://api.example.com",
    );

    const disallowedResponse = await wrappedGet(createEvent("GET", "https://evil.example.com"));
    assert.equal(disallowedResponse.statusCode, 200);
    assert.equal(disallowedResponse.headers["Access-Control-Allow-Origin"], undefined);
    assert.equal(disallowedResponse.headers.Vary, "Origin");
  } finally {
    if (typeof previousAllowedOrigins === "undefined") {
      delete process.env.CORS_ALLOWED_ORIGINS;
    } else {
      process.env.CORS_ALLOWED_ORIGINS = previousAllowedOrigins;
    }
  }
}
