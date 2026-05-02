import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export function runNetlifyConfigTests() {
  const netlifyTomlPath = path.resolve("netlify.toml");
  const netlifyToml = fs.readFileSync(netlifyTomlPath, "utf8");

  assert.match(
    netlifyToml,
    /\[\[redirects\]\][\s\S]*?from = "\/api\/\*"[\s\S]*?to = "\/\.netlify\/functions\/:splat"[\s\S]*?status = 200/,
  );

  const apiRedirectIndex = netlifyToml.indexOf('from = "/api/*"');
  const spaRedirectIndex = netlifyToml.indexOf('from = "/*"');

  assert.notEqual(apiRedirectIndex, -1, "Falta o redirect /api/* no netlify.toml.");
  assert.notEqual(spaRedirectIndex, -1, "Falta o redirect SPA catch-all no netlify.toml.");
  assert.ok(
    apiRedirectIndex < spaRedirectIndex,
    "O redirect /api/* precisa de vir antes do catch-all SPA.",
  );
}
