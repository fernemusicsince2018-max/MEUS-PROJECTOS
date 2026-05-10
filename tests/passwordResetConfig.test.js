import assert from "node:assert/strict";
import { buildPasswordResetLink } from "../netlify/functions/_email.js";
import { shouldExposeResetCode } from "../netlify/functions/_security.js";

async function withEnv(overrides, run) {
  const previous = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export async function runPasswordResetConfigTests() {
  await withEnv(
    {
      APP_BASE_URL: "https://kastrozap.netlify.app",
    },
    async () => {
      const link = buildPasswordResetLink(
        { headers: {} },
        "fernando.ao.castro@gmail.com",
        "token-demo",
      );
      assert.equal(
        link,
        "https://kastrozap.netlify.app/auth?reset_email=fernando.ao.castro%40gmail.com&reset_token=token-demo",
      );
    },
  );

  await withEnv(
    {
      CATALOG_EXPOSE_RESET_CODE: "",
      NETLIFY_LOCAL: "",
      CONTEXT: "production",
      NODE_ENV: "",
      APP_BASE_URL: "https://kastrozap.netlify.app",
    },
    async () => {
      assert.equal(shouldExposeResetCode(), false);
    },
  );

  await withEnv(
    {
      CATALOG_EXPOSE_RESET_CODE: "true",
      NETLIFY_LOCAL: "",
      CONTEXT: "production",
      NODE_ENV: "production",
      APP_BASE_URL: "https://kastrozap.netlify.app",
    },
    async () => {
      assert.equal(shouldExposeResetCode(), true);
    },
  );

  await withEnv(
    {
      CATALOG_EXPOSE_RESET_CODE: "",
      LOCAL_FUNCTIONS_PORT: "8888",
      NETLIFY_LOCAL: "true",
      CONTEXT: "dev",
      NODE_ENV: "",
      APP_BASE_URL: "http://localhost:5173",
    },
    async () => {
      assert.equal(shouldExposeResetCode(), true);
    },
  );

  await withEnv(
    {
      CATALOG_EXPOSE_RESET_CODE: "",
      LOCAL_FUNCTIONS_PORT: "8888",
      NETLIFY_LOCAL: "",
      CONTEXT: "",
      NODE_ENV: "",
      APP_BASE_URL: "https://kastrozap.netlify.app",
    },
    async () => {
      assert.equal(shouldExposeResetCode(), true);
    },
  );
}
