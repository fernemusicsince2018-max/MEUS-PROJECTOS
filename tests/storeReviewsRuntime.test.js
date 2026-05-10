import assert from "node:assert/strict";
import {
  attachPublicStoreReviews,
  createMissingStoreReviewsSchemaError,
  getOrderStoreReview,
  listStoreReviews,
  listStoreReviewsByOrderIds,
} from "../netlify/functions/_store-reviews.js";

function createMissingRelationError() {
  const error = new Error('relation "catalog_store_reviews" does not exist');
  error.code = "42P01";
  return error;
}

function createMissingRelationQueryable() {
  return {
    async query(sql) {
      if (/information_schema\.tables/i.test(String(sql || ""))) {
        return { rowCount: 0, rows: [] };
      }
      throw createMissingRelationError();
    },
  };
}

export async function runStoreReviewsRuntimeTests() {
  const queryable = createMissingRelationQueryable();

  assert.deepEqual(await listStoreReviews(queryable, "store-1"), []);
  assert.equal(await getOrderStoreReview(queryable, "order-1"), null);
  assert.deepEqual(await listStoreReviewsByOrderIds(queryable, ["order-1", "order-2"]), []);

  const attachedStore = await attachPublicStoreReviews(
    queryable,
    { name: "Loja Demo" },
    "store-1",
  );
  assert.equal(attachedStore.name, "Loja Demo");
  assert.equal(attachedStore.reviewSummary.totalReviews, 0);
  assert.deepEqual(attachedStore.testimonials, []);
  assert.deepEqual(attachedStore.featuredTestimonials, []);
  assert.deepEqual(attachedStore.recentTestimonials, []);

  const schemaError = createMissingStoreReviewsSchemaError();
  assert.equal(schemaError.status, 503);
  assert.equal(schemaError.code, "CATALOG_STORE_REVIEWS_SCHEMA_MISSING");
}
