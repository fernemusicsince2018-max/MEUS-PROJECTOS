import assert from "node:assert/strict";
import {
  buildStorefrontCatalogUrl,
  isLocalNetworkHostname,
  shouldPreferCurrentOriginForPublicLinks,
} from "../shared/storefront.js";

export function runStorefrontTests() {
  assert.equal(isLocalNetworkHostname("localhost"), true);
  assert.equal(isLocalNetworkHostname("127.0.0.1"), true);
  assert.equal(isLocalNetworkHostname("192.168.1.45"), true);
  assert.equal(isLocalNetworkHostname("172.20.10.5"), true);
  assert.equal(isLocalNetworkHostname("10.0.0.18"), true);
  assert.equal(isLocalNetworkHostname("kastrozapp.shop"), false);

  assert.equal(
    shouldPreferCurrentOriginForPublicLinks("http://localhost:5173", {
      publicCatalogBaseUrl: "https://kastrozapp.shop",
      publicCatalogBaseDomain: "kastrozapp.shop",
    }),
    true,
  );

  assert.equal(
    shouldPreferCurrentOriginForPublicLinks("http://192.168.1.20:4173", {
      publicCatalogBaseUrl: "https://kastrozapp.shop",
      publicCatalogBaseDomain: "kastrozapp.shop",
    }),
    true,
  );

  assert.equal(
    shouldPreferCurrentOriginForPublicLinks("https://kastrozapp.shop", {
      publicCatalogBaseUrl: "https://kastrozapp.shop",
      publicCatalogBaseDomain: "kastrozapp.shop",
    }),
    false,
  );

  assert.equal(
    shouldPreferCurrentOriginForPublicLinks("https://loja-demo.kastrozapp.shop", {
      publicCatalogBaseUrl: "https://kastrozapp.shop",
      publicCatalogBaseDomain: "kastrozapp.shop",
    }),
    false,
  );

  assert.equal(
    buildStorefrontCatalogUrl(
      "store-demo",
      { publicSlug: "loja-demo" },
      {
        origin: "http://localhost:5173",
        publicCatalogBaseUrl: "",
        publicCatalogBaseDomain: "",
      },
    ),
    "http://localhost:5173/catalog/store-demo",
  );
}
