import assert from "node:assert/strict";
import {
  buildOrderStatsDelta,
  createEmptyOrderStats,
} from "../netlify/functions/_order-stats.js";

export async function runOrderStatsTests() {
  assert.deepEqual(createEmptyOrderStats("store-1"), {
    storeId: "store-1",
    totalCount: 0,
    statusCounts: {
      pending: 0,
      inProgress: 0,
      onTheWay: 0,
      delivered: 0,
    },
    updatedAt: null,
  });

  assert.deepEqual(
    buildOrderStatsDelta("", "pending", { includeNewOrder: true }),
    {
      totalCount: 1,
      pendingCount: 1,
      inProgressCount: 0,
      onTheWayCount: 0,
      deliveredCount: 0,
    },
  );

  assert.deepEqual(
    buildOrderStatsDelta("pending", "in_progress"),
    {
      totalCount: 0,
      pendingCount: -1,
      inProgressCount: 1,
      onTheWayCount: 0,
      deliveredCount: 0,
    },
  );

  assert.deepEqual(
    buildOrderStatsDelta("on_the_way", "delivered"),
    {
      totalCount: 0,
      pendingCount: 0,
      inProgressCount: 0,
      onTheWayCount: -1,
      deliveredCount: 1,
    },
  );
}
