import { invalidatePublicCatalogCache } from "./_catalog-cache.js";
import { cleanText, mapOrder, mapOrderItem, mapOrderStore, normalizeCustomerPhone } from "./_orders.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import {
  createMissingStoreReviewsSchemaError,
  createStoreReviewId,
  getOrderStoreReview,
  hasStoreReviewsTable,
  isMissingStoreReviewsRelationError,
  mapStoreReviewRow,
  normalizeStoreReviewInput,
  refreshPublicStoreReviewSnapshot,
} from "./_store-reviews.js";
import { getOrderReviewEligibility } from "../../shared/orderReviewEligibility.js";

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const payload = JSON.parse(event.body || "{}");
    const normalizedResult = normalizeStoreReviewInput(payload);
    if (normalizedResult.error) {
      return jsonResponse(400, { error: normalizedResult.error });
    }

    const { trackingToken, rating, comment } = normalizedResult.value;
    const pool = getPool();
    const connection = await pool.connect();

    try {
      await connection.query("begin");

      const orderResult = await connection.query(
        `select
           orders.*,
           stores.id as store_public_id,
           stores.name,
           stores.description,
           stores.logo,
           stores.color,
           stores.whatsapp,
           stores.pickup_note,
           stores.city,
           stores.country,
           stores.currency_code,
           stores.public_enabled,
           stores.whatsapp_order_format,
           stores.public_slug,
           stores.custom_domain,
           stores.deleted_at
         from catalog_orders orders
         join catalog_stores stores on stores.id = orders.store_id
         where orders.tracking_token = $1
         limit 1`,
        [trackingToken],
      );

      const orderRow = orderResult.rows[0];
      if (!orderRow || orderRow.deleted_at) {
        await connection.query("rollback");
        return jsonResponse(404, { error: "Encomenda nao encontrada." });
      }

      const reviewEligibility = getOrderReviewEligibility(orderRow.status);
      if (!reviewEligibility.eligible) {
        await connection.query("rollback");
        return jsonResponse(409, { error: reviewEligibility.reason });
      }

      if (!(await hasStoreReviewsTable(connection))) {
        throw createMissingStoreReviewsSchemaError();
      }

      const existingReview = await getOrderStoreReview(connection, orderRow.id);
      let reviewResult;
      try {
        reviewResult = await connection.query(
          `insert into catalog_store_reviews (
             id,
             store_id,
             order_id,
             customer_key,
             customer_name,
             customer_phone,
             rating,
             comment,
             is_public
           ) values ($1, $2, $3, $4, $5, $6, $7, $8, true)
           on conflict (order_id) do update set
             customer_key = excluded.customer_key,
             customer_name = excluded.customer_name,
             customer_phone = excluded.customer_phone,
             rating = excluded.rating,
             comment = excluded.comment,
             is_public = excluded.is_public,
             updated_at = now()
           returning
             id,
             store_id,
             order_id,
             customer_key,
             customer_name,
             customer_phone,
             rating,
             comment,
             is_public,
             created_at,
             updated_at`,
          [
            existingReview?.id || createStoreReviewId(),
            orderRow.store_id,
            orderRow.id,
            cleanText(orderRow.customer_key) || normalizeCustomerPhone(orderRow.customer_phone),
            cleanText(orderRow.customer_name, 160),
            normalizeCustomerPhone(orderRow.customer_phone),
            rating,
            comment,
          ],
        );
      } catch (error) {
        if (isMissingStoreReviewsRelationError(error)) {
          throw createMissingStoreReviewsSchemaError();
        }
        throw error;
      }

      const review = mapStoreReviewRow(reviewResult.rows[0] || null);
      const itemsResult = await connection.query(
        `select
           id,
           order_id,
           product_id,
           product_name,
           product_image,
           unit_price,
           quantity,
           line_total,
           created_at
         from catalog_order_items
         where order_id = $1
         order by created_at asc`,
        [orderRow.id],
      );

      await refreshPublicStoreReviewSnapshot(connection, orderRow.store_id);

      await connection.query("commit");
      invalidatePublicCatalogCache(orderRow.store_id);

      return jsonResponse(200, {
        ok: true,
        review,
        order: mapOrder(orderRow, {
          items: itemsResult.rows.map(mapOrderItem),
          store: mapOrderStore(orderRow),
          review,
        }),
      });
    } catch (error) {
      await connection.query("rollback");
      return jsonResponse(error.status || 500, { error: error.message || "Nao foi possivel guardar a avaliacao." });
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
