const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 7;
const HOUR_MS = 60 * 60 * 1000;

function cleanText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function roundMoney(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function normalizeOrderStatus(value) {
  return cleanText(value, 24).toLowerCase();
}

function isDeliveredStatus(value) {
  return normalizeOrderStatus(value) === "delivered";
}

function toTimestamp(value) {
  if (value == null || value === "") return Number.NaN;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
}

function normalizeTimezoneOffsetMinutes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(14 * 60, Math.max(-14 * 60, Math.round(numeric)));
}

function normalizeWindowDays(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return DEFAULT_WINDOW_DAYS;
  return Math.min(31, Math.max(1, Math.round(numeric)));
}

function shiftTimestampToLocalSpace(timestamp, timezoneOffsetMinutes) {
  return timestamp - timezoneOffsetMinutes * 60 * 1000;
}

function startOfLocalDayTimestamp(reference, timezoneOffsetMinutes) {
  const timestamp = toTimestamp(reference);
  if (!Number.isFinite(timestamp)) return Number.NaN;
  const shiftedDate = new Date(
    shiftTimestampToLocalSpace(timestamp, timezoneOffsetMinutes),
  );
  shiftedDate.setUTCHours(0, 0, 0, 0);
  return shiftedDate.getTime() + timezoneOffsetMinutes * 60 * 1000;
}

function getOrderMetricsBucketStart(value) {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) return "";
  const bucketTimestamp = Math.floor(timestamp / HOUR_MS) * HOUR_MS;
  return new Date(bucketTimestamp).toISOString();
}

function createEmptyOrderMetricsDelta() {
  return {
    orderCount: 0,
    revenueTotal: 0,
    deliveredCount: 0,
    deliveredRevenueTotal: 0,
  };
}

function buildOrderMetricsDelta(delta = {}) {
  return {
    orderCount: Math.max(0, Math.floor(Number(delta.orderCount || 0))),
    revenueTotal: roundMoney(delta.revenueTotal || 0),
    deliveredCount: Number.isFinite(Number(delta.deliveredCount))
      ? Math.trunc(Number(delta.deliveredCount))
      : 0,
    deliveredRevenueTotal: roundMoney(delta.deliveredRevenueTotal || 0),
  };
}

function buildNewOrderMetricsDelta(status, totalAmount) {
  const delta = createEmptyOrderMetricsDelta();
  delta.orderCount = 1;
  delta.revenueTotal = roundMoney(totalAmount || 0);

  if (isDeliveredStatus(status)) {
    delta.deliveredCount = 1;
    delta.deliveredRevenueTotal = roundMoney(totalAmount || 0);
  }

  return buildOrderMetricsDelta(delta);
}

function buildOrderMetricsStatusTransitionDelta(previousStatus, nextStatus, totalAmount) {
  const wasDelivered = isDeliveredStatus(previousStatus);
  const isDelivered = isDeliveredStatus(nextStatus);
  if (wasDelivered === isDelivered) {
    return createEmptyOrderMetricsDelta();
  }

  return buildOrderMetricsDelta({
    deliveredCount: isDelivered ? 1 : -1,
    deliveredRevenueTotal: isDelivered
      ? roundMoney(totalAmount || 0)
      : roundMoney(-(Number(totalAmount || 0))),
  });
}

async function applyOrderMetricsDelta(queryable, options = {}) {
  const storeId = cleanText(options.storeId);
  const bucketStart = getOrderMetricsBucketStart(options.bucketStart || options.createdAt);
  const delta = buildOrderMetricsDelta(options.delta);

  if (!storeId || !bucketStart) return;
  if (
    delta.orderCount === 0
    && delta.revenueTotal === 0
    && delta.deliveredCount === 0
    && delta.deliveredRevenueTotal === 0
  ) {
    return;
  }

  await queryable.query(
    `insert into catalog_order_metrics_hourly (
       store_id,
       bucket_hour,
       order_count,
       revenue_total,
       delivered_count,
       delivered_revenue_total
     ) values ($1, $2::timestamptz, $3, $4, $5, $6)
     on conflict (store_id, bucket_hour) do update set
       order_count = greatest(0, catalog_order_metrics_hourly.order_count + excluded.order_count),
       revenue_total = greatest(0, catalog_order_metrics_hourly.revenue_total + excluded.revenue_total),
       delivered_count = greatest(0, catalog_order_metrics_hourly.delivered_count + excluded.delivered_count),
       delivered_revenue_total = greatest(0, catalog_order_metrics_hourly.delivered_revenue_total + excluded.delivered_revenue_total),
       updated_at = now()`,
    [
      storeId,
      bucketStart,
      delta.orderCount,
      delta.revenueTotal,
      delta.deliveredCount,
      delta.deliveredRevenueTotal,
    ],
  );
}

async function registerNewOrderMetrics(queryable, options = {}) {
  return applyOrderMetricsDelta(queryable, {
    storeId: options.storeId,
    createdAt: options.createdAt,
    delta: buildNewOrderMetricsDelta(options.status, options.totalAmount),
  });
}

async function registerOrderMetricsStatusTransition(queryable, options = {}) {
  return applyOrderMetricsDelta(queryable, {
    storeId: options.storeId,
    createdAt: options.createdAt,
    delta: buildOrderMetricsStatusTransitionDelta(
      options.previousStatus,
      options.nextStatus,
      options.totalAmount,
    ),
  });
}

function getMerchantOrderMetricsWindow(options = {}) {
  const timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(
    options.timezoneOffsetMinutes,
  );
  const windowDays = normalizeWindowDays(options.windowDays);
  const referenceTimestamp = Number.isFinite(toTimestamp(options.referenceNow))
    ? toTimestamp(options.referenceNow)
    : Date.now();
  const currentDayStart = startOfLocalDayTimestamp(
    referenceTimestamp,
    timezoneOffsetMinutes,
  );
  const previousWindowStart =
    currentDayStart - (windowDays * 2 - 1) * DAY_MS;
  const currentWindowEnd = currentDayStart + DAY_MS;

  return {
    timezoneOffsetMinutes,
    windowDays,
    referenceTimestamp,
    startAt: new Date(previousWindowStart).toISOString(),
    endAt: new Date(currentWindowEnd).toISOString(),
  };
}

async function listOrderMetricBuckets(queryable, options = {}) {
  const storeId = cleanText(options.storeId);
  const startAt = cleanText(options.startAt);
  const endAt = cleanText(options.endAt);
  if (!storeId || !startAt || !endAt) {
    return [];
  }

  const result = await queryable.query(
    `select
       bucket_hour,
       order_count,
       revenue_total,
       delivered_count,
       delivered_revenue_total
      from catalog_order_metrics_hourly
      where store_id = $1
        and bucket_hour >= $2::timestamptz
        and bucket_hour < $3::timestamptz
      order by bucket_hour asc`,
    [storeId, startAt, endAt],
  );

  return result.rows;
}

export {
  applyOrderMetricsDelta,
  buildNewOrderMetricsDelta,
  buildOrderMetricsStatusTransitionDelta,
  createEmptyOrderMetricsDelta,
  getMerchantOrderMetricsWindow,
  getOrderMetricsBucketStart,
  listOrderMetricBuckets,
  registerNewOrderMetrics,
  registerOrderMetricsStatusTransition,
};
