import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadLocalEnv } from "../scripts/loadEnv.mjs";

export function runLoadEnvTests() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kastrozap-env-"));

  try {
    fs.writeFileSync(
      path.join(tempDir, ".env"),
      [
        "POSTGRES_SSL=true",
        "APP_BASE_URL=https://kastrozap.netlify.app",
      ].join("\n"),
    );

    fs.writeFileSync(
      path.join(tempDir, ".env.local"),
      [
        "POSTGRES_SSL=false",
        "DATABASE_URL=",
      ].join("\n"),
    );

    const previousSsl = process.env.POSTGRES_SSL;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousBaseUrl = process.env.APP_BASE_URL;
    const previousPort = process.env.LOCAL_FUNCTIONS_PORT;

    try {
      delete process.env.POSTGRES_SSL;
      delete process.env.DATABASE_URL;
      delete process.env.APP_BASE_URL;
      delete process.env.LOCAL_FUNCTIONS_PORT;

      loadLocalEnv("development", tempDir);

      assert.equal(process.env.POSTGRES_SSL, "false");
      assert.equal(process.env.DATABASE_URL, "");
      assert.equal(process.env.APP_BASE_URL, "https://kastrozap.netlify.app");

      process.env.APP_BASE_URL = "http://localhost:4173";
      process.env.LOCAL_FUNCTIONS_PORT = "8890";

      loadLocalEnv("development", tempDir);

      assert.equal(process.env.APP_BASE_URL, "http://localhost:4173");
      assert.equal(process.env.LOCAL_FUNCTIONS_PORT, "8890");
    } finally {
      if (previousSsl == null) {
        delete process.env.POSTGRES_SSL;
      } else {
        process.env.POSTGRES_SSL = previousSsl;
      }

      if (previousDatabaseUrl == null) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }

      if (previousBaseUrl == null) {
        delete process.env.APP_BASE_URL;
      } else {
        process.env.APP_BASE_URL = previousBaseUrl;
      }

      if (previousPort == null) {
        delete process.env.LOCAL_FUNCTIONS_PORT;
      } else {
        process.env.LOCAL_FUNCTIONS_PORT = previousPort;
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
