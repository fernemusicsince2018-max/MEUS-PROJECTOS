import React from "react";
import { BarChart3, CalendarDays, Filter, Search, Store, TrendingUp, Users, Wallet } from "lucide-react";
import { FIELD_STYLE, SURFACE_STYLE } from "../../constants.js";
import { fmtMoney } from "../../utils/format.js";
import { Badge } from "../common/UiBits.jsx";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const FILTER_SELECT_STYLE = {
  ...FIELD_STYLE,
  padding: "8px 10px",
};

const FILTER_INPUT_STYLE = {
  ...FIELD_STYLE,
  padding: "8px 10px",
};

function toDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDateInput(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText), 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMonthInput(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText] = match;
  const date = new Date(Number(yearText), Number(monthText) - 1, 1, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfYear(date) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function formatDateLabel(value, withTime = false) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registo";
  return withTime
    ? date.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-PT");
}

function formatMonthLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Mes atual";
  return date.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
}

function formatYearLabel(value) {
  return String(value || new Date().getFullYear());
}

function formatGrowthPercentage(value) {
  if (value === Infinity) return "Novo";
  if (!Number.isFinite(value)) return "0%";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function getEventTypeMeta(eventType) {
  if (eventType === "renewal") {
    return { label: "Renovacao", bg: "#dcfce7", color: "#166534" };
  }
  if (eventType === "plan_change") {
    return { label: "Mudanca de plano", bg: "#dbeafe", color: "#1d4ed8" };
  }
  if (eventType === "backfill") {
    return { label: "Historico", bg: "#f3f4f6", color: "#475569" };
  }
  return { label: "Ativacao", bg: "#fef3c7", color: "#b45309" };
}

function normalizeEvent(event) {
  const occurredAt = new Date(event?.planStartedAt || event?.recordedAt || "");
  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  return {
    ...event,
    occurredAt,
    searchIndex: [
      event?.storeName,
      event?.merchantEmail,
      event?.planName,
      event?.planCode,
      event?.referenceId,
      event?.planStatus,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

function matchesPeriod(date, period) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  if (!period?.start || !period?.end) return true;
  return date.getTime() >= period.start.getTime() && date.getTime() <= period.end.getTime();
}

function summarizeTotalsByCurrency(events) {
  const totals = new Map();
  for (const event of events) {
    const currencyCode = event.currencyCode || "AOA";
    totals.set(currencyCode, (totals.get(currencyCode) || 0) + Number(event.totalPrice || 0));
  }
  return totals;
}

function formatCurrencyTotals(totals) {
  const entries = Array.from(totals.entries()).sort(([leftCode], [rightCode]) => leftCode.localeCompare(rightCode));
  if (!entries.length) return "Sem pagamentos";
  return entries.map(([currencyCode, total]) => `${currencyCode}: ${fmtMoney(total, currencyCode)}`).join(" | ");
}

function getPrimaryCurrencyCode(totals) {
  const entries = Array.from(totals.entries()).sort((left, right) => right[1] - left[1]);
  return entries[0]?.[0] || "AOA";
}

function getPeriodBounds(periodMode, filters, fallbackStart, fallbackEnd) {
  const safeEnd = fallbackEnd || new Date();
  const safeStart = fallbackStart || safeEnd;

  if (periodMode === "day") {
    const target = parseDateInput(filters.selectedDay) || safeEnd;
    return {
      start: startOfDay(target),
      end: endOfDay(target),
      label: `Dia ${formatDateLabel(target)}`,
    };
  }

  if (periodMode === "month") {
    const target = parseMonthInput(filters.selectedMonth) || safeEnd;
    return {
      start: startOfMonth(target),
      end: endOfMonth(target),
      label: formatMonthLabel(target),
    };
  }

  if (periodMode === "year") {
    const year = Number(filters.selectedYear || safeEnd.getFullYear());
    const target = new Date(year, 0, 1, 0, 0, 0, 0);
    return {
      start: startOfYear(target),
      end: endOfYear(target),
      label: `Ano ${formatYearLabel(year)}`,
    };
  }

  if (periodMode === "range") {
    const from = parseDateInput(filters.fromDate) || safeStart;
    const to = parseDateInput(filters.toDate) || safeEnd;
    const start = from <= to ? startOfDay(from) : startOfDay(to);
    const end = from <= to ? endOfDay(to) : endOfDay(from);
    return {
      start,
      end,
      label: `${formatDateLabel(start)} ate ${formatDateLabel(end)}`,
    };
  }

  return {
    start: safeStart,
    end: safeEnd,
    label: `${formatDateLabel(safeStart)} ate ${formatDateLabel(safeEnd)}`,
  };
}

function getGrowthComparisonWindow(periodMode, currentPeriod, fallbackEnd) {
  if (periodMode === "all") {
    const baseEnd = fallbackEnd || new Date();
    const end = endOfDay(baseEnd);
    const start = startOfDay(new Date(end.getTime() - (29 * DAY_IN_MS)));
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = startOfDay(new Date(previousEnd.getTime() - (29 * DAY_IN_MS)));
    return {
      current: { start, end, label: "Ultimos 30 dias" },
      previous: { start: previousStart, end: previousEnd, label: "30 dias anteriores" },
    };
  }

  const duration = Math.max(1, currentPeriod.end.getTime() - currentPeriod.start.getTime() + 1);
  const previousEnd = new Date(currentPeriod.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration + 1);
  return {
    current: currentPeriod,
    previous: { start: previousStart, end: previousEnd, label: "Periodo anterior" },
  };
}

function resolveSeriesGranularity(period) {
  const spanDays = Math.max(1, Math.ceil((period.end.getTime() - period.start.getTime() + 1) / DAY_IN_MS));
  if (spanDays <= 45) return "day";
  if (spanDays <= 550) return "month";
  return "year";
}

function startOfBucket(date, granularity) {
  if (granularity === "year") return startOfYear(date);
  if (granularity === "month") return startOfMonth(date);
  return startOfDay(date);
}

function advanceBucket(date, granularity) {
  const next = new Date(date);
  if (granularity === "year") {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }
  if (granularity === "month") {
    next.setMonth(next.getMonth() + 1);
    return next;
  }
  next.setDate(next.getDate() + 1);
  return next;
}

function buildBucketKey(date, granularity) {
  if (granularity === "year") return String(date.getFullYear());
  if (granularity === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return toDateInputValue(date);
}

function formatBucketLabel(date, granularity) {
  if (granularity === "year") return String(date.getFullYear());
  if (granularity === "month") return date.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

function buildFinancialSeries(events, period, granularity) {
  const points = [];
  const buckets = new Map();
  let cursor = startOfBucket(period.start, granularity);

  while (cursor.getTime() <= period.end.getTime()) {
    const key = buildBucketKey(cursor, granularity);
    const point = {
      key,
      label: formatBucketLabel(cursor, granularity),
      total: 0,
      count: 0,
    };
    points.push(point);
    buckets.set(key, point);
    cursor = advanceBucket(cursor, granularity);
  }

  for (const event of events) {
    const key = buildBucketKey(event.occurredAt, granularity);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.total += Number(event.totalPrice || 0);
    bucket.count += 1;
  }

  return points;
}

function FinanceMetricCard({ label, value, hint, accent }) {
  return (
    <div style={{ ...SURFACE_STYLE, padding: "16px", display: "grid", gap: "8px" }}>
      <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: "22px", lineHeight: 1.15, fontWeight: "800", fontFamily: "var(--font-display)", color: accent, wordBreak: "break-word" }}>{value}</div>
      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

function FinancialTrendChart({ points, accent, displayMode, currencyCode, title, subtitle }) {
  const maxValue = Math.max(1, ...points.map((point) => (displayMode === "count" ? point.count : point.total)));

  return (
    <div style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{title}</div>
          <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>{subtitle}</div>
        </div>
        <Badge bg="#ecfdf5" color="#166534">
          <TrendingUp size={12} /> {displayMode === "count" ? "Ativacoes" : "Receita"}
        </Badge>
      </div>

      {points.length ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`, gap: "10px", alignItems: "end", minHeight: "220px" }}>
          {points.map((point) => {
            const value = displayMode === "count" ? point.count : point.total;
            const label = displayMode === "count" ? `${point.count} pag.` : fmtMoney(point.total, currencyCode);
            const barHeight = Math.max(18, (value / maxValue) * 158);

            return (
              <div key={point.key} style={{ display: "grid", gap: "8px", alignItems: "end" }}>
                <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", textAlign: "center" }}>{label}</div>
                <div
                  title={`${point.label}: ${label}`}
                  style={{
                    height: `${barHeight}px`,
                    borderRadius: "18px 18px 10px 10px",
                    background: `linear-gradient(180deg, ${accent} 0%, ${accent}cc 100%)`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24), 0 16px 28px rgba(28, 154, 116, 0.16)",
                  }}
                />
                <div style={{ fontSize: "11px", textAlign: "center", color: "var(--color-text-secondary)", fontWeight: "700" }}>{point.label}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: "18px", borderRadius: "18px", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", fontSize: "13px" }}>
          Ainda nao existem pagamentos suficientes para desenhar o grafico.
        </div>
      )}
    </div>
  );
}

export default function SuperAdminFinanceTab({
  events = [],
  clients = [],
  accent = "#1c9a74",
  pageInfo = { total: 0, limit: 50, hasMore: false, endCursor: "" },
  onLoadMore = null,
  loading = false,
}) {
  const now = React.useMemo(() => new Date(), []);
  const [search, setSearch] = React.useState("");
  const [periodMode, setPeriodMode] = React.useState("all");
  const [selectedDay, setSelectedDay] = React.useState(() => toDateInputValue(now));
  const [selectedMonth, setSelectedMonth] = React.useState(() => toMonthInputValue(now));
  const [selectedYear, setSelectedYear] = React.useState(() => String(now.getFullYear()));
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [currencyFilter, setCurrencyFilter] = React.useState("all");

  const normalizedEvents = React.useMemo(
    () =>
      events
        .map(normalizeEvent)
        .filter(Boolean)
        .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime()),
    [events],
  );
  const totalEventsCount = Math.max(Number(pageInfo.total || 0), normalizedEvents.length);
  const hasPartialDataset = totalEventsCount > normalizedEvents.length;

  const earliestEventDate = normalizedEvents[0]?.occurredAt || null;
  const latestEventDate = normalizedEvents[normalizedEvents.length - 1]?.occurredAt || null;
  const availableYears = React.useMemo(() => {
    const years = new Set(normalizedEvents.map((event) => event.occurredAt.getFullYear()));
    years.add(now.getFullYear());
    return Array.from(years).sort((left, right) => right - left);
  }, [normalizedEvents, now]);

  const availableCurrencies = React.useMemo(() => {
    const codes = new Set(normalizedEvents.map((event) => event.currencyCode || "AOA"));
    return Array.from(codes).sort();
  }, [normalizedEvents]);

  React.useEffect(() => {
    if (currencyFilter !== "all" && !availableCurrencies.includes(currencyFilter)) {
      setCurrencyFilter("all");
    }
  }, [availableCurrencies, currencyFilter]);

  const searchQuery = search.trim().toLowerCase();
  const searchableEvents = React.useMemo(
    () => normalizedEvents.filter((event) => !searchQuery || event.searchIndex.includes(searchQuery)),
    [normalizedEvents, searchQuery],
  );

  const allCurrencyFilteredEvents = React.useMemo(
    () =>
      searchableEvents.filter(
        (event) => currencyFilter === "all" || (event.currencyCode || "AOA") === currencyFilter,
      ),
    [searchableEvents, currencyFilter],
  );

  const currentPeriod = React.useMemo(
    () =>
      getPeriodBounds(
        periodMode,
        { selectedDay, selectedMonth, selectedYear, fromDate, toDate },
        earliestEventDate || now,
        latestEventDate || now,
      ),
    [periodMode, selectedDay, selectedMonth, selectedYear, fromDate, toDate, earliestEventDate, latestEventDate, now],
  );

  const filteredEvents = React.useMemo(
    () => allCurrencyFilteredEvents.filter((event) => matchesPeriod(event.occurredAt, currentPeriod)),
    [allCurrencyFilteredEvents, currentPeriod],
  );

  const historicalTotals = React.useMemo(
    () => summarizeTotalsByCurrency(allCurrencyFilteredEvents),
    [allCurrencyFilteredEvents],
  );
  const filteredTotals = React.useMemo(
    () => summarizeTotalsByCurrency(filteredEvents),
    [filteredEvents],
  );

  const filteredCurrencyCodes = React.useMemo(
    () => Array.from(new Set(filteredEvents.map((event) => event.currencyCode || "AOA"))).sort(),
    [filteredEvents],
  );
  const displayMode = currencyFilter === "all" && filteredCurrencyCodes.length > 1 ? "count" : "amount";
  const primaryCurrencyCode = currencyFilter === "all" ? getPrimaryCurrencyCode(filteredTotals) : currencyFilter;

  const comparisonWindow = React.useMemo(
    () => getGrowthComparisonWindow(periodMode, currentPeriod, latestEventDate || now),
    [periodMode, currentPeriod, latestEventDate, now],
  );

  const previousEvents = React.useMemo(
    () => allCurrencyFilteredEvents.filter((event) => matchesPeriod(event.occurredAt, comparisonWindow.previous)),
    [allCurrencyFilteredEvents, comparisonWindow],
  );

  const currentMetricValue =
    displayMode === "count"
      ? filteredEvents.length
      : filteredEvents.reduce((sum, event) => sum + Number(event.totalPrice || 0), 0);
  const previousMetricValue =
    displayMode === "count"
      ? previousEvents.length
      : previousEvents.reduce((sum, event) => sum + Number(event.totalPrice || 0), 0);
  const growthPercentage =
    previousMetricValue <= 0
      ? currentMetricValue > 0
        ? Infinity
        : 0
      : ((currentMetricValue - previousMetricValue) / previousMetricValue) * 100;

  const uniquePayingClients = new Set(filteredEvents.map((event) => event.userId)).size;
  const averageTicket = filteredEvents.length
    ? filteredEvents.reduce((sum, event) => sum + Number(event.totalPrice || 0), 0) / filteredEvents.length
    : 0;
  const currentActivePaidClients = clients.filter(
    (client) =>
      client.planStatus === "active"
      && Number(client.planTotalPrice || 0) > 0
      && (currencyFilter === "all" || (client.planCurrencyCode || "AOA") === currencyFilter),
  );

  const firstFilteredPayment = filteredEvents[0] || null;
  const latestFilteredPayment = filteredEvents[filteredEvents.length - 1] || null;
  const seriesGranularity = resolveSeriesGranularity(currentPeriod);
  const series = React.useMemo(
    () => buildFinancialSeries(filteredEvents, currentPeriod, seriesGranularity),
    [filteredEvents, currentPeriod, seriesGranularity],
  );

  const planBreakdown = React.useMemo(() => {
    const grouped = new Map();
    for (const event of filteredEvents) {
      const key = event.planId || event.planCode || event.planName;
      const current = grouped.get(key) || {
        key,
        planName: event.planName || event.planCode || "Plano",
        count: 0,
        totals: new Map(),
      };
      current.count += 1;
      current.totals.set(event.currencyCode || "AOA", (current.totals.get(event.currencyCode || "AOA") || 0) + Number(event.totalPrice || 0));
      grouped.set(key, current);
    }

    return Array.from(grouped.values()).sort((left, right) => right.count - left.count);
  }, [filteredEvents]);

  const recentPayments = React.useMemo(
    () => [...filteredEvents].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()).slice(0, 12),
    [filteredEvents],
  );

  if (!normalizedEvents.length) {
    return (
      <div style={{ ...SURFACE_STYLE, padding: "22px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "13px" }}>
        Ainda nao existem ativacoes pagas para montar o controlo financeiro.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Controlo financeiro</div>
            <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
              {hasPartialDataset
                ? "Análise baseada nos registos financeiros carregados até agora. Carrega mais para aproximar o histórico completo."
                : "Evolucao financeira desde o primeiro pagamento registado ate hoje."}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Badge bg="#ecfdf5" color="#166534">
              <Wallet size={12} /> {hasPartialDataset ? `${normalizedEvents.length} de ${totalEventsCount}` : totalEventsCount} registos pagos
            </Badge>
            <Badge bg="#eff6ff" color="#1d4ed8">
              <CalendarDays size={12} /> Desde {formatDateLabel(earliestEventDate)}
            </Badge>
          </div>
        </div>

        {hasPartialDataset ? (
          <div style={{ padding: "12px 14px", borderRadius: "16px", background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", fontSize: "12px", lineHeight: 1.6 }}>
            Esta leitura usa <strong>{normalizedEvents.length}</strong> de <strong>{totalEventsCount}</strong> registos financeiros. Os totais, gráficos e tendências vão ficando mais completos conforme carregas mais histórico.
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Pesquisa
            </span>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)" }} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Loja, email, plano ou referencia..."
                style={{ ...FILTER_INPUT_STYLE, paddingLeft: "34px" }}
              />
            </div>
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Filtro
            </span>
            <select value={periodMode} onChange={(event) => setPeriodMode(event.target.value)} style={FILTER_SELECT_STYLE}>
              <option value="all">Todos</option>
              <option value="day">Dia</option>
              <option value="month">Mes</option>
              <option value="year">Ano</option>
              <option value="range">Intervalo</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Moeda
            </span>
            <select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)} style={FILTER_SELECT_STYLE}>
              <option value="all">Todas as moedas</option>
              {availableCurrencies.map((currencyCode) => (
                <option key={currencyCode} value={currencyCode}>
                  {currencyCode}
                </option>
              ))}
            </select>
          </label>

          {periodMode === "day" ? (
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Dia
              </span>
              <input type="date" value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} style={FILTER_INPUT_STYLE} />
            </label>
          ) : null}

          {periodMode === "month" ? (
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Mes
              </span>
              <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} style={FILTER_INPUT_STYLE} />
            </label>
          ) : null}

          {periodMode === "year" ? (
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Ano
              </span>
              <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} style={FILTER_SELECT_STYLE}>
                {availableYears.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {periodMode === "range" ? (
            <>
              <label style={{ display: "grid", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Desde
                </span>
                <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} style={FILTER_INPUT_STYLE} />
              </label>
              <label style={{ display: "grid", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Ate
                </span>
                <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} style={FILTER_INPUT_STYLE} />
              </label>
            </>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center", paddingTop: "4px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
            Período atual: <strong style={{ color: "var(--color-text-primary)" }}>{periodMode === "all" ? `Todo o histórico (${currentPeriod.label})` : currentPeriod.label}</strong>
          </div>
          {displayMode === "count" ? (
            <div style={{ fontSize: "12px", color: "#9a3412" }}>
              Existem varias moedas neste filtro. O grafico muda para quantidade de ativacoes para evitar somar moedas diferentes.
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Crescimento medido contra {comparisonWindow.previous.label.toLowerCase()}.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
        <FinanceMetricCard
          label={hasPartialDataset ? "Total carregado" : "Total histórico"}
          value={formatCurrencyTotals(historicalTotals)}
          hint={
            hasPartialDataset
              ? `${normalizedEvents.length} de ${totalEventsCount} registos carregados entre ${formatDateLabel(earliestEventDate)} e ${formatDateLabel(latestEventDate)}`
              : `Desde ${formatDateLabel(earliestEventDate)} ate ${formatDateLabel(latestEventDate)}`
          }
          accent={accent}
        />
        <FinanceMetricCard
          label="Total filtrado"
          value={formatCurrencyTotals(filteredTotals)}
          hint={`${filteredEvents.length} pagamento${filteredEvents.length === 1 ? "" : "s"} dentro do filtro atual`}
          accent={accent}
        />
        <FinanceMetricCard
          label="Crescimento"
          value={formatGrowthPercentage(growthPercentage)}
          hint={displayMode === "count" ? "Comparado pela quantidade de ativacoes" : "Comparado pelo valor do periodo anterior"}
          accent={accent}
        />
        <FinanceMetricCard
          label="Ticket medio"
          value={displayMode === "count" && currencyFilter === "all" && filteredCurrencyCodes.length > 1 ? "Filtra por moeda" : fmtMoney(averageTicket, primaryCurrencyCode)}
          hint="Media por ativacao paga no filtro atual"
          accent={accent}
        />
        <FinanceMetricCard
          label="Lojistas pagantes"
          value={String(uniquePayingClients)}
          hint="Lojistas unicos dentro do filtro"
          accent={accent}
        />
        <FinanceMetricCard
          label="Planos ativos hoje"
          value={String(currentActivePaidClients.length)}
          hint="Lojas com plano pago e ativo neste momento"
          accent={accent}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: "16px" }}>
        <FinancialTrendChart
          points={series}
          accent={accent}
          displayMode={displayMode}
          currencyCode={primaryCurrencyCode}
          title={displayMode === "count" ? "Evolucao das ativacoes" : "Evolucao financeira"}
          subtitle={displayMode === "count" ? "Quantidade de ativacoes por periodo dentro do filtro atual." : "Receita das ativacoes pagas dentro do filtro atual."}
        />

        <div style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Leitura rapida</div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                Datas-chave e estado atual do caixa recorrente.
              </div>
            </div>
            <Badge bg="#eff6ff" color="#1d4ed8">
              <Filter size={12} /> {periodMode === "all" ? "Historico" : "Filtro ativo"}
            </Badge>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ padding: "14px", borderRadius: "18px", background: "var(--color-background-secondary)" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Primeiro pagamento no filtro
              </div>
              <div style={{ marginTop: "6px", fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                {firstFilteredPayment ? formatDateLabel(firstFilteredPayment.occurredAt, true) : "Sem registo"}
              </div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {firstFilteredPayment ? `${firstFilteredPayment.storeName || firstFilteredPayment.merchantEmail} - ${firstFilteredPayment.planName}` : "Ajusta os filtros para encontrar um intervalo com pagamentos."}
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "18px", background: "var(--color-background-secondary)" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Ultimo pagamento no filtro
              </div>
              <div style={{ marginTop: "6px", fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                {latestFilteredPayment ? formatDateLabel(latestFilteredPayment.occurredAt, true) : "Sem registo"}
              </div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {latestFilteredPayment ? `${latestFilteredPayment.storeName || latestFilteredPayment.merchantEmail} - ${latestFilteredPayment.planName}` : "Sem atividade financeira neste recorte."}
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "18px", background: "var(--color-background-secondary)", display: "grid", gap: "6px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Base ativa hoje
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                <Users size={16} /> {currentActivePaidClients.length} loja{currentActivePaidClients.length === 1 ? "" : "s"} com plano pago ativo
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {currentActivePaidClients.length
                  ? currentActivePaidClients.slice(0, 3).map((client) => client.storeName || client.email).join(", ")
                  : "Nenhuma loja ativa neste recorte de moeda."}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: "16px" }}>
        <div style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Planos que mais vendem</div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                Distribuicao das ativacoes pagas no filtro atual.
              </div>
            </div>
            <Badge bg="#fff7ed" color="#9a3412">
              <BarChart3 size={12} /> {planBreakdown.length} plano{planBreakdown.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {planBreakdown.length ? (
            <div style={{ display: "grid", gap: "10px" }}>
              {planBreakdown.slice(0, 8).map((plan) => (
                <div key={plan.key} style={{ padding: "14px", borderRadius: "18px", background: "var(--color-background-secondary)", display: "grid", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                    <div style={{ fontSize: "15px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{plan.planName}</div>
                    <Badge bg="#ecfdf5" color="#166534">
                      <Wallet size={12} /> {plan.count} {plan.count === 1 ? "ativacao" : "ativacoes"}
                    </Badge>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{formatCurrencyTotals(plan.totals)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "18px", borderRadius: "18px", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", fontSize: "13px" }}>
              Nenhum plano corresponde aos filtros atuais.
            </div>
          )}
        </div>

        <div style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Ultimos pagamentos</div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                Historico recente das ativacoes e renovacoes pagas.
              </div>
            </div>
            <Badge bg="#eff6ff" color="#1d4ed8">
              <Store size={12} /> {recentPayments.length} registos
            </Badge>
          </div>

          {recentPayments.length ? (
            <div style={{ display: "grid", gap: "10px" }}>
              {recentPayments.map((event) => {
                const typeMeta = getEventTypeMeta(event.eventType);
                return (
                  <div key={event.id} style={{ padding: "14px", borderRadius: "18px", background: "var(--color-background-secondary)", display: "grid", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{event.storeName || event.merchantEmail}</div>
                        <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>{event.merchantEmail || "Sem email"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "15px", fontWeight: "800", fontFamily: "var(--font-display)", color: accent }}>
                          {fmtMoney(event.totalPrice, event.currencyCode || "AOA")}
                        </div>
                        <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                          {event.durationDays} dias
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <Badge bg={typeMeta.bg} color={typeMeta.color}>
                        {typeMeta.label}
                      </Badge>
                      <Badge bg="#f3f4f6" color="#475569">
                        <CalendarDays size={12} /> {formatDateLabel(event.occurredAt, true)}
                      </Badge>
                      {event.referenceId ? (
                        <Badge bg="#f3f4f6" color="#475569">
                          Ref. {event.referenceId}
                        </Badge>
                      ) : null}
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", display: "grid", gap: "3px" }}>
                      <div><strong style={{ color: "var(--color-text-primary)" }}>{event.planName}</strong> ({event.planCode || "sem código"})</div>
                      <div>Validade: {formatDateLabel(event.planStartedAt)} ate {formatDateLabel(event.planExpiresAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "18px", borderRadius: "18px", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", fontSize: "13px" }}>
              Nenhum pagamento corresponde aos filtros atuais.
            </div>
          )}

          {pageInfo.hasMore && onLoadMore ? (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: "4px" }}>
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loading}
                style={{
                  border: "none",
                  borderRadius: "999px",
                  padding: "11px 16px",
                  background: accent,
                  color: "white",
                  cursor: loading ? "wait" : "pointer",
                  fontSize: "12px",
                  fontWeight: "800",
                  minWidth: "220px",
                }}
              >
                {loading ? "A carregar..." : "Carregar mais registos"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
