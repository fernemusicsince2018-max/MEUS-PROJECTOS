import assert from "node:assert/strict";
import { getSystemReadiness } from "../netlify/functions/_integrations.js";
import { materializePublicImageAsset } from "../netlify/functions/_storage.js";

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

export async function runIntegrationTests() {
  await withEnv(
    {
      DATABASE_URL: "",
      POSTGRES_POOLER_URL: "postgres://pooler:demo@localhost:6543/demo?sslmode=require",
      POSTGRES_USE_POOLER: "true",
      VITE_CATALOG_API_BASE: "/api",
      VITE_NATIVE_CATALOG_API_BASE: "https://catalogo.exemplo.com/api",
      VITE_PUBLIC_CATALOG_BASE_URL: "https://catalogo.exemplo.com",
      APP_BASE_URL: "https://catalogo.exemplo.com",
      CORS_ALLOWED_ORIGINS: "capacitor://localhost,http://localhost,https://*.catalogo.exemplo.com",
      SESSION_COOKIE_SAME_SITE: "None",
      SESSION_COOKIE_SECURE: "true",
      RESEND_API_KEY: "re_demo",
      PASSWORD_RESET_FROM_EMAIL: "no-reply@catalogo.exemplo.com",
      WHATSAPP_CLOUD_API_TOKEN: "token-demo",
      WHATSAPP_CLOUD_PHONE_NUMBER_ID: "123456789",
      NOTIFICATION_DISPATCH_SECRET: "dispatch-secret",
      SUPABASE_URL: "https://demo.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-demo",
      SUPABASE_STORAGE_BUCKET: "catalog-assets",
    },
    async () => {
      const readiness = getSystemReadiness();
      assert.equal(readiness.ready, true);
      assert.equal(readiness.coreReady, true);
      assert.equal(readiness.readyCount, readiness.totalCount);
      assert.equal(readiness.items.every((item) => item.ready), true);
    },
  );

  await withEnv(
    {
      DATABASE_URL: "",
      POSTGRES_POOLER_URL: "",
      POSTGRES_USE_POOLER: "",
      POSTGRES_HOST: "",
      POSTGRES_DATABASE: "",
      POSTGRES_USER: "",
      POSTGRES_PASSWORD: "",
      VITE_CATALOG_API_BASE: "",
      VITE_NATIVE_CATALOG_API_BASE: "",
      VITE_PUBLIC_CATALOG_BASE_URL: "",
      VITE_ALLOW_LOCAL_FALLBACK: "true",
      APP_BASE_URL: "",
      CORS_ALLOWED_ORIGINS: "",
      SESSION_COOKIE_SAME_SITE: "",
      SESSION_COOKIE_SECURE: "",
      RESEND_API_KEY: "",
      PASSWORD_RESET_FROM_EMAIL: "",
      WHATSAPP_CLOUD_API_TOKEN: "",
      WHATSAPP_CLOUD_PHONE_NUMBER_ID: "",
      NOTIFICATION_DISPATCH_SECRET: "",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
    async () => {
      const readiness = getSystemReadiness();
      assert.equal(readiness.ready, false);
      assert.equal(readiness.coreReady, false);
      assert.equal(readiness.items.some((item) => item.ready === false), true);
      assert.equal(readiness.items.find((item) => item.id === "catalog_api")?.ready, false);
    },
  );

  await withEnv(
    {
      VITE_NATIVE_CATALOG_API_BASE: "https://catalogo.exemplo.com/api",
      APP_BASE_URL: "https://catalogo.exemplo.com",
      CORS_ALLOWED_ORIGINS: "https://*.catalogo.exemplo.com",
      SESSION_COOKIE_SAME_SITE: "Lax",
      SESSION_COOKIE_SECURE: "false",
    },
    async () => {
      const readiness = getSystemReadiness();
      const nativeSessionItem = readiness.items.find((item) => item.id === "native_app_session");
      assert.equal(nativeSessionItem?.ready, false);
      assert.match(
        String(nativeSessionItem?.missing.join(", ") || ""),
        /SESSION_COOKIE_SAME_SITE=None|capacitor:\/\/localhost/i,
      );
    },
  );

  const publicUrl = await materializePublicImageAsset({
    value: "https://cdn.exemplo.com/produto.jpg",
    scope: "product-images",
    ownerId: "store-demo",
    fileName: "produto.jpg",
  });
  assert.equal(publicUrl, "https://cdn.exemplo.com/produto.jpg");

  await withEnv(
    {
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
    async () => {
      await assert.rejects(
        () =>
          materializePublicImageAsset({
            value: "data:image/png;base64,AAAA",
            scope: "product-images",
            ownerId: "store-demo",
            fileName: "produto.png",
          }),
        /storage ainda nao esta configurado|SUPABASE_URL/i,
      );
    },
  );
}
