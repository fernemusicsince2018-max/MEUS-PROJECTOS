import assert from "node:assert/strict";
import {
  buildAuthPath,
  buildMerchantAppPath,
  buildPublicCatalogPath,
  buildRootPath,
  buildSuperAdminPath,
  buildTrackingPath,
  readAppRoute,
} from "../src/catalog/utils/appRoutes.js";

export function runAppRoutesTests() {
  assert.equal(buildRootPath(), "/");
  assert.equal(buildAuthPath(), "/auth");
  assert.equal(buildMerchantAppPath(), "/app");
  assert.equal(buildSuperAdminPath(), "/superadmin");
  assert.equal(buildPublicCatalogPath("loja-demo"), "/catalog/loja-demo");
  assert.equal(buildTrackingPath("trk-123"), "/tracking/trk-123");

  assert.deepEqual(readAppRoute({ pathname: "/", search: "", hash: "" }), {
    kind: "home",
    canonicalPath: "/",
  });

  assert.deepEqual(readAppRoute({ pathname: "/auth", search: "", hash: "" }), {
    kind: "auth",
    canonicalPath: "/auth",
  });

  assert.deepEqual(readAppRoute({ pathname: "/app", search: "", hash: "" }), {
    kind: "merchantApp",
    canonicalPath: "/app",
  });

  assert.deepEqual(readAppRoute({ pathname: "/superadmin", search: "", hash: "" }), {
    kind: "superadmin",
    canonicalPath: "/superadmin",
  });

  assert.deepEqual(readAppRoute({ pathname: "/catalog/loja-demo", search: "", hash: "" }), {
    kind: "publicCatalog",
    storeId: "loja-demo",
    preview: false,
    fromLegacyHash: false,
    canonicalPath: "/catalog/loja-demo",
  });

  assert.deepEqual(
    readAppRoute({ pathname: "/catalog/loja-demo", search: "?preview=1", hash: "" }),
    {
      kind: "publicCatalog",
      storeId: "loja-demo",
      preview: true,
      fromLegacyHash: false,
      canonicalPath: "/catalog/loja-demo?preview=1",
    },
  );

  assert.deepEqual(readAppRoute({ pathname: "/tracking/trk-123", search: "", hash: "" }), {
    kind: "tracking",
    token: "trk-123",
    fromLegacyHash: false,
    canonicalPath: "/tracking/trk-123",
  });

  assert.deepEqual(readAppRoute({ pathname: "/", search: "", hash: "#v:loja-demo" }), {
    kind: "publicCatalog",
    storeId: "loja-demo",
    preview: false,
    fromLegacyHash: true,
    canonicalPath: "/catalog/loja-demo",
  });

  assert.deepEqual(readAppRoute({ pathname: "/rota-inexistente", search: "", hash: "" }), {
    kind: "notFound",
    canonicalPath: "/rota-inexistente",
  });
}
