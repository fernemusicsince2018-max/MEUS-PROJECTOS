import { getSessionContext } from "./_auth.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import {
  getStoreReviewOverview,
  isMissingStoreReviewsRelationError,
  mapStoreReviewRow,
} from "./_store-reviews.js";
import {
  STORE_REVIEW_PAGE_LIMIT,
  STORE_REVIEW_PAGE_MAX_LIMIT,
} from "../../shared/storeReviews.js";

function normalizePositiveInteger(
  value,
  fallback,
  minimum = 0,
  maximum = Number.POSITIVE_INFINITY,
) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

function normalizeReviewPageLimit(value) {
  return normalizePositiveInteger(
    value,
    STORE_REVIEW_PAGE_LIMIT,
    1,
    STORE_REVIEW_PAGE_MAX_LIMIT,
  );
}

function normalizeReviewOffset(value) {
  return normalizePositiveInteger(value, 0, 0);
}

function normalizeMoneyValue(value) {
  if (value === "" || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function mapMerchantReviewRow(row) {
  const review = mapStoreReviewRow(row, "review_");
  if (!review) return null;

  return {
    ...review,
    trackingCode: row?.order_tracking_code || "",
    totalAmount: normalizeMoneyValue(row?.order_total_amount),
    currencyCode: row?.order_currency_code || "AOA",
    orderCreatedAt: row?.order_created_at || null,
    orderStatus: row?.order_status || "",
  };
}

async function handle(event) {
  try {
    const session = await getSessionContext(event);
    if (!session?.storeId || !session?.userId) {
      return jsonResponse(401, { error: "Precisas de iniciar sessao para consultar as avaliacoes." });
    }

    await ensureDatabaseReady();
    const pool = getPool();
    const limit = normalizeReviewPageLimit(event.queryStringParameters?.limit);
    const offset = normalizeReviewOffset(event.queryStringParameters?.offset);
    const reviewsOverview = await getStoreReviewOverview(pool, session.storeId, {
      publicOnly: true,
    });

    try {
      const [countResult, reviewsResult] = await Promise.all([
        pool.query(
          `select count(*)::int as total
             from catalog_store_reviews
            where store_id = $1`,
          [session.storeId],
        ),
        pool.query(
          `select
             reviews.id as review_id,
             reviews.store_id as review_store_id,
             reviews.order_id as review_order_id,
             coalesce(reviews.customer_key, orders.customer_key, '') as review_customer_key,
             coalesce(reviews.customer_name, orders.customer_name, '') as review_customer_name,
             coalesce(reviews.customer_phone, orders.customer_phone, '') as review_customer_phone,
             reviews.rating as review_rating,
             reviews.comment as review_comment,
             reviews.is_public as review_is_public,
             reviews.is_featured as review_is_featured,
             reviews.featured_at as review_featured_at,
             reviews.created_at as review_created_at,
             reviews.updated_at as review_updated_at,
             orders.tracking_code as order_tracking_code,
             orders.total_amount as order_total_amount,
             orders.currency_code as order_currency_code,
             orders.created_at as order_created_at,
             orders.status as order_status
            from catalog_store_reviews reviews
            left join catalog_orders orders
              on orders.id = reviews.order_id
             and orders.store_id = reviews.store_id
           where reviews.store_id = $1
           order by coalesce(reviews.updated_at, reviews.created_at) desc, reviews.id desc
           limit $2
          offset $3`,
          [session.storeId, limit, offset],
        ),
      ]);

      const total = Math.max(0, Number(countResult.rows[0]?.total || 0));
      const reviews = reviewsResult.rows
        .map(mapMerchantReviewRow)
        .filter((review) => review?.id && review.rating > 0);

      return jsonResponse(200, {
        ok: true,
        reviews,
        pageInfo: {
          total,
          limit,
          offset,
          hasMore: offset + reviews.length < total,
          nextOffset: offset + reviews.length,
        },
        reviewsOverview,
      });
    } catch (error) {
      if (isMissingStoreReviewsRelationError(error)) {
        return jsonResponse(200, {
          ok: true,
          reviews: [],
          pageInfo: {
            total: 0,
            limit,
            offset,
            hasMore: false,
            nextOffset: offset,
          },
          reviewsOverview,
        });
      }

      throw error;
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["GET"] });
