import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createFreshFunctionsWorkspace } from "../scripts/functions-runtime.mjs";

export async function runFunctionsRuntimeTests() {
  const workspace = createFreshFunctionsWorkspace();

  try {
    assert.equal(
      fs.existsSync(path.join(workspace.functionsDir, "catalog-save.js")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(workspace.workspaceDir, "shared", "storefront.js")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(workspace.functionsDir, "merchant-reviews.js")),
      true,
    );

    const merchantReviewsModule = await import("../netlify/functions/merchant-reviews.js");
    assert.equal(typeof merchantReviewsModule.handler, "function");
  } finally {
    fs.rmSync(workspace.workspaceDir, { recursive: true, force: true });
  }
}
