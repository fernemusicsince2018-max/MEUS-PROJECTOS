import assert from "node:assert/strict";
import {
  MERCHANT_REVIEWS_AUTO_REFRESH_MS,
  mergeRefreshedMerchantReviews,
  resolveMerchantReviewsRefreshLimit,
} from "../src/catalog/controllers/useMerchantController.js";
import {
  STORE_REVIEW_PAGE_LIMIT,
  STORE_REVIEW_PAGE_MAX_LIMIT,
} from "../shared/storeReviews.js";

export async function runMerchantReviewsAutoRefreshTests() {
  assert.equal(MERCHANT_REVIEWS_AUTO_REFRESH_MS, 60 * 1000);

  assert.equal(
    resolveMerchantReviewsRefreshLimit({}, []),
    STORE_REVIEW_PAGE_LIMIT,
  );

  assert.equal(
    resolveMerchantReviewsRefreshLimit(
      {
        limit: STORE_REVIEW_PAGE_LIMIT,
        nextOffset: 24,
      },
      Array.from({ length: 24 }, (_, index) => ({ id: `rev-${index}` })),
    ),
    24,
  );

  assert.equal(
    resolveMerchantReviewsRefreshLimit(
      {
        limit: STORE_REVIEW_PAGE_LIMIT,
        nextOffset: 99,
      },
      Array.from({ length: 40 }, (_, index) => ({ id: `rev-max-${index}` })),
    ),
    STORE_REVIEW_PAGE_MAX_LIMIT,
  );

  const mergedReviews = mergeRefreshedMerchantReviews(
    [
      { id: "rev-new-1" },
      { id: "rev-new-2" },
    ],
    [
      { id: "rev-old-1" },
      { id: "rev-old-2" },
      { id: "rev-old-3" },
      { id: "rev-old-4" },
      { id: "rev-old-5" },
    ],
    5,
  );
  assert.deepEqual(
    mergedReviews.map((review) => review.id),
    ["rev-new-1", "rev-new-2", "rev-old-1", "rev-old-2", "rev-old-3"],
  );

  const mergedReviewsClampedToTotal = mergeRefreshedMerchantReviews(
    [
      { id: "rev-fresh-1" },
      { id: "rev-fresh-2" },
    ],
    [
      { id: "rev-stale-1" },
      { id: "rev-stale-2" },
      { id: "rev-stale-3" },
    ],
    3,
  );
  assert.deepEqual(
    mergedReviewsClampedToTotal.map((review) => review.id),
    ["rev-fresh-1", "rev-fresh-2", "rev-stale-1"],
  );
}
