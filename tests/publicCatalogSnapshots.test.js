import assert from "node:assert/strict";
import {
  buildPublicCatalogSnapshotPayload,
  createPublicCatalogSnapshotBody,
  hydratePublicCatalogSnapshotBody,
  sortPublicCatalogProducts,
} from "../netlify/functions/_public-catalog-snapshots.js";

export async function runPublicCatalogSnapshotTests() {
  const unsortedProducts = [
    { id: "prod-2", name: "Banana", category: "Fruta", price: 250, available: true },
    { id: "prod-1", name: "Abacate", category: "Fruta", price: 300, available: true },
    { id: "prod-3", name: "Cafe", category: "Bebidas", price: 800, available: true },
  ];

  const sortedProducts = sortPublicCatalogProducts(unsortedProducts);
  assert.deepEqual(
    sortedProducts.map((product) => product.id),
    ["prod-3", "prod-1", "prod-2"],
  );

  const payload = buildPublicCatalogSnapshotPayload({
    id: "store-demo",
    store: {
      name: "Loja Demo",
      description: "Produtos frescos",
      whatsapp: "244911111111",
      logo: "/logo.svg",
      color: "#118866",
      currencyCode: "AOA",
      pickupNote: "Retira na loja",
      whatsappOrderFormat: "text_only",
      publicEnabled: true,
      publicSlug: "loja-demo",
      customDomain: "loja.exemplo.com",
      legalName: "Nao deve sair",
      businessEmail: "privado@demo.com",
    },
    products: unsortedProducts,
  });

  assert.equal(payload.id, "store-demo");
  assert.equal(payload.store.name, "Loja Demo");
  assert.equal(payload.store.publicSlug, "loja-demo");
  assert.equal("legalName" in payload.store, false);
  assert.equal("businessEmail" in payload.store, false);
  assert.deepEqual(
    payload.products.map((product) => product.id),
    ["prod-3", "prod-1", "prod-2"],
  );

  const hydratedPayload = hydratePublicCatalogSnapshotBody(
    createPublicCatalogSnapshotBody({
      id: "store-demo",
      store: payload.store,
      products: payload.products,
    }),
    "244900000000",
  );

  assert.equal(hydratedPayload.store.supportWhatsApp, "244900000000");
  assert.equal(hydratedPayload.products.length, 3);
  assert.equal(hydratedPayload.products[0].id, "prod-3");
}
