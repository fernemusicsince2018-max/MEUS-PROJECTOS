import { buildAbsoluteAppUrl, buildTrackingPath } from "./appRoutes.js";
import { getCanonicalCountry, getCountryRegionLabel } from "./countryRegions.js";

export const ORDER_STATUS_FLOW = ["pending", "in_progress", "on_the_way", "delivered"];
export const ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em curso" },
  { value: "on_the_way", label: "A caminho" },
  { value: "delivered", label: "Entregue" },
];
export const ORDER_STATUS_DURATION_LIMIT_MINUTES = 7 * 24 * 60;

const ORDER_STATUS_META = {
  pending: { label: "Pendente", bg: "#fee2e2", color: "#b91c1c" },
  in_progress: { label: "Em curso", bg: "#dbeafe", color: "#1d4ed8" },
  on_the_way: { label: "A caminho", bg: "#fef3c7", color: "#b45309" },
  delivered: { label: "Entregue", bg: "#dcfce7", color: "#166534" },
};

function cleanText(value) {
  return String(value || "").trim().toLowerCase();
}

function isKnownStatus(value) {
  return ORDER_STATUS_FLOW.includes(cleanText(value));
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

function clampPositiveInteger(value, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 0) return 0;
  return Math.min(rounded, maximum);
}

function roundMoney(value) {
  return Number((Number(value || 0)).toFixed(2));
}

export function normalizeCustomerPhone(value, maxLength = 32) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
}

export function normalizeCustomerDiscountPercent(value) {
  if (value === "" || value == null) return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, roundMoney(numeric)));
}

export function calculateOrderDiscountAmount(subtotalAmount, discountPercent) {
  const subtotal = Number(subtotalAmount || 0);
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  return roundMoney(subtotal * (normalizeCustomerDiscountPercent(discountPercent) / 100));
}

export function formatCustomerDiscountPercent(value) {
  return `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(normalizeCustomerDiscountPercent(value))}%`;
}

export function formatCustomerOrderCount(value) {
  const safeCount = Math.max(0, Math.floor(Number(value || 0)));
  return `${safeCount} ${safeCount === 1 ? "pedido" : "pedidos"}`;
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

function formatUnit(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatDurationFromSeconds(totalSeconds, { includeSeconds = true, maxParts = 2 } = {}) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const parts = [];

  if (days > 0) parts.push(formatUnit(days, "dia", "dias"));
  if (hours > 0) parts.push(formatUnit(hours, "hora", "horas"));
  if (minutes > 0) parts.push(formatUnit(minutes, "minuto", "minutos"));
  if (includeSeconds && (seconds > 0 || parts.length === 0)) {
    parts.push(formatUnit(seconds, "segundo", "segundos"));
  }

  return parts.slice(0, maxParts).join(" e ") || "0 segundos";
}

function formatCompactDurationFromSeconds(totalSeconds, { includeSeconds = true, maxParts = 2 } = {}) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (includeSeconds && (seconds > 0 || parts.length === 0)) parts.push(`${seconds}s`);

  return parts.slice(0, maxParts).join(" ") || "0s";
}

function syncTimelineDurations(timeline, statusDurations = {}) {
  return ORDER_STATUS_FLOW.map((status) => {
    const currentEntry = timeline.find((entry) => entry.status === status) || createTimelineEntry(status);
    const nextDuration =
      Object.prototype.hasOwnProperty.call(statusDurations, status)
        ? normalizeOrderStatusDurationMinutes(statusDurations[status])
        : currentEntry.durationMinutes;

    return withComputedEndsAt({
      ...currentEntry,
      durationMinutes: nextDuration,
    });
  });
}

export function normalizeOrderStatusDurationMinutes(value) {
  if (value === "" || value == null) return null;
  return clampPositiveInteger(value, ORDER_STATUS_DURATION_LIMIT_MINUTES);
}

export function createInitialOrderStatusTimeline(referenceDate = new Date(), statusDurations = {}) {
  const createdAt = toIsoString(referenceDate) || new Date().toISOString();
  return ORDER_STATUS_FLOW.map((status, index) =>
    withComputedEndsAt(
      createTimelineEntry(status, {
        durationMinutes: statusDurations[status],
        startedAt: index === 0 ? createdAt : null,
      }),
    ),
  );
}

export function normalizeOrderStatusTimeline(value, currentStatus = "pending", createdAt = null, statusUpdatedAt = null) {
  const safeCurrentStatus = isKnownStatus(currentStatus) ? cleanText(currentStatus) : "pending";
  const sourceEntries = Array.isArray(value) ? value : [];
  const sourceByStatus = new Map(
    sourceEntries
      .map((entry) => {
        const status = cleanText(entry?.status);
        return isKnownStatus(status) ? [status, entry] : null;
      })
      .filter(Boolean),
  );
  const createdAtIso = toIsoString(createdAt) || toIsoString(statusUpdatedAt) || new Date().toISOString();
  const updatedAtIso = toIsoString(statusUpdatedAt) || createdAtIso;

  return ORDER_STATUS_FLOW.map((status, index) => {
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

export function buildOrderStatusDurationMap(orderOrTimeline, currentStatus = "pending", createdAt = null, statusUpdatedAt = null) {
  const timeline = Array.isArray(orderOrTimeline)
    ? normalizeOrderStatusTimeline(orderOrTimeline, currentStatus, createdAt, statusUpdatedAt)
    : normalizeOrderStatusTimeline(
        orderOrTimeline?.statusTimeline,
        orderOrTimeline?.status,
        orderOrTimeline?.createdAt,
        orderOrTimeline?.statusUpdatedAt,
      );

  return ORDER_STATUS_FLOW.reduce((accumulator, status) => {
    const entry = timeline.find((item) => item.status === status);
    accumulator[status] = entry?.durationMinutes ?? "";
    return accumulator;
  }, {});
}

export function applyOrderStatusUpdate(orderLike, nextStatus, statusDurations = {}, referenceDate = new Date()) {
  const safeNextStatus = isKnownStatus(nextStatus) ? cleanText(nextStatus) : "pending";
  const nowIso = toIsoString(referenceDate) || new Date().toISOString();
  const currentStatus = isKnownStatus(orderLike?.status) ? cleanText(orderLike.status) : "pending";
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

export function getOrderStatusMeta(status) {
  return ORDER_STATUS_META[cleanText(status)] || ORDER_STATUS_META.pending;
}

export function formatOrderDate(value) {
  if (!value) return "Sem registo";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registo";

  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatOrderDateTime(value) {
  if (!value) return "Sem registo";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registo";

  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatOrderDurationMinutes(value) {
  const safeMinutes = normalizeOrderStatusDurationMinutes(value);
  if (safeMinutes == null) return "A definir";
  if (safeMinutes === 0) return "0 min";
  return formatDurationFromSeconds(safeMinutes * 60, { includeSeconds: false, maxParts: 2 });
}

export function formatOrderDurationMs(value, options = {}) {
  return formatDurationFromSeconds(Math.max(0, Math.floor(Number(value || 0) / 1000)), options);
}

export function getFulfillmentLabel(value) {
  return cleanText(value) === "pickup" ? "Retirada na loja" : "Entrega";
}

export function getOrderRegionLabel(country) {
  const canonicalCountry = getCanonicalCountry(country);
  return getCountryRegionLabel(canonicalCountry);
}

export function buildOrderTrackingUrl(token) {
  if (!token || typeof window === "undefined") return "";
  return buildAbsoluteAppUrl(buildTrackingPath(token));
}

export function getOrderStepState(currentStatus, stepStatus) {
  const currentIndex = ORDER_STATUS_FLOW.indexOf(cleanText(currentStatus));
  const stepIndex = ORDER_STATUS_FLOW.indexOf(stepStatus);

  if (currentIndex < 0 || stepIndex < 0) {
    return "upcoming";
  }

  if (currentIndex > stepIndex) return "done";
  if (currentIndex === stepIndex) return "current";
  return "upcoming";
}

export function getOrderStatusTimingMeta(order, status, referenceTime = Date.now()) {
  const safeStatus = isKnownStatus(status) ? cleanText(status) : "pending";
  const timeline = normalizeOrderStatusTimeline(order?.statusTimeline, order?.status, order?.createdAt, order?.statusUpdatedAt);
  const entry = timeline.find((item) => item.status === safeStatus) || createTimelineEntry(safeStatus);
  const stepState = getOrderStepState(order?.status, safeStatus);
  const nowTime = referenceTime instanceof Date ? referenceTime.getTime() : Number(referenceTime);
  const startedAtTime = toTimestamp(entry.startedAt);
  const endsAtTime = toTimestamp(entry.endsAt);
  const completedAtTime = toTimestamp(entry.completedAt);
  const durationLabel = formatOrderDurationMinutes(entry.durationMinutes);

  if ((safeStatus === "delivered" && Number.isFinite(completedAtTime)) || stepState === "done") {
    if (Number.isFinite(startedAtTime) && Number.isFinite(completedAtTime)) {
      const elapsedMs = Math.max(0, completedAtTime - startedAtTime);
      return {
        stepState: "done",
        variant: "done",
        eyebrow: safeStatus === "delivered" ? "Conclusao" : "Tempo gasto",
        primary: formatOrderDurationMs(elapsedMs, { includeSeconds: false, maxParts: 2 }),
        secondary: `Concluido em ${formatOrderDateTime(entry.completedAt)}.`,
        durationLabel,
        entry,
      };
    }

    return {
      stepState: "done",
      variant: "done",
      eyebrow: safeStatus === "delivered" ? "Conclusao" : "Etapa concluida",
      primary: "Concluido",
      secondary: entry.completedAt ? `Concluido em ${formatOrderDateTime(entry.completedAt)}.` : "Etapa concluida anteriormente.",
      durationLabel,
      entry,
    };
  }

  if (stepState === "current") {
    if (Number.isFinite(endsAtTime) && entry.durationMinutes != null) {
      const diffMs = endsAtTime - nowTime;
      if (diffMs >= 0) {
        return {
          stepState,
          variant: "current",
          eyebrow: "Tempo restante",
          primary: formatCompactDurationFromSeconds(diffMs / 1000, { includeSeconds: true, maxParts: 2 }),
          secondary: `Meta manual: ${durationLabel}.`,
          durationLabel,
          entry,
        };
      }

      return {
        stepState,
        variant: "overdue",
        eyebrow: "Tempo excedido",
        primary: `+${formatCompactDurationFromSeconds(Math.abs(diffMs) / 1000, { includeSeconds: true, maxParts: 2 })}`,
        secondary: `Meta manual: ${durationLabel}.`,
        durationLabel,
        entry,
      };
    }

    if (Number.isFinite(startedAtTime)) {
      return {
        stepState,
        variant: "current",
        eyebrow: "Tempo decorrido",
        primary: formatCompactDurationFromSeconds(Math.max(0, nowTime - startedAtTime) / 1000, { includeSeconds: true, maxParts: 2 }),
        secondary: "Sem contagem manual definida para esta etapa.",
        durationLabel,
        entry,
      };
    }

    return {
      stepState,
      variant: "current",
      eyebrow: "Etapa atual",
      primary: "A iniciar",
      secondary: "A loja ainda nao confirmou o inicio desta etapa.",
      durationLabel,
      entry,
    };
  }

  if (entry.durationMinutes != null) {
    return {
      stepState,
      variant: "upcoming",
      eyebrow: "Tempo planeado",
      primary: durationLabel,
      secondary: "Tempo definido manualmente pela loja.",
      durationLabel,
      entry,
    };
  }

  return {
    stepState,
    variant: "idle",
    eyebrow: "Tempo planeado",
    primary: "A definir",
    secondary: "O lojista ainda nao definiu o tempo desta etapa.",
    durationLabel: "A definir",
    entry,
  };
}

export function getOrderCurrentStatusTiming(order, referenceTime = Date.now()) {
  return getOrderStatusTimingMeta(order, order?.status, referenceTime);
}
