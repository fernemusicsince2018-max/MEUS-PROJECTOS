import { getSessionContext } from "./_auth.js";
import { invalidatePublicCatalogCache } from "./_catalog-cache.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import {
  normalizeStoreReviewFeatureInput,
  refreshPublicStoreReviewSnapshot,
  updateStoreReviewFeaturedState,
} from "./_store-reviews.js";

async function handle(event) {
  try {
    const session = await getSessionContext(event);
    if (!session?.storeId || !session?.userId) {
      return jsonResponse(401, { error: "Precisas de iniciar sessao para gerir testemunhos da loja." });
    }

    await ensureDatabaseReady();
    const payload = JSON.parse(event.body || "{}");
    const normalized = normalizeStoreReviewFeatureInput(payload);
    if (normalized.error) {
      return jsonResponse(400, { error: normalized.error });
    }

    const pool = getPool();
    const connection = await pool.connect();
    try {
      await connection.query("begin");
      const review = await updateStoreReviewFeaturedState(
        connection,
        session.storeId,
        normalized.value.reviewId,
        normalized.value.featured,
      );
      const enrichedStore = await refreshPublicStoreReviewSnapshot(connection, session.storeId);
      await connection.query("commit");
      invalidatePublicCatalogCache(session.storeId);

      return jsonResponse(200, {
        ok: true,
        review,
        reviewsOverview: {
          reviewSummary: enrichedStore?.reviewSummary || null,
          testimonials: enrichedStore?.testimonials || [],
          featuredTestimonials: enrichedStore?.featuredTestimonials || [],
          recentTestimonials: enrichedStore?.recentTestimonials || [],
        },
      });
    } catch (error) {
      await connection.query("rollback");
      return jsonResponse(error.status || 500, { error: error.message || "Nao foi possivel atualizar este testemunho." });
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
