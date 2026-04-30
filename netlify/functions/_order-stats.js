const ORDER_STATUS_COLUMNS = Object.freeze({
  pending: "pending_count",
  in_progress: "in_progress_count",
  on_the_way: "on_the_way_count",
  delivered: "delivered_count",
});

function cleanText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeOrderStatus(value) {
  const normalized = cleanText(value, 24).toLowerCase();
  return Object.prototype.hasOwnProperty.call(ORDER_STATUS_COLUMNS, normalized)
    ? normalized
    : "";
}

function createEmptyOrderStats(storeId = "") {
  return {
    storeId: cleanText(storeId),
    totalCount: 0,
    statusCounts: {
      pending: 0,
      inProgress: 0,
      onTheWay: 0,
      delivered: 0,
    },
    updatedAt: null,
  };
}

function buildOrderStatsDelta(previousStatus, nextStatus, options = {}) {
  const normalizedPrevious = normalizeOrderStatus(previousStatus);
  const normalizedNext = normalizeOrderStatus(nextStatus);
  const includeNewOrder = Boolean(options.includeNewOrder);

  return {
    totalCount: includeNewOrder ? 1 : 0,
    pendingCount:
      (normalizedNext === "pending" ? 1 : 0)
      - (normalizedPrevious === "pending" ? 1 : 0),
    inProgressCount:
      (normalizedNext === "in_progress" ? 1 : 0)
      - (normalizedPrevious === "in_progress" ? 1 : 0),
    onTheWayCount:
      (normalizedNext === "on_the_way" ? 1 : 0)
      - (normalizedPrevious === "on_the_way" ? 1 : 0),
    deliveredCount:
      (normalizedNext === "delivered" ? 1 : 0)
      - (normalizedPrevious === "delivered" ? 1 : 0),
  };
}

async function applyOrderStatsDelta(queryable, storeId, delta = {}) {
  const normalizedStoreId = cleanText(storeId);
  if (!normalizedStoreId) return;

  await queryable.query(
    `insert into catalog_order_stats (
       store_id,
       total_count,
       pending_count,
       in_progress_count,
       on_the_way_count,
       delivered_count
     ) values ($1, $2, $3, $4, $5, $6)
     on conflict (store_id) do update set
       total_count = greatest(0, catalog_order_stats.total_count + excluded.total_count),
       pending_count = greatest(0, catalog_order_stats.pending_count + excluded.pending_count),
       in_progress_count = greatest(0, catalog_order_stats.in_progress_count + excluded.in_progress_count),
       on_the_way_count = greatest(0, catalog_order_stats.on_the_way_count + excluded.on_the_way_count),
       delivered_count = greatest(0, catalog_order_stats.delivered_count + excluded.delivered_count),
       updated_at = now()`,
    [
      normalizedStoreId,
      Number(delta.totalCount || 0),
      Number(delta.pendingCount || 0),
      Number(delta.inProgressCount || 0),
      Number(delta.onTheWayCount || 0),
      Number(delta.deliveredCount || 0),
    ],
  );
}

async function registerNewOrderStats(queryable, storeId, status) {
  return applyOrderStatsDelta(
    queryable,
    storeId,
    buildOrderStatsDelta("", status, { includeNewOrder: true }),
  );
}

async function registerOrderStatusTransition(queryable, storeId, previousStatus, nextStatus) {
  if (normalizeOrderStatus(previousStatus) === normalizeOrderStatus(nextStatus)) {
    return;
  }

  return applyOrderStatsDelta(
    queryable,
    storeId,
    buildOrderStatsDelta(previousStatus, nextStatus),
  );
}

function mapOrderStatsRow(row, storeId = "") {
  if (!row) return createEmptyOrderStats(storeId);

  return {
    storeId: cleanText(row.store_id || storeId),
    totalCount: Number(row.total_count || 0),
    statusCounts: {
      pending: Number(row.pending_count || 0),
      inProgress: Number(row.in_progress_count || 0),
      onTheWay: Number(row.on_the_way_count || 0),
      delivered: Number(row.delivered_count || 0),
    },
    updatedAt: row.updated_at || null,
  };
}

async function getOrderStats(queryable, storeId) {
  const normalizedStoreId = cleanText(storeId);
  if (!normalizedStoreId) return createEmptyOrderStats();

  const result = await queryable.query(
    `select
       store_id,
       total_count,
       pending_count,
       in_progress_count,
       on_the_way_count,
       delivered_count,
       updated_at
      from catalog_order_stats
      where store_id = $1
      limit 1`,
    [normalizedStoreId],
  );

  return mapOrderStatsRow(result.rows[0] || null, normalizedStoreId);
}

export {
  applyOrderStatsDelta,
  buildOrderStatsDelta,
  createEmptyOrderStats,
  getOrderStats,
  mapOrderStatsRow,
  registerNewOrderStats,
  registerOrderStatusTransition,
};
