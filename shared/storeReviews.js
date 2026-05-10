export const STORE_REVIEW_MIN_RATING = 1;
export const STORE_REVIEW_MAX_RATING = 5;
export const STORE_REVIEW_MAX_COMMENT_LENGTH = 1200;
export const STORE_REVIEW_PUBLIC_LIMIT = 6;
export const STORE_REVIEW_FEATURED_LIMIT = 5;
export const STORE_REVIEW_RECENT_LIMIT = 3;
export const STORE_REVIEW_PAGE_LIMIT = 12;
export const STORE_REVIEW_PAGE_MAX_LIMIT = 24;

function cleanText(value, maxLength = null) {
  const text = String(value ?? "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function toTimestamp(value) {
  if (!value) return Number.NaN;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const text = cleanText(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function compareNewestFirst(left, right) {
  return toTimestamp(right?.updatedAt || right?.createdAt) - toTimestamp(left?.updatedAt || left?.createdAt)
    || String(right?.id || "").localeCompare(String(left?.id || ""));
}

function compareFeaturedFirst(left, right) {
  const leftFeatured = normalizeBoolean(left?.isFeatured);
  const rightFeatured = normalizeBoolean(right?.isFeatured);
  if (leftFeatured !== rightFeatured) {
    return Number(rightFeatured) - Number(leftFeatured);
  }

  if (leftFeatured && rightFeatured) {
    return toTimestamp(right?.featuredAt || right?.updatedAt || right?.createdAt)
      - toTimestamp(left?.featuredAt || left?.updatedAt || left?.createdAt)
      || compareNewestFirst(left, right);
  }

  return compareNewestFirst(left, right);
}

function normalizePositiveInteger(value, fallback, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

function createStoreReviewCustomerLabel(name = "", phone = "") {
  const safeName = cleanText(name, 160);
  if (safeName) {
    return safeName.split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
  }

  const digits = String(phone || "").replace(/\D/g, "");
  if (digits) {
    return `Cliente ${digits.slice(-4)}`;
  }

  return "Cliente verificado";
}

function mapPublicStoreReview(review) {
  return {
    id: review.id,
    orderId: review.orderId,
    rating: review.rating,
    comment: review.comment,
    customerLabel: createStoreReviewCustomerLabel(review.customerName, review.customerPhone),
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    isFeatured: review.isFeatured,
    featuredAt: review.featuredAt,
  };
}

export function normalizeStoreReviewRating(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  if (rounded < STORE_REVIEW_MIN_RATING || rounded > STORE_REVIEW_MAX_RATING) {
    return fallback;
  }
  return rounded;
}

export function isValidStoreReviewRating(value) {
  return normalizeStoreReviewRating(value, 0) >= STORE_REVIEW_MIN_RATING;
}

export function normalizeStoreReviewComment(value) {
  return cleanText(value, STORE_REVIEW_MAX_COMMENT_LENGTH);
}

export function buildStoreReviewCustomerLabel(name = "", phone = "") {
  return createStoreReviewCustomerLabel(name, phone);
}

export function normalizeStoreReviewRecord(record = {}) {
  return {
    id: cleanText(record.id),
    storeId: cleanText(record.storeId),
    orderId: cleanText(record.orderId),
    customerKey: cleanText(record.customerKey),
    customerName: cleanText(record.customerName, 160),
    customerPhone: String(record.customerPhone || "").replace(/\D/g, "").slice(0, 32),
    rating: normalizeStoreReviewRating(record.rating),
    comment: normalizeStoreReviewComment(record.comment),
    isPublic: record.isPublic !== false,
    isFeatured: normalizeBoolean(record.isFeatured),
    featuredAt: record.featuredAt || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

export function sortStoreReviewsNewestFirst(reviews = []) {
  return [...reviews].sort(compareNewestFirst);
}

export function sortStoreReviewsForPublicFeed(reviews = []) {
  return [...reviews].sort(compareFeaturedFirst);
}

export function createEmptyStoreReviewSummary() {
  return {
    averageRating: 0,
    totalReviews: 0,
    testimonialCount: 0,
    featuredCount: 0,
    distribution: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
  };
}

export function buildStoreReviewSummary(reviews = []) {
  const summary = createEmptyStoreReviewSummary();
  let ratingSum = 0;

  for (const review of reviews) {
    const normalized = normalizeStoreReviewRecord(review);
    if (!isValidStoreReviewRating(normalized.rating)) continue;

    summary.totalReviews += 1;
    summary.distribution[normalized.rating] += 1;
    ratingSum += normalized.rating;

    if (normalized.isPublic && normalized.comment) {
      summary.testimonialCount += 1;
      if (normalized.isFeatured) {
        summary.featuredCount += 1;
      }
    }
  }

  if (summary.totalReviews > 0) {
    summary.averageRating = Number((ratingSum / summary.totalReviews).toFixed(1));
  }

  return summary;
}

export function buildFeaturedTestimonials(reviews = [], options = {}) {
  const limit = normalizePositiveInteger(
    options.limit,
    STORE_REVIEW_FEATURED_LIMIT,
    1,
    STORE_REVIEW_FEATURED_LIMIT,
  );

  return sortStoreReviewsForPublicFeed(reviews)
    .map(normalizeStoreReviewRecord)
    .filter((review) =>
      review.isPublic
      && review.isFeatured
      && review.comment
      && isValidStoreReviewRating(review.rating))
    .slice(0, limit)
    .map(mapPublicStoreReview);
}

export function buildRecentTestimonials(reviews = [], options = {}) {
  const limit = normalizePositiveInteger(options.limit, STORE_REVIEW_RECENT_LIMIT, 0);
  if (limit < 1) {
    return [];
  }
  const excludeIds = new Set(
    Array.isArray(options.excludeIds)
      ? options.excludeIds.map((value) => cleanText(value)).filter(Boolean)
      : [],
  );
  const excludeFeatured = options.excludeFeatured === true;

  return sortStoreReviewsNewestFirst(reviews)
    .map(normalizeStoreReviewRecord)
    .filter((review) =>
      review.isPublic
      && review.comment
      && isValidStoreReviewRating(review.rating)
      && !excludeIds.has(review.id)
      && (!excludeFeatured || !review.isFeatured))
    .slice(0, limit)
    .map(mapPublicStoreReview);
}

export function buildPublicTestimonials(reviews = [], options = {}) {
  const limit = normalizePositiveInteger(options.limit, STORE_REVIEW_PUBLIC_LIMIT, 1);
  const featuredTestimonials = buildFeaturedTestimonials(reviews, {
    limit: Math.min(limit, normalizePositiveInteger(options.featuredLimit, STORE_REVIEW_FEATURED_LIMIT, 1, STORE_REVIEW_FEATURED_LIMIT)),
  });
  const recentTestimonials = buildRecentTestimonials(reviews, {
    limit: Math.max(0, limit - featuredTestimonials.length),
    excludeIds: featuredTestimonials.map((entry) => entry.id),
    excludeFeatured: true,
  });

  return [...featuredTestimonials, ...recentTestimonials].slice(0, limit);
}

export function buildPublicReviewFeedEntries(reviews = [], options = {}) {
  const limit = normalizePositiveInteger(options.limit, STORE_REVIEW_PAGE_LIMIT, 1, STORE_REVIEW_PAGE_MAX_LIMIT);
  const offset = normalizePositiveInteger(options.offset, 0, 0);

  return sortStoreReviewsForPublicFeed(reviews)
    .map(normalizeStoreReviewRecord)
    .filter((review) => review.isPublic && isValidStoreReviewRating(review.rating))
    .slice(offset, offset + limit)
    .map(mapPublicStoreReview);
}

export function attachStoreReviewDataToStore(store = {}, reviews = [], options = {}) {
  const featuredTestimonials = buildFeaturedTestimonials(reviews, {
    limit: options.featuredLimit || STORE_REVIEW_FEATURED_LIMIT,
  });
  const recentTestimonials = buildRecentTestimonials(reviews, {
    limit: options.recentLimit || STORE_REVIEW_RECENT_LIMIT,
    excludeIds: featuredTestimonials.map((entry) => entry.id),
    excludeFeatured: true,
  });

  return {
    ...store,
    reviewSummary: buildStoreReviewSummary(reviews),
    testimonials: buildPublicTestimonials(reviews, options),
    featuredTestimonials,
    recentTestimonials,
  };
}
