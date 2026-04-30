import assert from "node:assert/strict";
import {
  EMPTY_MERCHANT_ORDERS_PAGE_INFO,
  buildEmptyMerchantOrdersPageInfo,
  buildMerchantOrdersPage,
  decodeMerchantOrdersCursor,
  encodeMerchantOrdersCursor,
  isMerchantOrderBeforeCursor,
  normalizeMerchantOrdersPageLimit,
} from "../shared/merchantOrdersPagination.js";

export async function runMerchantOrdersPaginationTests() {
  assert.equal(EMPTY_MERCHANT_ORDERS_PAGE_INFO.limit, 20);
  assert.equal(normalizeMerchantOrdersPageLimit(5), 5);
  assert.equal(normalizeMerchantOrdersPageLimit(999), 100);
  assert.equal(normalizeMerchantOrdersPageLimit("abc"), 20);

  const firstOrder = {
    id: "ord-003",
    createdAt: "2026-04-03T10:00:00.000Z",
  };
  const secondOrder = {
    id: "ord-002",
    createdAt: "2026-04-02T10:00:00.000Z",
  };
  const thirdOrder = {
    id: "ord-001",
    createdAt: "2026-04-01T10:00:00.000Z",
  };

  const cursor = encodeMerchantOrdersCursor(secondOrder);
  assert.equal(Boolean(cursor), true);
  assert.deepEqual(decodeMerchantOrdersCursor(cursor), {
    id: secondOrder.id,
    createdAt: secondOrder.createdAt,
  });

  const paged = buildMerchantOrdersPage([firstOrder, secondOrder, thirdOrder], 2, 3);
  assert.equal(paged.rows.length, 2);
  assert.equal(paged.pageInfo.total, 3);
  assert.equal(paged.pageInfo.hasMore, true);
  assert.equal(Boolean(paged.pageInfo.endCursor), true);

  const decodedPageCursor = decodeMerchantOrdersCursor(paged.pageInfo.endCursor);
  assert.deepEqual(decodedPageCursor, {
    id: secondOrder.id,
    createdAt: secondOrder.createdAt,
  });

  assert.equal(isMerchantOrderBeforeCursor(thirdOrder, paged.pageInfo.endCursor), true);
  assert.equal(isMerchantOrderBeforeCursor(firstOrder, paged.pageInfo.endCursor), false);

  const emptyPageInfo = buildEmptyMerchantOrdersPageInfo(999);
  assert.equal(emptyPageInfo.limit, 100);
  assert.equal(emptyPageInfo.total, 0);
  assert.equal(emptyPageInfo.hasMore, false);
}
