const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 7;

export const EMPTY_MERCHANT_ORDER_SUMMARY = {
  totalCount: 0,
  currentDayKey: "",
  generatedAt: "",
  timezoneOffsetMinutes: 0,
  windowDays: DEFAULT_WINDOW_DAYS,
  statusCounts: {
    pending: 0,
    inProgress: 0,
    onTheWay: 0,
    delivered: 0,
  },
  today: {
    count: 0,
    revenue: 0,
    deliveredCount: 0,
  },
  historical: {
    count: 0,
  },
  growth: {
    mode: "value",
    percentage: 0,
    currentWindowRevenue: 0,
    previousWindowRevenue: 0,
  },
  revenueSeries: [],
};

function toTimestamp(value) {
  if (value == null || value === "") return Number.NaN;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
}

function roundMoney(value) {
  return Number((Number(value || 0)).toFixed(2));
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

function createDayKeyFromTimestamp(timestamp, timezoneOffsetMinutes) {
  const safeTimestamp = Number(timestamp);
  if (!Number.isFinite(safeTimestamp)) return "";
  return new Date(
    shiftTimestampToLocalSpace(safeTimestamp, timezoneOffsetMinutes),
  )
    .toISOString()
    .slice(0, 10);
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

function formatDayLabel(dayKey) {
  const [year, month, day] = String(dayKey || "").split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}`;
}

export function buildMerchantOrderSummary(orders = [], options = {}) {
  const timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(
    options.timezoneOffsetMinutes,
  );
  const windowDays = normalizeWindowDays(options.windowDays);
  const parsedReferenceTimestamp = toTimestamp(options.referenceNow);
  const referenceTimestamp = Number.isFinite(parsedReferenceTimestamp)
    ? parsedReferenceTimestamp
    : Date.now();
  const currentDayStart = startOfLocalDayTimestamp(
    referenceTimestamp,
    timezoneOffsetMinutes,
  );
  const currentDayKey = createDayKeyFromTimestamp(
    referenceTimestamp,
    timezoneOffsetMinutes,
  );
  const revenueSeries = [];

  for (let index = windowDays - 1; index >= 0; index -= 1) {
    const dayStart = currentDayStart - index * DAY_MS;
    const key = createDayKeyFromTimestamp(dayStart, timezoneOffsetMinutes);
    revenueSeries.push({
      key,
      label: formatDayLabel(key),
      total: 0,
      deliveredTotal: 0,
      count: 0,
    });
  }

  const statusCounts = {
    pending: 0,
    inProgress: 0,
    onTheWay: 0,
    delivered: 0,
  };
  const seriesByKey = new Map(
    revenueSeries.map((entry) => [entry.key, entry]),
  );
  let todayCount = 0;
  let todayRevenue = 0;
  let deliveredTodayCount = 0;
  let previousWindowRevenue = 0;
  const previousWindowStart =
    currentDayStart - (windowDays * 2 - 1) * DAY_MS;
  const previousWindowEnd = currentDayStart - (windowDays - 1) * DAY_MS;

  for (const order of Array.isArray(orders) ? orders : []) {
    switch (order?.status) {
      case "pending":
        statusCounts.pending += 1;
        break;
      case "in_progress":
        statusCounts.inProgress += 1;
        break;
      case "on_the_way":
        statusCounts.onTheWay += 1;
        break;
      case "delivered":
        statusCounts.delivered += 1;
        break;
      default:
        break;
    }

    const createdAtTime = toTimestamp(order?.createdAt);
    if (!Number.isFinite(createdAtTime)) continue;

    const totalAmount = Number(order?.totalAmount || 0);
    const dayKey = createDayKeyFromTimestamp(
      createdAtTime,
      timezoneOffsetMinutes,
    );

    if (dayKey === currentDayKey) {
      todayCount += 1;
      todayRevenue += totalAmount;
      if (order?.status === "delivered") {
        deliveredTodayCount += 1;
      }
    }

    const seriesEntry = seriesByKey.get(dayKey);
    if (seriesEntry) {
      seriesEntry.total = roundMoney(seriesEntry.total + totalAmount);
      seriesEntry.count += 1;
      if (order?.status === "delivered") {
        seriesEntry.deliveredTotal = roundMoney(
          seriesEntry.deliveredTotal + totalAmount,
        );
      }
    }

    if (
      createdAtTime >= previousWindowStart
      && createdAtTime < previousWindowEnd
    ) {
      previousWindowRevenue += totalAmount;
    }
  }

  const currentWindowRevenue = revenueSeries.reduce(
    (accumulator, entry) => accumulator + Number(entry.total || 0),
    0,
  );
  const growth =
    previousWindowRevenue > 0
      ? {
          mode: "value",
          percentage: Number(
            (
              ((currentWindowRevenue - previousWindowRevenue)
                / previousWindowRevenue)
              * 100
            ).toFixed(1),
          ),
          currentWindowRevenue: roundMoney(currentWindowRevenue),
          previousWindowRevenue: roundMoney(previousWindowRevenue),
        }
      : currentWindowRevenue > 0
        ? {
            mode: "new",
            percentage: 0,
            currentWindowRevenue: roundMoney(currentWindowRevenue),
            previousWindowRevenue: 0,
          }
        : {
            mode: "value",
            percentage: 0,
            currentWindowRevenue: 0,
            previousWindowRevenue: 0,
          };

  return {
    totalCount: Array.isArray(orders) ? orders.length : 0,
    currentDayKey,
    generatedAt: new Date(referenceTimestamp).toISOString(),
    timezoneOffsetMinutes,
    windowDays,
    statusCounts,
    today: {
      count: todayCount,
      revenue: roundMoney(todayRevenue),
      deliveredCount: deliveredTodayCount,
    },
    historical: {
      count: Math.max(0, (Array.isArray(orders) ? orders.length : 0) - todayCount),
    },
    growth,
    revenueSeries,
  };
}
