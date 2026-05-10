import assert from "node:assert/strict";
import {
  attachStoreReviewDataToStore,
  buildFeaturedTestimonials,
  buildRecentTestimonials,
  buildPublicTestimonials,
  buildStoreReviewSummary,
} from "../shared/storeReviews.js";

export async function runStoreReviewsTests() {
  const reviews = [
    {
      id: "rev-1",
      storeId: "store-demo",
      orderId: "ord-1",
      customerName: "Ana Silva",
      customerPhone: "244911111111",
      rating: 5,
      comment: "Atendimento impecavel e entrega muito rapida.",
      isPublic: true,
      isFeatured: true,
      featuredAt: "2026-05-01T12:00:00.000Z",
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
    },
    {
      id: "rev-2",
      storeId: "store-demo",
      orderId: "ord-2",
      customerName: "Bruno Costa",
      customerPhone: "244922222222",
      rating: 4,
      comment: "Gostei do atendimento e voltarei a comprar.",
      isPublic: true,
      isFeatured: false,
      createdAt: "2026-05-02T09:00:00.000Z",
      updatedAt: "2026-05-02T11:00:00.000Z",
    },
    {
      id: "rev-3",
      storeId: "store-demo",
      orderId: "ord-3",
      customerName: "Carla Mendes",
      customerPhone: "244933333333",
      rating: 3,
      comment: "",
      isPublic: true,
      isFeatured: false,
      createdAt: "2026-05-03T08:00:00.000Z",
      updatedAt: "2026-05-03T08:00:00.000Z",
    },
    {
      id: "rev-4",
      storeId: "store-demo",
      orderId: "ord-4",
      customerName: "Dario Pedro",
      customerPhone: "244944444444",
      rating: 2,
      comment: "Prefiro manter este comentario fora da vitrine.",
      isPublic: false,
      isFeatured: false,
      createdAt: "2026-05-04T08:00:00.000Z",
      updatedAt: "2026-05-04T08:00:00.000Z",
    },
  ];

  const summary = buildStoreReviewSummary(reviews);
  assert.equal(summary.averageRating, 3.5);
  assert.equal(summary.totalReviews, 4);
  assert.equal(summary.testimonialCount, 2);
  assert.equal(summary.featuredCount, 1);
  assert.equal(summary.distribution[5], 1);
  assert.equal(summary.distribution[4], 1);
  assert.equal(summary.distribution[3], 1);
  assert.equal(summary.distribution[2], 1);

  const testimonials = buildPublicTestimonials(reviews, { limit: 2 });
  assert.equal(testimonials.length, 2);
  assert.equal(testimonials[0].id, "rev-1");
  assert.equal(testimonials[0].customerLabel, "Ana Silva");
  assert.equal(testimonials[1].id, "rev-2");

  const featuredTestimonials = buildFeaturedTestimonials(reviews, { limit: 5 });
  assert.equal(featuredTestimonials.length, 1);
  assert.equal(featuredTestimonials[0].id, "rev-1");

  const recentTestimonials = buildRecentTestimonials(reviews, {
    limit: 3,
    excludeFeatured: true,
  });
  assert.equal(recentTestimonials.length, 1);
  assert.equal(recentTestimonials[0].id, "rev-2");

  const store = attachStoreReviewDataToStore(
    {
      name: "Loja Demo",
    },
    reviews,
    { limit: 1 },
  );

  assert.equal(store.name, "Loja Demo");
  assert.equal(store.reviewSummary.totalReviews, 4);
  assert.equal(store.testimonials.length, 1);
  assert.equal(store.testimonials[0].id, "rev-1");
  assert.equal(store.featuredTestimonials.length, 1);
  assert.equal(store.featuredTestimonials[0].id, "rev-1");
  assert.equal(store.recentTestimonials.length, 1);
  assert.equal(store.recentTestimonials[0].id, "rev-2");
}
