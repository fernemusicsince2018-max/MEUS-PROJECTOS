import assert from "node:assert/strict";
import {
  buildNewOrderMetricsDelta,
  buildOrderMetricsStatusTransitionDelta,
  getMerchantOrderMetricsWindow,
  getOrderMetricsBucketStart,
} from "../netlify/functions/_order-metrics.js";
import { buildMerchantOrderSummaryFromMetricsBuckets } from "../shared/orderAnalytics.js";

export async function runOrderMetricsTests() {
  assert.equal(
    getOrderMetricsBucketStart("2026-05-10T10:37:22.000Z"),
    "2026-05-10T10:00:00.000Z",
  );

  assert.deepEqual(
    buildNewOrderMetricsDelta("pending", 42.5),
    {
      orderCount: 1,
      revenueTotal: 42.5,
      deliveredCount: 0,
      deliveredRevenueTotal: 0,
    },
  );

  assert.deepEqual(
    buildOrderMetricsStatusTransitionDelta("pending", "delivered", 42.5),
    {
      orderCount: 0,
      revenueTotal: 0,
      deliveredCount: 1,
      deliveredRevenueTotal: 42.5,
    },
  );

  assert.deepEqual(
    buildOrderMetricsStatusTransitionDelta("delivered", "in_progress", 42.5),
    {
      orderCount: 0,
      revenueTotal: 0,
      deliveredCount: -1,
      deliveredRevenueTotal: -42.5,
    },
  );

  const window = getMerchantOrderMetricsWindow({
    referenceNow: "2026-05-10T12:00:00.000Z",
    timezoneOffsetMinutes: 0,
    windowDays: 7,
  });
  assert.equal(window.startAt, "2026-04-27T00:00:00.000Z");
  assert.equal(window.endAt, "2026-05-11T00:00:00.000Z");

  const summary = buildMerchantOrderSummaryFromMetricsBuckets(
    [
      {
        bucketStart: "2026-05-10T09:00:00.000Z",
        orderCount: 2,
        revenueTotal: 100,
        deliveredCount: 1,
        deliveredRevenueTotal: 40,
      },
      {
        bucketStart: "2026-05-04T10:00:00.000Z",
        orderCount: 1,
        revenueTotal: 50,
        deliveredCount: 0,
        deliveredRevenueTotal: 0,
      },
      {
        bucketStart: "2026-05-01T08:00:00.000Z",
        orderCount: 2,
        revenueTotal: 80,
        deliveredCount: 1,
        deliveredRevenueTotal: 30,
      },
    ],
    {
      referenceNow: "2026-05-10T12:00:00.000Z",
      timezoneOffsetMinutes: 0,
      windowDays: 7,
      totalCount: 12,
      statusCounts: {
        pending: 4,
        inProgress: 3,
        onTheWay: 2,
        delivered: 3,
      },
    },
  );

  assert.equal(summary.totalCount, 12);
  assert.deepEqual(summary.statusCounts, {
    pending: 4,
    inProgress: 3,
    onTheWay: 2,
    delivered: 3,
  });
  assert.deepEqual(summary.today, {
    count: 2,
    revenue: 100,
    deliveredCount: 1,
  });
  assert.equal(summary.historical.count, 10);
  assert.equal(summary.growth.mode, "value");
  assert.equal(summary.growth.currentWindowRevenue, 150);
  assert.equal(summary.growth.previousWindowRevenue, 80);
  assert.equal(summary.growth.percentage, 87.5);
  assert.equal(summary.revenueSeries.length, 7);
  assert.equal(summary.revenueSeries.at(-1)?.key, "2026-05-10");
  assert.equal(summary.revenueSeries.at(-1)?.total, 100);
}
