import assert from "node:assert/strict";
import { getRuntimePolicy, isLocalHostname } from "../src/catalog/utils/runtimePolicy.js";

export async function runRuntimePolicyTests() {
  assert.equal(isLocalHostname("localhost"), true);
  assert.equal(isLocalHostname("127.0.0.1"), true);
  assert.equal(isLocalHostname("app.minhaempresa.com"), false);

  const productionPolicy = getRuntimePolicy({
    apiBaseUrl: "",
    hostname: "app.minhaempresa.com",
    mode: "production",
  });

  assert.equal(productionPolicy.allowLocalFallback, false);
  assert.equal(productionPolicy.requireRemoteApi, true);
  assert.equal(productionPolicy.hasApiBaseUrl, false);
  assert.match(productionPolicy.apiRequiredMessage, /VITE_CATALOG_API_BASE/i);

  const developmentPolicy = getRuntimePolicy({
    apiBaseUrl: "",
    hostname: "localhost",
    mode: "development",
  });

  assert.equal(developmentPolicy.allowLocalFallback, true);
  assert.equal(developmentPolicy.requireRemoteApi, false);

  const overriddenPolicy = getRuntimePolicy({
    apiBaseUrl: "",
    hostname: "app.minhaempresa.com",
    mode: "production",
    allowLocalFallbackFlag: "true",
  });

  assert.equal(overriddenPolicy.allowLocalFallback, true);
  assert.equal(overriddenPolicy.requireRemoteApi, false);

  const nativeProductionPolicy = getRuntimePolicy({
    apiBaseUrl: "",
    hostname: "localhost",
    mode: "production",
    isNativeApp: true,
    requiresAbsoluteApiBaseUrl: true,
  });

  assert.equal(nativeProductionPolicy.allowLocalFallback, false);
  assert.equal(nativeProductionPolicy.requireRemoteApi, true);
  assert.match(nativeProductionPolicy.apiRequiredMessage, /VITE_NATIVE_CATALOG_API_BASE|URL absoluta/i);
}
