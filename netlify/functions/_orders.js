import { randomBytes, randomUUID } from "node:crypto";

const ORDER_STATUS_VALUES = ["pending", "in_progress", "on_the_way", "delivered"];
const FULFILLMENT_TYPE_VALUES = ["delivery", "pickup"];
const ALLOWED_ORDER_STATUSES = new Set(ORDER_STATUS_VALUES);
const ALLOWED_FULFILLMENT_TYPES = new Set(FULFILLMENT_TYPE_VALUES);
const ORDER_STATUS_DURATION_LIMIT_MINUTES = 7 * 24 * 60;

function cleanText(value, maxLength = null) {
  const text = String(value ?? "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function cleanStatus(value) {
  return cleanText(value, 24).toLowerCase();
}

function normalizeQuantity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return Number.NaN;
  return Math.floor(numeric);
}

function roundMoney(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toTimestamp(value) {
  if (!value) return Number.NaN;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
}

function normalizeOrderStatus(value) {
  const normalized = cleanStatus(value);
  return ALLOWED_ORDER_STATUSES.has(normalized) ? normalized : "pending";
}

function parseOrderStatus(value) {
  const normalized = cleanStatus(value);
  return ALLOWED_ORDER_STATUSES.has(normalized) ? normalized : "";
}

function normalizeFulfillmentType(value) {
  const normalized = cleanText(value, 24).toLowerCase();
  return ALLOWED_FULFILLMENT_TYPES.has(normalized) ? normalized : "";
}

function normalizeCustomerPhone(value, maxLength = 32) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
}

function normalizeCustomerDiscountPercent(value) {
  if (value === "" || value == null) return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, roundMoney(numeric)));
}

function calculateOrderDiscountAmount(subtotalAmount, discountPercent) {
  const subtotal = Number(subtotalAmount || 0);
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  return roundMoney(subtotal * (normalizeCustomerDiscountPercent(discountPercent) / 100));
}

function normalizeOrderStatusDurationMinutes(value) {
  if (value === "" || value == null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 0) return 0;
  return Math.min(rounded, ORDER_STATUS_DURATION_LIMIT_MINUTES);
}

function computeEndsAt(startedAt, durationMinutes) {
  const startedTime = toTimestamp(startedAt);
  const safeMinutes = normalizeOrderStatusDurationMinutes(durationMinutes);
  if (!Number.isFinite(startedTime) || safeMinutes == null) return null;
  return new Date(startedTime + safeMinutes * 60 * 1000).toISOString();
}

function createTimelineEntry(status, overrides = {}) {
  return {
    status,
    durationMinutes: normalizeOrderStatusDurationMinutes(overrides.durationMinutes),
    startedAt: toIsoString(overrides.startedAt),
    endsAt: toIsoString(overrides.endsAt),
    completedAt: toIsoString(overrides.completedAt),
  };
}

function withComputedEndsAt(entry) {
  if (entry.completedAt) {
    return {
      ...entry,
      endsAt: entry.endsAt || computeEndsAt(entry.startedAt, entry.durationMinutes) || entry.completedAt,
    };
  }

  return {
    ...entry,
    endsAt: computeEndsAt(entry.startedAt, entry.durationMinutes),
  };
}

function parseTimelineJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeStatusDurationsInput(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return ORDER_STATUS_VALUES.reduce((accumulator, status) => {
    if (Object.prototype.hasOwnProperty.call(value, status)) {
      accumulator[status] = normalizeOrderStatusDurationMinutes(value[status]);
    }
    return accumulator;
  }, {});
}

function normalizeOrderItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Adiciona pelo menos um produto ao pedido." };
  }

  const normalized = [];
  const seenProductIds = new Set();

  for (const [index, item] of items.entries()) {
    const productId = cleanText(item?.id || item?.productId);
    if (!productId) {
      return { error: `O item ${index + 1} do pedido e invalido.` };
    }

    if (seenProductIds.has(productId)) {
      return { error: "Existem produtos repetidos no pedido." };
    }
    seenProductIds.add(productId);

    const quantity = normalizeQuantity(item?.qty ?? item?.quantity);
    if (Number.isNaN(quantity)) {
      return { error: `A quantidade do item ${index + 1} e invalida.` };
    }

    normalized.push({
      productId,
      quantity,
    });
  }

  return { value: normalized };
}

function normalizeOrderCreateInput(payload = {}) {
  const storeId = cleanText(payload.storeId);
  if (!storeId) {
    return { error: "A loja do pedido e obrigatoria." };
  }

  const customerPhone = normalizeCustomerPhone(payload.customerPhone);
  if (!customerPhone) {
    return { error: "Indica o telefone ou WhatsApp do cliente." };
  }

  if (customerPhone.length < 8) {
    return { error: "Indica um telefone ou WhatsApp valido do cliente." };
  }

  const fulfillmentType = normalizeFulfillmentType(payload.fulfillmentType);
  if (!fulfillmentType) {
    return { error: "Seleciona se o pedido sera para entrega ou retirada." };
  }

  const region = cleanText(payload.region || payload.province, 160);
  if (!region) {
    return { error: "Indica a provincia, estado ou regiao do pedido." };
  }

  const area = cleanText(payload.area, 160);
  if (!area) {
    return { error: "Indica a area, municipio ou bairro do pedido." };
  }

  const pickupTime = cleanText(payload.pickupTime, 16);
  const deliveryTime = cleanText(payload.deliveryTime, 16);

  if (fulfillmentType === "pickup" && !pickupTime) {
    return { error: "Seleciona o horario preferido para a retirada." };
  }

  if (fulfillmentType === "delivery" && !deliveryTime) {
    return { error: "Seleciona o horario preferido para a entrega." };
  }

  const itemsResult = normalizeOrderItems(payload.items);
  if (itemsResult.error) {
    return { error: itemsResult.error };
  }

  return {
    value: {
      storeId,
      customerName: cleanText(payload.customerName, 160),
      customerPhone,
      fulfillmentType,
      region,
      area,
      pickupTime,
      deliveryTime,
      notes: cleanText(payload.notes),
      items: itemsResult.value,
    },
  };
}

function normalizeOrderStatusUpdateInput(payload = {}) {
  const orderId = cleanText(payload.orderId);
  if (!orderId) {
    return { error: "A encomenda a atualizar e obrigatoria." };
  }

  const status = parseOrderStatus(payload.status);
  if (!status) {
    return { error: "O estado da encomenda e invalido." };
  }

  return {
    value: {
      orderId,
      status,
      statusDurations: normalizeStatusDurationsInput(payload.statusDurations),
    },
  };
}

function createTrackingCode() {
  return `PED-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function createTrackingToken() {
  return randomBytes(24).toString("base64url");
}

function createOrderId() {
  return randomUUID();
}

function createOrderItemId() {
  return randomUUID();
}

function createCustomerProfileId() {
  return randomUUID();
}

function createInitialOrderStatusTimeline(referenceDate = new Date(), statusDurations = {}) {
  const createdAt = toIsoString(referenceDate) || new Date().toISOString();
  return ORDER_STATUS_VALUES.map((status, index) =>
    withComputedEndsAt(
      createTimelineEntry(status, {
        durationMinutes: statusDurations[status],
        startedAt: index === 0 ? createdAt : null,
      }),
    ),
  );
}

function normalizeOrderStatusTimeline(value, currentStatus = "pending", createdAt = null, statusUpdatedAt = null) {
  const safeCurrentStatus = normalizeOrderStatus(currentStatus);
  const sourceEntries = parseTimelineJson(value);
  const sourceByStatus = new Map(
    sourceEntries
      .map((entry) => {
        const status = parseOrderStatus(entry?.status);
        return status ? [status, entry] : null;
      })
      .filter(Boolean),
  );
  const createdAtIso = toIsoString(createdAt) || toIsoString(statusUpdatedAt) || new Date().toISOString();
  const updatedAtIso = toIsoString(statusUpdatedAt) || createdAtIso;

  return ORDER_STATUS_VALUES.map((status, index) => {
    const sourceEntry = sourceByStatus.get(status);
    let nextEntry = withComputedEndsAt(
      createTimelineEntry(status, {
        durationMinutes: sourceEntry?.durationMinutes,
        startedAt: sourceEntry?.startedAt,
        endsAt: sourceEntry?.endsAt,
        completedAt: sourceEntry?.completedAt,
      }),
    );

    if (!nextEntry.startedAt && index === 0) {
      nextEntry = withComputedEndsAt({ ...nextEntry, startedAt: createdAtIso });
    }

    if (status === safeCurrentStatus && !nextEntry.startedAt) {
      nextEntry = withComputedEndsAt({ ...nextEntry, startedAt: updatedAtIso });
    }

    if (status === "delivered" && safeCurrentStatus === "delivered") {
      nextEntry = {
        ...nextEntry,
        startedAt: nextEntry.startedAt || updatedAtIso,
        completedAt: nextEntry.completedAt || updatedAtIso,
        endsAt: nextEntry.endsAt || nextEntry.completedAt || updatedAtIso,
      };
    }

    return nextEntry;
  });
}

function syncTimelineDurations(timeline, statusDurations = {}) {
  return ORDER_STATUS_VALUES.map((status) => {
    const currentEntry = timeline.find((entry) => entry.status === status) || createTimelineEntry(status);
    const nextDuration = Object.prototype.hasOwnProperty.call(statusDurations, status)
      ? normalizeOrderStatusDurationMinutes(statusDurations[status])
      : currentEntry.durationMinutes;

    return withComputedEndsAt({
      ...currentEntry,
      durationMinutes: nextDuration,
    });
  });
}

function applyOrderStatusUpdate(orderLike, nextStatus, statusDurations = {}, referenceDate = new Date()) {
  const safeNextStatus = normalizeOrderStatus(nextStatus);
  const currentStatus = normalizeOrderStatus(orderLike?.status);
  const nowIso = toIsoString(referenceDate) || new Date().toISOString();
  const currentStatusUpdatedAt = orderLike?.statusUpdatedAt || orderLike?.createdAt || nowIso;
  let timeline = normalizeOrderStatusTimeline(
    orderLike?.statusTimeline,
    currentStatus,
    orderLike?.createdAt,
    currentStatusUpdatedAt,
  );

  timeline = syncTimelineDurations(timeline, statusDurations).map((entry) => {
    if (entry.status === currentStatus && currentStatus !== safeNextStatus) {
      const startedAt = entry.startedAt || currentStatusUpdatedAt || orderLike?.createdAt || nowIso;
      return {
        ...entry,
        startedAt,
        completedAt: nowIso,
        endsAt: entry.endsAt || computeEndsAt(startedAt, entry.durationMinutes) || nowIso,
      };
    }

    if (entry.status === safeNextStatus) {
      const startedAt = currentStatus === safeNextStatus ? entry.startedAt || currentStatusUpdatedAt || nowIso : nowIso;
      if (safeNextStatus === "delivered") {
        const completedAt = currentStatus === safeNextStatus ? entry.completedAt || currentStatusUpdatedAt || nowIso : nowIso;
        return {
          ...entry,
          startedAt: currentStatus === safeNextStatus ? entry.startedAt || completedAt : startedAt,
          completedAt,
          endsAt: currentStatus === safeNextStatus ? entry.endsAt || completedAt : nowIso,
        };
      }

      return {
        ...entry,
        startedAt,
        completedAt: null,
        endsAt: computeEndsAt(startedAt, entry.durationMinutes),
      };
    }

    return entry;
  });

  return {
    status: safeNextStatus,
    statusUpdatedAt: nowIso,
    statusTimeline: timeline,
  };
}

function mapOrderItem(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id || "",
    productName: row.product_name || "",
    productImage: row.product_image || "",
    unitPrice: Number(row.unit_price || 0),
    quantity: Number(row.quantity || 0),
    lineTotal: Number(row.line_total || 0),
    createdAt: row.created_at || null,
  };
}

function mapCustomerProfileRow(row) {
  if (!row) return null;

  const customerKey = cleanText(row.customer_profile_key || row.customer_key || row.order_customer_key);
  const customerPhone = normalizeCustomerPhone(row.customer_profile_phone || row.customer_phone || row.order_customer_phone);
  if (!customerKey && !customerPhone) return null;

  return {
    id: row.customer_profile_id || row.id || "",
    customerKey: customerKey || customerPhone,
    customerName: row.customer_profile_name || row.customer_name || row.order_customer_name || "",
    customerPhone,
    loyaltyDiscountPercent: normalizeCustomerDiscountPercent(row.customer_profile_discount_percent ?? row.loyalty_discount_percent),
    orderCount: Math.max(0, Math.floor(Number((row.customer_profile_order_count ?? row.order_count) || 0))),
    lastOrderId: row.customer_profile_last_order_id || row.last_order_id || "",
    lastOrderAt: row.customer_profile_last_order_at || row.last_order_at || null,
    createdAt: row.customer_created_at || row.created_at || null,
    updatedAt: row.customer_updated_at || row.updated_at || null,
  };
}

function mapOrder(row, options = {}) {
  const status = normalizeOrderStatus(row.status);
  const order = {
    id: row.id,
    storeId: row.store_id,
    trackingCode: row.tracking_code || "",
    trackingToken: row.tracking_token || "",
    customerName: row.customer_name || "",
    customerPhone: normalizeCustomerPhone(row.customer_phone),
    customerKey: cleanText(row.customer_key) || normalizeCustomerPhone(row.customer_phone),
    fulfillmentType: row.fulfillment_type || "delivery",
    region: row.region || "",
    area: row.area || "",
    pickupTime: row.pickup_time || "",
    deliveryTime: row.delivery_time || "",
    notes: row.notes || "",
    status,
    subtotalAmount: Number(row.subtotal_amount || row.total_amount || 0),
    discountPercent: normalizeCustomerDiscountPercent(row.discount_percent),
    discountAmount: Number(row.discount_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    currencyCode: row.currency_code || "AOA",
    itemCount: Number(row.item_count || 0),
    statusUpdatedAt: row.status_updated_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    statusTimeline: normalizeOrderStatusTimeline(row.status_timeline, status, row.created_at, row.status_updated_at),
  };

  if (options.items) {
    order.items = options.items;
  }

  if (options.store) {
    order.store = options.store;
  }

  if (options.customer) {
    order.customer = options.customer;
  }

  return order;
}

function mapOrderStore(row) {
  return {
    id: row.store_public_id || row.id,
    name: row.name || "",
    logo: row.logo || "",
    color: row.color || "#16a34a",
    whatsapp: row.whatsapp || "",
    pickupNote: row.pickup_note || "",
    city: row.city || "",
    country: row.country || "",
  };
}

export {
  ORDER_STATUS_VALUES,
  FULFILLMENT_TYPE_VALUES,
  applyOrderStatusUpdate,
  cleanText,
  calculateOrderDiscountAmount,
  createCustomerProfileId,
  createInitialOrderStatusTimeline,
  createOrderId,
  createOrderItemId,
  createTrackingCode,
  createTrackingToken,
  mapOrder,
  mapCustomerProfileRow,
  mapOrderItem,
  mapOrderStore,
  normalizeCustomerDiscountPercent,
  normalizeCustomerPhone,
  normalizeOrderCreateInput,
  normalizeOrderStatus,
  normalizeOrderStatusDurationMinutes,
  normalizeOrderStatusTimeline,
  normalizeOrderStatusUpdateInput,
  parseOrderStatus,
};
