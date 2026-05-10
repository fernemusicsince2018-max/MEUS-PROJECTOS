import { randomUUID } from "node:crypto";
import { upsertPublicCatalogSnapshot } from "./_public-catalog-snapshots.js";
import { hasTable, mapProduct, mapStore } from "./_postgres.js";
import {
  STORE_REVIEW_FEATURED_LIMIT,
  STORE_REVIEW_PAGE_LIMIT,
  STORE_REVIEW_PAGE_MAX_LIMIT,
  attachStoreReviewDataToStore,
  buildStoreReviewCustomerLabel,
  createEmptyStoreReviewSummary,
  normalizeStoreReviewComment,
  normalizeStoreReviewRating,
} from "../../shared/storeReviews.js";

const STORE_REVIEW_SELECT_COLUMNS = `
  id,
  store_id,
  order_id,
  customer_key,
  customer_name,
  customer_phone,
  rating,
  comment,
  is_public,
  is_featured,
  featured_at,
  created_at,
  updated_at
`;

function cleanText(value, maxLength = null) {
  const text = String(value ?? "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const text = cleanText(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function normalizePositiveInteger(value, fallback, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

function isMissingStoreReviewsRelationError(error) {
  return error?.code === "42P01" && /catalog_store_reviews/i.test(String(error?.message || ""));
}

function createMissingStoreReviewsSchemaError() {
  const error = new Error(
    "O sistema de avaliacoes ainda nao esta preparado na base de dados. Executa a migracao de store reviews antes de usar esta funcionalidade.",
  );
  error.status = 503;
  error.code = "CATALOG_STORE_REVIEWS_SCHEMA_MISSING";
  return error;
}

function createStoreReviewFeatureLimitError(limit = STORE_REVIEW_FEATURED_LIMIT) {
  const error = new Error(`So podes fixar ate ${limit} testemunho(s) em destaque na vitrine.`);
  error.status = 400;
  error.code = "CATALOG_STORE_REVIEWS_FEATURED_LIMIT";
  return error;
}

function getPublicReviewOrderByClause(options = {}) {
  if (options.sortFeaturedFirst) {
    return `
      is_featured desc,
      case
        when is_featured then coalesce(featured_at, updated_at, created_at)
        else null
      end desc nulls last,
      coalesce(updated_at, created_at) desc,
      id desc
    `;
  }

  return "coalesce(updated_at, created_at) desc, id desc";
}

function getStoreReviewSummaryTestimonialFilterSql(options = {}) {
  if (options.publicOnly) {
    return "btrim(comment) <> ''";
  }

  return "is_public = true and btrim(comment) <> ''";
}

export async function hasStoreReviewsTable(queryable) {
  return hasTable(queryable, "catalog_store_reviews");
}

export function createStoreReviewId() {
  return randomUUID();
}

export function normalizeStoreReviewInput(payload = {}) {
  const trackingToken = cleanText(payload.trackingToken, 160);
  if (!trackingToken) {
    return { error: "O token de acompanhamento da encomenda e obrigatorio." };
  }

  const rating = normalizeStoreReviewRating(payload.rating, 0);
  if (!rating) {
    return { error: "Escolhe entre 1 e 5 estrelas para avaliar a loja." };
  }

  return {
    value: {
      trackingToken,
      rating,
      comment: normalizeStoreReviewComment(payload.comment),
    },
  };
}

export function normalizeStoreReviewFeatureInput(payload = {}) {
  const reviewId = cleanText(payload.reviewId, 160);
  if (!reviewId) {
    return { error: "A avaliacao que queres atualizar e obrigatoria." };
  }

  if (!Object.prototype.hasOwnProperty.call(payload, "featured")) {
    return { error: "Indica se queres fixar ou retirar este testemunho." };
  }

  return {
    value: {
      reviewId,
      featured: normalizeBoolean(payload.featured),
    },
  };
}

export function mapStoreReviewRow(row, prefix = "") {
  const id = row?.[`${prefix}id`] || "";
  if (!id) return null;

  const customerName = row?.[`${prefix}customer_name`] || "";
  const customerPhone = row?.[`${prefix}customer_phone`] || "";
  const review = {
    id,
    storeId: row?.[`${prefix}store_id`] || "",
    orderId: row?.[`${prefix}order_id`] || "",
    customerKey: row?.[`${prefix}customer_key`] || "",
    customerName,
    customerPhone: String(customerPhone || "").replace(/\D/g, "").slice(0, 32),
    customerLabel: buildStoreReviewCustomerLabel(customerName, customerPhone),
    rating: normalizeStoreReviewRating(row?.[`${prefix}rating`], 0),
    comment: normalizeStoreReviewComment(row?.[`${prefix}comment`]),
    isPublic: row?.[`${prefix}is_public`] !== false,
    isFeatured: normalizeBoolean(row?.[`${prefix}is_featured`]),
    featuredAt: row?.[`${prefix}featured_at`] || null,
    createdAt: row?.[`${prefix}created_at`] || null,
    updatedAt: row?.[`${prefix}updated_at`] || null,
  };

  return review;
}

export async function listStoreReviews(queryable, storeId, options = {}) {
  const normalizedStoreId = cleanText(storeId);
  if (!normalizedStoreId) return [];
  if (!(await hasStoreReviewsTable(queryable))) return [];

  const values = [normalizedStoreId];
  const filters = ["store_id = $1"];
  if (options.publicOnly) {
    filters.push("is_public = true");
  }
  if (options.withCommentOnly) {
    filters.push("btrim(comment) <> ''");
  }
  if (options.featuredOnly) {
    filters.push("is_featured = true");
  }
  if (options.excludeFeatured) {
    filters.push("(is_featured = false or is_featured is null)");
  }

  const limit = normalizePositiveInteger(options.limit, 0, 0, STORE_REVIEW_PAGE_MAX_LIMIT);
  const offset = normalizePositiveInteger(options.offset, 0, 0);
  let limitClause = "";
  let offsetClause = "";
  if (limit > 0) {
    values.push(limit);
    limitClause = `limit $${values.length}`;
  }
  if (offset > 0) {
    values.push(offset);
    offsetClause = `offset $${values.length}`;
  }

  let result;
  try {
    result = await queryable.query(
      `select
         ${STORE_REVIEW_SELECT_COLUMNS}
       from catalog_store_reviews
       where ${filters.join(" and ")}
       order by ${getPublicReviewOrderByClause(options)}
       ${limitClause}
       ${offsetClause}`,
      values,
    );
  } catch (error) {
    if (isMissingStoreReviewsRelationError(error)) {
      return [];
    }
    throw error;
  }

  return result.rows.map((row) => mapStoreReviewRow(row)).filter(Boolean);
}

export async function getOrderStoreReview(queryable, orderId) {
  const normalizedOrderId = cleanText(orderId);
  if (!normalizedOrderId) return null;
  if (!(await hasStoreReviewsTable(queryable))) return null;

  let result;
  try {
    result = await queryable.query(
      `select
         ${STORE_REVIEW_SELECT_COLUMNS}
       from catalog_store_reviews
       where order_id = $1
       limit 1`,
      [normalizedOrderId],
    );
  } catch (error) {
    if (isMissingStoreReviewsRelationError(error)) {
      return null;
    }
    throw error;
  }

  return mapStoreReviewRow(result.rows[0] || null);
}

export async function listStoreReviewsByOrderIds(queryable, orderIds = []) {
  const normalizedOrderIds = Array.isArray(orderIds)
    ? [...new Set(orderIds.map((value) => cleanText(value)).filter(Boolean))]
    : [];
  if (!normalizedOrderIds.length) {
    return [];
  }
  if (!(await hasStoreReviewsTable(queryable))) return [];

  try {
    const result = await queryable.query(
      `select
         ${STORE_REVIEW_SELECT_COLUMNS}
        from catalog_store_reviews
       where order_id = any($1::text[])`,
      [normalizedOrderIds],
    );

    return result.rows.map((row) => mapStoreReviewRow(row)).filter(Boolean);
  } catch (error) {
    if (isMissingStoreReviewsRelationError(error)) {
      return [];
    }
    throw error;
  }
}

export async function getStoreReviewSummary(queryable, storeId, options = {}) {
  const normalizedStoreId = cleanText(storeId);
  if (!normalizedStoreId) return createEmptyStoreReviewSummary();
  if (!(await hasStoreReviewsTable(queryable))) return createEmptyStoreReviewSummary();

  const values = [normalizedStoreId];
  const filters = ["store_id = $1"];
  if (options.publicOnly) {
    filters.push("is_public = true");
  }

  const testimonialFilterSql = getStoreReviewSummaryTestimonialFilterSql(options);
  try {
    const result = await queryable.query(
      `select
         coalesce(round(avg(rating)::numeric, 1), 0)::float8 as average_rating,
         count(*)::int as total_reviews,
         count(*) filter (where ${testimonialFilterSql})::int as testimonial_count,
         count(*) filter (where ${testimonialFilterSql} and is_featured = true)::int as featured_count,
         count(*) filter (where rating = 1)::int as dist_1,
         count(*) filter (where rating = 2)::int as dist_2,
         count(*) filter (where rating = 3)::int as dist_3,
         count(*) filter (where rating = 4)::int as dist_4,
         count(*) filter (where rating = 5)::int as dist_5
       from catalog_store_reviews
       where ${filters.join(" and ")}`,
      values,
    );
    const row = result.rows[0] || {};
    return {
      averageRating: Number(row.average_rating || 0),
      totalReviews: Math.max(0, Number(row.total_reviews || 0)),
      testimonialCount: Math.max(0, Number(row.testimonial_count || 0)),
      featuredCount: Math.max(0, Number(row.featured_count || 0)),
      distribution: {
        1: Math.max(0, Number(row.dist_1 || 0)),
        2: Math.max(0, Number(row.dist_2 || 0)),
        3: Math.max(0, Number(row.dist_3 || 0)),
        4: Math.max(0, Number(row.dist_4 || 0)),
        5: Math.max(0, Number(row.dist_5 || 0)),
      },
    };
  } catch (error) {
    if (isMissingStoreReviewsRelationError(error)) {
      return createEmptyStoreReviewSummary();
    }
    throw error;
  }
}

export async function getStoreReviewOverview(queryable, storeId, options = {}) {
  const reviewSummary = await getStoreReviewSummary(queryable, storeId, {
    publicOnly: options.publicOnly,
  });
  const attachedStore = attachStoreReviewDataToStore(
    {},
    await listStoreReviews(queryable, storeId, {
      publicOnly: options.publicOnly,
      withCommentOnly: true,
      sortFeaturedFirst: true,
      limit: options.testimonialLimit || options.limit || STORE_REVIEW_PAGE_LIMIT,
    }),
    {
      ...options,
      limit: options.testimonialLimit || options.limit,
    },
  );

  return {
    reviewSummary,
    testimonials: attachedStore.testimonials,
    featuredTestimonials: attachedStore.featuredTestimonials,
    recentTestimonials: attachedStore.recentTestimonials,
  };
}

export async function listPublicStoreReviewFeed(queryable, storeId, options = {}) {
  const limit = normalizePositiveInteger(options.limit, STORE_REVIEW_PAGE_LIMIT, 1, STORE_REVIEW_PAGE_MAX_LIMIT);
  const offset = normalizePositiveInteger(options.offset, 0, 0);
  const [reviewSummary, reviews] = await Promise.all([
    getStoreReviewSummary(queryable, storeId, { publicOnly: true }),
    listStoreReviews(queryable, storeId, {
      publicOnly: true,
      sortFeaturedFirst: true,
      limit,
      offset,
    }),
  ]);

  return {
    reviewSummary,
    reviews,
    pageInfo: {
      total: reviewSummary.totalReviews,
      limit,
      offset,
      hasMore: offset + reviews.length < reviewSummary.totalReviews,
      nextOffset: offset + reviews.length,
    },
  };
}

export async function countFeaturedStoreReviews(queryable, storeId, options = {}) {
  const normalizedStoreId = cleanText(storeId);
  if (!normalizedStoreId) return 0;
  if (!(await hasStoreReviewsTable(queryable))) return 0;

  const values = [normalizedStoreId];
  const filters = ["store_id = $1", "is_featured = true"];
  if (options.excludeReviewId) {
    values.push(cleanText(options.excludeReviewId));
    filters.push(`id <> $${values.length}`);
  }

  try {
    const result = await queryable.query(
      `select count(*)::int as total
       from catalog_store_reviews
       where ${filters.join(" and ")}`,
      values,
    );
    return Math.max(0, Number(result.rows[0]?.total || 0));
  } catch (error) {
    if (isMissingStoreReviewsRelationError(error)) {
      return 0;
    }
    throw error;
  }
}

export async function updateStoreReviewFeaturedState(queryable, storeId, reviewId, featured) {
  const normalizedStoreId = cleanText(storeId);
  const normalizedReviewId = cleanText(reviewId);
  if (!normalizedStoreId || !normalizedReviewId) {
    return null;
  }

  if (!(await hasStoreReviewsTable(queryable))) {
    throw createMissingStoreReviewsSchemaError();
  }

  const existingResult = await queryable.query(
    `select
       ${STORE_REVIEW_SELECT_COLUMNS}
     from catalog_store_reviews
     where id = $1
       and store_id = $2
     limit 1`,
    [normalizedReviewId, normalizedStoreId],
  );
  const existingReview = mapStoreReviewRow(existingResult.rows[0] || null);
  if (!existingReview) {
    const error = new Error("A avaliacao selecionada nao foi encontrada.");
    error.status = 404;
    error.code = "CATALOG_STORE_REVIEW_NOT_FOUND";
    throw error;
  }

  if (featured) {
    if (!existingReview.comment) {
      const error = new Error("So podes fixar testemunhos que tenham comentario escrito.");
      error.status = 400;
      error.code = "CATALOG_STORE_REVIEW_COMMENT_REQUIRED";
      throw error;
    }

    const featuredCount = await countFeaturedStoreReviews(queryable, normalizedStoreId, {
      excludeReviewId: normalizedReviewId,
    });
    if (!existingReview.isFeatured && featuredCount >= STORE_REVIEW_FEATURED_LIMIT) {
      throw createStoreReviewFeatureLimitError();
    }
  }

  const result = await queryable.query(
    `update catalog_store_reviews
        set is_featured = $3,
            featured_at = case
              when $3::boolean then coalesce(featured_at, now())
              else null
            end,
            updated_at = now()
      where id = $1
        and store_id = $2
    returning
      ${STORE_REVIEW_SELECT_COLUMNS}`,
    [normalizedReviewId, normalizedStoreId, featured],
  );

  return mapStoreReviewRow(result.rows[0] || null);
}

export async function attachPublicStoreReviews(queryable, store, storeId, options = {}) {
  const overview = await getStoreReviewOverview(queryable, storeId, {
    ...options,
    publicOnly: true,
  });
  return {
    ...store,
    ...overview,
  };
}

export async function refreshPublicStoreReviewSnapshot(queryable, storeId) {
  const normalizedStoreId = cleanText(storeId);
  if (!normalizedStoreId) return null;

  const [storeResult, productsResult] = await Promise.all([
    queryable.query(
      `select
         id,
         name,
         description,
         whatsapp,
         logo,
         color,
         pickup_note,
         city,
         country,
         currency_code,
         public_enabled,
         whatsapp_order_format,
         public_slug,
         custom_domain
       from catalog_stores
       where id = $1
       limit 1`,
      [normalizedStoreId],
    ),
    queryable.query(
      `select
         id,
         catalog_id,
         name,
         description,
         price,
         compare_at,
         image,
         images,
         category,
         stock,
         featured,
         on_promotion,
         available
       from catalog_products
       where catalog_id = $1
       order by category asc, name asc`,
      [normalizedStoreId],
    ),
  ]);

  const storeRow = storeResult.rows[0] || null;
  if (!storeRow) return null;

  const enrichedStore = await attachPublicStoreReviews(
    queryable,
    mapStore(storeRow),
    normalizedStoreId,
  );

  await upsertPublicCatalogSnapshot(queryable, {
    storeId: normalizedStoreId,
    store: enrichedStore,
    products: productsResult.rows.map(mapProduct),
  });

  return enrichedStore;
}

export {
  createMissingStoreReviewsSchemaError,
  createStoreReviewFeatureLimitError,
  isMissingStoreReviewsRelationError,
};
