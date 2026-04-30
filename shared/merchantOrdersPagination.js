const DEFAULT_MERCHANT_ORDERS_PAGE_SIZE = 20;
const MAX_MERCHANT_ORDERS_PAGE_SIZE = 100;

const EMPTY_MERCHANT_ORDERS_PAGE_INFO = Object.freeze({
  total: 0,
  limit: DEFAULT_MERCHANT_ORDERS_PAGE_SIZE,
  hasMore: false,
  endCursor: "",
});

function normalizeMerchantOrdersPageLimit(value, fallback = DEFAULT_MERCHANT_ORDERS_PAGE_SIZE) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return fallback;
  }

  return Math.min(MAX_MERCHANT_ORDERS_PAGE_SIZE, numeric);
}

function encodeBase64Url(value) {
  const text = String(value || "");
  if (!text) return "";

  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64url");
  }

  if (typeof btoa === "function") {
    return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  return "";
}

function decodeBase64Url(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  if (typeof Buffer !== "undefined") {
    try {
      return Buffer.from(normalized, "base64url").toString("utf8");
    } catch (error) {
      return "";
    }
  }

  if (typeof atob === "function") {
    try {
      const padded = normalized.replace(/-/g, "+").replace(/_/g, "/");
      const remainder = padded.length % 4;
      const finalValue = remainder ? `${padded}${"=".repeat(4 - remainder)}` : padded;
      return atob(finalValue);
    } catch (error) {
      return "";
    }
  }

  return "";
}

function buildMerchantOrdersCursorPayload(value) {
  if (!value || typeof value !== "object") return null;

  const id = String(value.id || "").trim();
  if (!id) return null;

  const rawCreatedAt = value.createdAt || value.created_at;
  const createdAt = rawCreatedAt ? new Date(rawCreatedAt).toISOString() : "";
  if (!createdAt) return null;

  return {
    createdAt,
    id,
  };
}

function encodeMerchantOrdersCursor(value) {
  const payload = buildMerchantOrdersCursorPayload(value);
  if (!payload) return "";
  return encodeBase64Url(JSON.stringify(payload));
}

function decodeMerchantOrdersCursor(cursor) {
  const decoded = decodeBase64Url(cursor);
  if (!decoded) return null;

  try {
    const parsed = JSON.parse(decoded);
    return buildMerchantOrdersCursorPayload(parsed);
  } catch (error) {
    return null;
  }
}

function buildEmptyMerchantOrdersPageInfo(limit = DEFAULT_MERCHANT_ORDERS_PAGE_SIZE) {
  return {
    total: 0,
    limit: normalizeMerchantOrdersPageLimit(limit),
    hasMore: false,
    endCursor: "",
  };
}

function buildMerchantOrdersPage(rows = [], limit = DEFAULT_MERCHANT_ORDERS_PAGE_SIZE, total = 0) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeLimit = normalizeMerchantOrdersPageLimit(limit);
  const hasMore = safeRows.length > safeLimit;
  const visibleRows = hasMore ? safeRows.slice(0, safeLimit) : safeRows;
  const lastRow = visibleRows[visibleRows.length - 1] || null;

  return {
    rows: visibleRows,
    pageInfo: {
      total: Math.max(0, Number(total || 0)),
      limit: safeLimit,
      hasMore,
      endCursor: hasMore && lastRow ? encodeMerchantOrdersCursor(lastRow) : "",
    },
  };
}

function isMerchantOrderBeforeCursor(order, cursor) {
  const orderCursor = buildMerchantOrdersCursorPayload(order);
  const cursorPayload =
    typeof cursor === "string" ? decodeMerchantOrdersCursor(cursor) : buildMerchantOrdersCursorPayload(cursor);

  if (!orderCursor || !cursorPayload) {
    return true;
  }

  if (orderCursor.createdAt < cursorPayload.createdAt) {
    return true;
  }

  if (orderCursor.createdAt > cursorPayload.createdAt) {
    return false;
  }

  return orderCursor.id < cursorPayload.id;
}

export {
  DEFAULT_MERCHANT_ORDERS_PAGE_SIZE,
  EMPTY_MERCHANT_ORDERS_PAGE_INFO,
  MAX_MERCHANT_ORDERS_PAGE_SIZE,
  buildEmptyMerchantOrdersPageInfo,
  buildMerchantOrdersPage,
  decodeMerchantOrdersCursor,
  encodeMerchantOrdersCursor,
  isMerchantOrderBeforeCursor,
  normalizeMerchantOrdersPageLimit,
};
