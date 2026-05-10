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
      reviewSummary: {
        averageRating: 4.8,
        totalReviews: 12,
        testimonialCount: 2,
        featuredCount: 1,
        distribution: {
          1: 0,
          2: 0,
          3: 1,
          4: 2,
          5: 9,
        },
      },
      testimonials: [
        {
          id: "rev-1",
          orderId: "ord-1",
          rating: 5,
          comment: "Atendimento impecavel",
          customerLabel: "Ana Silva",
          createdAt: "2026-05-01T10:00:00.000Z",
          updatedAt: "2026-05-01T10:00:00.000Z",
          isFeatured: true,
          featuredAt: "2026-05-01T12:00:00.000Z",
        },
      ],
      featuredTestimonials: [
        {
          id: "rev-1",
          orderId: "ord-1",
          rating: 5,
          comment: "Atendimento impecavel",
          customerLabel: "Ana Silva",
          createdAt: "2026-05-01T10:00:00.000Z",
          updatedAt: "2026-05-01T10:00:00.000Z",
          isFeatured: true,
          featuredAt: "2026-05-01T12:00:00.000Z",
        },
      ],
      recentTestimonials: [
        {
          id: "rev-2",
          orderId: "ord-2",
          rating: 4,
          comment: "Entrega rapida e bom atendimento",
          customerLabel: "Bruno Costa",
          createdAt: "2026-05-02T10:00:00.000Z",
          updatedAt: "2026-05-02T10:00:00.000Z",
          isFeatured: false,
          featuredAt: null,
        },
      ],
      legalName: "Nao deve sair",
      businessEmail: "privado@demo.com",
      paymentMethod: "Transferencia bancaria",
      paymentBankName: "Banco Demo",
      paymentAccountName: "Loja Demo, Lda.",
      paymentAccountNumber: "000123456789",
      paymentIban: "AO06000123456789",
    },
    products: unsortedProducts,
  });

  assert.equal(payload.id, "store-demo");
  assert.equal(payload.store.name, "Loja Demo");
  assert.equal(payload.store.publicSlug, "loja-demo");
  assert.equal("legalName" in payload.store, false);
  assert.equal("businessEmail" in payload.store, false);
  assert.equal("paymentMethod" in payload.store, false);
  assert.equal("paymentBankName" in payload.store, false);
  assert.equal("paymentAccountName" in payload.store, false);
  assert.equal("paymentAccountNumber" in payload.store, false);
  assert.equal("paymentIban" in payload.store, false);
  assert.equal(payload.store.reviewSummary.averageRating, 4.8);
  assert.equal(payload.store.reviewSummary.featuredCount, 1);
  assert.equal(payload.store.testimonials.length, 1);
  assert.equal(payload.store.testimonials[0].isFeatured, true);
  assert.equal(payload.store.featuredTestimonials.length, 1);
  assert.equal(payload.store.recentTestimonials.length, 1);
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
  assert.equal(hydratedPayload.store.reviewSummary.totalReviews, 12);
  assert.equal(hydratedPayload.store.reviewSummary.featuredCount, 1);
  assert.equal(hydratedPayload.store.testimonials[0].id, "rev-1");
  assert.equal(hydratedPayload.store.featuredTestimonials[0].featuredAt, "2026-05-01T12:00:00.000Z");
  assert.equal(hydratedPayload.store.recentTestimonials[0].id, "rev-2");
  assert.equal(hydratedPayload.products.length, 3);
  assert.equal(hydratedPayload.products[0].id, "prod-3");
}
