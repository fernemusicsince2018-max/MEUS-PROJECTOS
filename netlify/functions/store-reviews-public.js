import { getPlanAccessState } from "./_auth.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import {
  STORE_REVIEW_PAGE_LIMIT,
  STORE_REVIEW_PAGE_MAX_LIMIT,
} from "../../shared/storeReviews.js";
import { listPublicStoreReviewFeed } from "./_store-reviews.js";

function cleanText(value, maxLength = null) {
  const text = String(value ?? "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function normalizePositiveInteger(value, fallback, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const storeId = cleanText(
      event.queryStringParameters?.storeId || event.queryStringParameters?.id,
      160,
    );
    if (!storeId) {
      return jsonResponse(400, { error: "A loja das avaliacoes e obrigatoria." });
    }

    const limit = normalizePositiveInteger(
      event.queryStringParameters?.limit,
      STORE_REVIEW_PAGE_LIMIT,
      1,
      STORE_REVIEW_PAGE_MAX_LIMIT,
    );
    const offset = normalizePositiveInteger(event.queryStringParameters?.offset, 0, 0);
    const pool = getPool();
    const storeResult = await pool.query(
      `select
         id,
         public_enabled,
         plan_status,
         plan_expires_at,
         deleted_at
       from catalog_stores
       where id = $1
       limit 1`,
      [storeId],
    );

    const store = storeResult.rows[0] || null;
    if (!store || store.deleted_at || !store.public_enabled) {
      return jsonResponse(404, { error: "Loja nao encontrada." });
    }

    const planAccess = getPlanAccessState(store.plan_status, store.plan_expires_at);
    if (!planAccess.allowed) {
      return jsonResponse(403, {
        error: planAccess.message || "As avaliacoes desta loja estao temporariamente indisponiveis.",
      });
    }

    const response = await listPublicStoreReviewFeed(pool, storeId, {
      limit,
      offset,
    });

    return jsonResponse(200, {
      ok: true,
      storeId,
      reviewSummary: response.reviewSummary,
      reviews: response.reviews,
      pageInfo: response.pageInfo,
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["GET"] });
