import { getSessionContext } from "./_auth.js";
import {
  getMerchantOrderMetricsWindow,
  listOrderMetricBuckets,
} from "./_order-metrics.js";
import { getOrderStats } from "./_order-stats.js";
import { mapCustomerProfileRow, mapOrder, mapOrderItem } from "./_orders.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import { getStoreReviewOverview, listStoreReviewsByOrderIds } from "./_store-reviews.js";
import { buildMerchantOrderSummaryFromMetricsBuckets } from "../../shared/orderAnalytics.js";
import {
  buildEmptyMerchantOrdersPageInfo,
  buildMerchantOrdersPage,
  decodeMerchantOrdersCursor,
  normalizeMerchantOrdersPageLimit,
} from "../../shared/merchantOrdersPagination.js";

const SUMMARY_WINDOW_DAYS = 7;

function addParam(values, value) {
  values.push(value);
  return `$${values.length}`;
}

function normalizeTimezoneOffsetMinutes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(14 * 60, Math.max(-14 * 60, Math.round(numeric)));
}

function appendCursorFilter(values, cursor) {
  const parsed = decodeMerchantOrdersCursor(cursor);
  if (!parsed?.createdAt || !parsed?.id) return "";

  const createdAtPlaceholder = addParam(values, parsed.createdAt);
  const idPlaceholder = addParam(values, parsed.id);
  return `and (orders.created_at, orders.id) < (${createdAtPlaceholder}::timestamptz, ${idPlaceholder})`;
}

async function fetchMerchantOrdersSummary(pool, storeId, timezoneOffsetMinutes, referenceNow = new Date()) {
  const metricsWindow = getMerchantOrderMetricsWindow({
    referenceNow,
    timezoneOffsetMinutes,
    windowDays: SUMMARY_WINDOW_DAYS,
  });

  const [orderStats, metricBuckets] = await Promise.all([
    getOrderStats(pool, storeId),
    listOrderMetricBuckets(pool, {
      storeId,
      startAt: metricsWindow.startAt,
      endAt: metricsWindow.endAt,
    }),
  ]);

  return buildMerchantOrderSummaryFromMetricsBuckets(
    metricBuckets,
    {
      timezoneOffsetMinutes,
      referenceNow,
      windowDays: SUMMARY_WINDOW_DAYS,
      totalCount: orderStats.totalCount,
      statusCounts: orderStats.statusCounts,
    },
  );
}

async function handle(event) {
  try {
    const session = await getSessionContext(event);
    if (!session?.storeId || !session?.userId) {
      return jsonResponse(401, { error: "Precisas de iniciar sessao para consultar as encomendas." });
    }

    await ensureDatabaseReady();
    const pool = getPool();
    const limit = normalizeMerchantOrdersPageLimit(event.queryStringParameters?.limit);
    const timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(
      event.queryStringParameters?.tzOffsetMinutes,
    );
    const referenceNow = new Date();
    const listValues = [session.storeId];
    const cursorFilter = appendCursorFilter(listValues, event.queryStringParameters?.cursor);
    const limitPlaceholder = addParam(listValues, limit + 1);

    const [ordersResult, summary, reviewsOverview] = await Promise.all([
      pool.query(
        `select
           orders.*,
           customers.id as customer_profile_id,
           customers.customer_key as customer_profile_key,
           customers.customer_name as customer_profile_name,
           customers.customer_phone as customer_profile_phone,
           customers.loyalty_discount_percent as customer_profile_discount_percent,
           customers.order_count as customer_profile_order_count,
           customers.last_order_id as customer_profile_last_order_id,
           customers.last_order_at as customer_profile_last_order_at,
           customers.created_at as customer_created_at,
           customers.updated_at as customer_updated_at
          from catalog_orders orders
          left join catalog_order_customers customers
            on customers.store_id = orders.store_id
           and customers.customer_key = orders.customer_key
          where orders.store_id = $1
            ${cursorFilter}
          order by orders.created_at desc, orders.id desc
          limit ${limitPlaceholder}`,
        listValues,
      ),
      fetchMerchantOrdersSummary(pool, session.storeId, timezoneOffsetMinutes, referenceNow),
      getStoreReviewOverview(pool, session.storeId, { publicOnly: true }),
    ]);

    const page = buildMerchantOrdersPage(
      ordersResult.rows,
      limit,
      summary?.totalCount || 0,
    );
    const visibleRows = page.rows;
    const pageInfo = page.pageInfo || buildEmptyMerchantOrdersPageInfo(limit);
    const orderIds = visibleRows.map((order) => order.id);
    const [itemsResult, reviews] = orderIds.length
      ? await Promise.all([
        pool.query(
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
           where order_id = any($1::text[])
           order by created_at asc`,
          [orderIds],
        ),
        listStoreReviewsByOrderIds(pool, orderIds),
      ])
      : [{ rows: [] }, []];

    const itemsByOrderId = itemsResult.rows.reduce((accumulator, row) => {
      const list = accumulator.get(row.order_id) || [];
      list.push(mapOrderItem(row));
      accumulator.set(row.order_id, list);
      return accumulator;
    }, new Map());
    const reviewsByOrderId = reviews.reduce((accumulator, review) => {
      if (review?.orderId) {
        accumulator.set(review.orderId, review);
      }
      return accumulator;
    }, new Map());
    const orders = visibleRows.map((row) =>
      mapOrder(row, {
        items: itemsByOrderId.get(row.id) || [],
        customer: mapCustomerProfileRow(row),
        review: reviewsByOrderId.get(row.id) || null,
      }),
    );

    return jsonResponse(200, {
      ok: true,
      orders,
      summary,
      pageInfo,
      reviewsOverview,
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["GET"] });
