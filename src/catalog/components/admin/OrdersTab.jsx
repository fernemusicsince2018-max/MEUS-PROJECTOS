import React from "react";
import { Clock3, Package, RefreshCw, TrendingUp } from "lucide-react";
import { SURFACE_STYLE } from "../../constants.js";
import { fmtMoney } from "../../utils/format.js";
import {
  buildOrderStatusDurationMap,
  formatOrderDateTime,
  formatCustomerDiscountPercent,
  formatCustomerOrderCount,
  getFulfillmentLabel,
  getOrderCurrentStatusTiming,
  getOrderRegionLabel,
  getOrderStatusMeta,
  getOrderStatusTimingMeta,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_OPTIONS,
} from "../../utils/orders.js";
import { Badge, StatTile } from "../common/UiBits.jsx";
import { EMPTY_MERCHANT_ORDER_SUMMARY } from "../../../../shared/orderAnalytics.js";
import { EMPTY_MERCHANT_ORDERS_PAGE_INFO } from "../../../../shared/merchantOrdersPagination.js";

const STATUS_BUTTON_STYLE = {
  borderRadius: "12px",
  padding: "9px 10px",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer",
  border: "1px solid transparent",
};

const TIMER_INPUT_STYLE = {
  width: "100%",
  padding: "9px 10px",
  borderRadius: "12px",
  border: "1px solid var(--color-border-tertiary)",
  background: "rgba(255,255,255,0.86)",
  color: "var(--color-text-primary)",
  fontSize: "12px",
  fontWeight: "600",
};

const TIMING_VARIANT_STYLE = {
  current: { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" },
  overdue: { background: "#fff1f2", color: "#be123c", borderColor: "#fecdd3" },
  done: { background: "#ecfdf5", color: "#166534", borderColor: "#bbf7d0" },
  upcoming: { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" },
  idle: { background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", borderColor: "var(--color-border-tertiary)" },
};

function createCalendarDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatGrowthLabel(growth) {
  if (growth?.mode === "new") return "Novo";
  const percentage = Number(growth?.percentage || 0);
  const prefix = percentage > 0 ? "+" : "";
  return `${prefix}${percentage.toFixed(1)}%`;
}

function MiniRevenueChart({ points = [], currencyCode = "AOA", color = "#16a34a" }) {
  const maxValue = Math.max(1, ...points.map((point) => point.total));

  return (
    <div style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Crescimento financeiro</div>
          <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
            Volume financeiro dos ultimos 7 dias com base nos pedidos recebidos.
          </div>
        </div>
        <Badge bg="#ecfdf5" color="#166534">
          <TrendingUp size={12} /> Ultimos 7 dias
        </Badge>
      </div>

      {points.length ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`, gap: "10px", alignItems: "end", minHeight: "180px" }}>
          {points.map((point) => {
            const barHeight = Math.max(18, (point.total / maxValue) * 132);
            return (
              <div key={point.key} style={{ display: "grid", gap: "8px", alignItems: "end" }}>
                <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", textAlign: "center" }}>
                  {fmtMoney(point.total, currencyCode)}
                </div>
                <div
                  title={`${point.label}: ${fmtMoney(point.total, currencyCode)}`}
                  style={{
                    height: `${barHeight}px`,
                    borderRadius: "18px 18px 10px 10px",
                    background: `linear-gradient(180deg, ${color} 0%, ${color}cc 100%)`,
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
          Ainda nao existem pedidos suficientes para desenhar o grafico.
        </div>
      )}
    </div>
  );
}

function StatusStepCard({
  order,
  option,
  timing,
  draftValue,
  onDraftChange,
  onApply,
  busy = false,
}) {
  const variantStyle = TIMING_VARIANT_STYLE[timing.variant] || TIMING_VARIANT_STYLE.idle;
  const active = order.status === option.value;

  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "20px",
        background: variantStyle.background,
        color: variantStyle.color,
        border: `1px solid ${variantStyle.borderColor}`,
        display: "grid",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <div style={{ fontSize: "12px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.84 }}>{option.label}</div>
          <div style={{ marginTop: "6px", fontSize: "19px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{timing.primary}</div>
        </div>
        <Badge bg="rgba(255,255,255,0.65)" color={variantStyle.color} borderColor="rgba(255,255,255,0.3)">
          {active ? "Atual" : timing.stepState === "done" ? "Feito" : "Planeado"}
        </Badge>
      </div>

      <div style={{ fontSize: "11px", fontWeight: "800", opacity: 0.82, textTransform: "uppercase", letterSpacing: "0.08em" }}>{timing.eyebrow}</div>
      <div style={{ fontSize: "12px", lineHeight: 1.6, opacity: 0.95 }}>{timing.secondary}</div>

      <div style={{ display: "grid", gap: "6px" }}>
        <div style={{ fontSize: "11px", fontWeight: "700", opacity: 0.84 }}>Tempo manual desta etapa</div>
        <input
          type="number"
          min="0"
          step="1"
          value={draftValue}
          onChange={(event) => onDraftChange(option.value, event.target.value)}
          placeholder="Minutos"
          style={TIMER_INPUT_STYLE}
        />
      </div>

      <button
        type="button"
        onClick={() => onApply(option.value)}
        disabled={busy}
        style={{
          ...STATUS_BUTTON_STYLE,
          background: active ? "rgba(255,255,255,0.9)" : "white",
          color: variantStyle.color,
          borderColor: "rgba(255,255,255,0.45)",
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.65 : 1,
        }}
      >
        {active ? "Atualizar tempo desta etapa" : `Entrar em ${option.label}`}
      </button>
    </div>
  );
}

export default function OrdersTab({
  orders = [],
  summary = EMPTY_MERCHANT_ORDER_SUMMARY,
  pageInfo = EMPTY_MERCHANT_ORDERS_PAGE_INFO,
  store,
  color,
  loading = false,
  loadingMore = false,
  onRefresh,
  onLoadMore,
  onChangeStatus,
  onSaveCustomerDiscount,
  busyOrderId = "",
  busyCustomerKey = "",
}) {
  const [timerDrafts, setTimerDrafts] = React.useState({});
  const [customerDiscountDrafts, setCustomerDiscountDrafts] = React.useState({});
  const [now, setNow] = React.useState(() => Date.now());
  const regionLabel = getOrderRegionLabel(store?.country);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);
  const currentDayKey = React.useMemo(() => createCalendarDayKey(now), [now]);

  React.useEffect(() => {
    setTimerDrafts((previous) => {
      const next = {};
      for (const order of orders) {
        const syncKey = `${order.updatedAt || ""}|${order.statusUpdatedAt || ""}|${order.status}`;
        const serverValues = buildOrderStatusDurationMap(order);
        if (previous[order.id]?.syncKey === syncKey) {
          next[order.id] = previous[order.id];
          continue;
        }

        next[order.id] = {
          syncKey,
          values: serverValues,
        };
      }
      return next;
    });
  }, [orders]);

  React.useEffect(() => {
    setCustomerDiscountDrafts((previous) => {
      const next = {};
      const seenKeys = new Set();

      for (const order of orders) {
        const customerKey = order?.customer?.customerKey || order?.customerKey || "";
        if (!customerKey || seenKeys.has(customerKey)) continue;
        seenKeys.add(customerKey);

        const syncKey = `${order?.customer?.updatedAt || ""}|${order?.customer?.loyaltyDiscountPercent ?? 0}`;
        if (previous[customerKey]?.syncKey === syncKey) {
          next[customerKey] = previous[customerKey];
          continue;
        }

        next[customerKey] = {
          syncKey,
          value: order?.customer?.loyaltyDiscountPercent ?? 0,
        };
      }

      return next;
    });
  }, [orders]);

  const statusCounts = summary?.statusCounts || EMPTY_MERCHANT_ORDER_SUMMARY.statusCounts;
  const todaySummary = summary?.today || EMPTY_MERCHANT_ORDER_SUMMARY.today;
  const growth = summary?.growth || EMPTY_MERCHANT_ORDER_SUMMARY.growth;
  const revenueSeries = Array.isArray(summary?.revenueSeries) ? summary.revenueSeries : [];
  const loadedOrdersCount = orders.length;
  const totalOrdersCount = Number(pageInfo?.total || summary?.totalCount || loadedOrdersCount);

  const todayOrders = React.useMemo(
    () => orders.filter((order) => createCalendarDayKey(order.createdAt) === currentDayKey),
    [orders, currentDayKey],
  );
  const historicalOrders = React.useMemo(
    () => orders.filter((order) => createCalendarDayKey(order.createdAt) !== currentDayKey),
    [orders, currentDayKey],
  );

  function getDraftValues(orderId) {
    return timerDrafts[orderId]?.values || {};
  }

  function buildStatusDurationsPayload(orderId) {
    const values = getDraftValues(orderId);
    return ORDER_STATUS_FLOW.reduce((accumulator, status) => {
      accumulator[status] = values[status] ?? "";
      return accumulator;
    }, {});
  }

  function updateDraft(orderId, status, value) {
    setTimerDrafts((previous) => ({
      ...previous,
      [orderId]: {
        syncKey: previous[orderId]?.syncKey || "",
        values: {
          ...(previous[orderId]?.values || {}),
          [status]: value,
        },
      },
    }));
  }

  function getCustomerDiscountDraft(customerKey, fallbackValue = 0) {
    return customerDiscountDrafts[customerKey]?.value ?? fallbackValue;
  }

  function updateCustomerDiscountDraft(customerKey, value) {
    setCustomerDiscountDrafts((previous) => ({
      ...previous,
      [customerKey]: {
        syncKey: previous[customerKey]?.syncKey || "",
        value,
      },
    }));
  }

  function renderOrderCard(order) {
    const statusMeta = getOrderStatusMeta(order.status);
    const location = [order.area, order.region].filter(Boolean).join(", ");
    const isUpdating = busyOrderId === order.id;
    const currentTiming = getOrderCurrentStatusTiming(order, now);
    const currentTimingStyle = TIMING_VARIANT_STYLE[currentTiming.variant] || TIMING_VARIANT_STYLE.idle;
    const draftValues = getDraftValues(order.id);
    const customerProfile = order.customer || null;
    const customerKey = customerProfile?.customerKey || order.customerKey || "";
    const customerPhone = customerProfile?.customerPhone || order.customerPhone || "";
    const customerOrderCount = Math.max(0, Number(customerProfile?.orderCount || 0));
    const customerDiscountValue = getCustomerDiscountDraft(customerKey, customerProfile?.loyaltyDiscountPercent ?? 0);
    const isSavingCustomer = busyCustomerKey === customerKey || busyCustomerKey === order.id;

    return (
      <div key={order.id} style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                {order.customerName || "Cliente sem nome"}
              </div>
              <Badge bg={statusMeta.bg} color={statusMeta.color}>
                {statusMeta.label}
              </Badge>
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Pedido <strong>{order.trackingCode}</strong> criado em {formatOrderDateTime(order.createdAt)}
            </div>
          </div>

          <div style={{ minWidth: "200px", padding: "12px 14px", borderRadius: "18px", background: "var(--color-background-secondary)" }}>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", marginBottom: "6px" }}>Total final</div>
            <div style={{ fontSize: "20px", fontWeight: "800", color }}>{fmtMoney(order.totalAmount, order.currencyCode)}</div>
            {order.discountAmount > 0 ? (
              <>
                <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  Subtotal: {fmtMoney(order.subtotalAmount, order.currencyCode)}
                </div>
                <div style={{ marginTop: "2px", fontSize: "12px", color: "#166534", fontWeight: "700" }}>
                  Desconto fidelidade: -{fmtMoney(order.discountAmount, order.currencyCode)}
                </div>
              </>
            ) : null}
            <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>{order.itemCount} item(ns)</div>
          </div>
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: "22px",
            background: currentTimingStyle.background,
            color: currentTimingStyle.color,
            border: `1px solid ${currentTimingStyle.borderColor}`,
            display: "grid",
            gap: "6px",
          }}
        >
          <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "800", opacity: 0.84 }}>
            {currentTiming.eyebrow}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: "22px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{currentTiming.primary}</div>
            <Badge bg="rgba(255,255,255,0.74)" color={currentTimingStyle.color} borderColor="rgba(255,255,255,0.3)">
              <Clock3 size={12} /> {statusMeta.label}
            </Badge>
          </div>
          <div style={{ fontSize: "12px", lineHeight: 1.6 }}>{currentTiming.secondary}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          <div style={{ padding: "14px", borderRadius: "18px", background: "var(--color-background-secondary)" }}>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", marginBottom: "8px" }}>Entrega</div>
            <div style={{ fontSize: "13px", fontWeight: "700" }}>{getFulfillmentLabel(order.fulfillmentType)}</div>
            <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--color-text-secondary)" }}>{regionLabel}: {order.region || "Nao definido"}</div>
            <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>Area: {location || "Nao definida"}</div>
            {order.pickupTime ? <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>Retirada: {order.pickupTime}</div> : null}
            {order.deliveryTime ? <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>Entrega: {order.deliveryTime}</div> : null}
          </div>

          <div style={{ padding: "14px", borderRadius: "18px", background: "var(--color-background-secondary)" }}>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", marginBottom: "8px" }}>Itens</div>
            <div style={{ display: "grid", gap: "6px" }}>
              {(order.items || []).map((item) => (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                  {item.productImage ? (
                    <img
                      src={item.productImage}
                      alt={item.productName}
                      style={{ width: "38px", height: "38px", borderRadius: "12px", objectFit: "cover", border: "0.5px solid var(--color-border-tertiary)" }}
                    />
                  ) : (
                    <div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "rgba(12,37,34,0.08)" }} />
                  )}
                  <div style={{ display: "grid", gap: "2px" }}>
                    <span style={{ fontWeight: "700" }}>{item.quantity}x {item.productName}</span>
                    <span style={{ color: "var(--color-text-secondary)" }}>{fmtMoney(item.unitPrice, order.currencyCode)} cada</span>
                  </div>
                  <strong>{fmtMoney(item.lineTotal, order.currencyCode)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: "14px", borderRadius: "18px", background: "var(--color-background-secondary)", display: "grid", gap: "10px" }}>
            <div>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", marginBottom: "8px" }}>Cliente fidelizado</div>
              <div style={{ fontSize: "13px", fontWeight: "700" }}>{customerPhone || "Sem telefone identificado"}</div>
              <div style={{ marginTop: "6px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Badge bg={customerOrderCount > 1 ? "#dcfce7" : "#f3f4f6"} color={customerOrderCount > 1 ? "#166534" : "#475569"}>
                  {customerOrderCount > 1 ? `Cliente fiel · ${formatCustomerOrderCount(customerOrderCount)}` : "Primeiro pedido"}
                </Badge>
                {customerProfile?.loyaltyDiscountPercent > 0 ? (
                  <Badge bg="#ecfdf5" color="#166534">
                    Desconto atual {formatCustomerDiscountPercent(customerProfile.loyaltyDiscountPercent)}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", opacity: 0.84 }}>Desconto manual deste cliente (%)</div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={customerDiscountValue}
                onChange={(event) => updateCustomerDiscountDraft(customerKey, event.target.value)}
                placeholder="0"
                style={TIMER_INPUT_STYLE}
                disabled={!customerKey}
              />
            </div>

            <button
              type="button"
              onClick={() => onSaveCustomerDiscount?.(order.id, customerKey, customerDiscountValue)}
              disabled={!customerKey || !onSaveCustomerDiscount || isSavingCustomer}
              style={{
                ...STATUS_BUTTON_STYLE,
                background: customerKey ? color : "var(--color-background-secondary)",
                color: customerKey ? "white" : "var(--color-text-secondary)",
                borderColor: customerKey ? color : "var(--color-border-tertiary)",
                opacity: isSavingCustomer ? 0.65 : 1,
                cursor: !customerKey || isSavingCustomer ? "not-allowed" : "pointer",
              }}
            >
              {isSavingCustomer ? "A guardar..." : "Guardar desconto do cliente"}
            </button>

            {order.discountAmount > 0 ? (
              <div style={{ fontSize: "12px", color: "#166534", lineHeight: 1.6 }}>
                Este pedido ja recebeu {formatCustomerDiscountPercent(order.discountPercent)} de desconto fidelidade.
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                O desconto guardado aqui sera aplicado automaticamente nas proximas compras deste mesmo numero.
              </div>
            )}
          </div>
        </div>

        {order.notes ? (
          <div style={{ padding: "13px 14px", borderRadius: "18px", background: "rgba(12,37,34,0.04)", color: "var(--color-text-secondary)", fontSize: "13px", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--color-text-primary)" }}>Observacoes:</strong> {order.notes}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Tempo por estado</div>
            <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Define os minutos manualmente e ativa cada etapa. O cliente acompanha a mesma contagem.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            {ORDER_STATUS_OPTIONS.map((option) => (
              <StatusStepCard
                key={option.value}
                order={order}
                option={option}
                timing={getOrderStatusTimingMeta(order, option.value, now)}
                draftValue={draftValues[option.value] ?? ""}
                onDraftChange={(status, value) => updateDraft(order.id, status, value)}
                onApply={(nextStatus) => onChangeStatus(order.id, nextStatus, { statusDurations: buildStatusDurationsPayload(order.id) })}
                busy={isUpdating}
              />
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
              Ultima atualizacao: {formatOrderDateTime(order.statusUpdatedAt)}
            </div>
            <button
              type="button"
              onClick={() => onChangeStatus(order.id, order.status, { statusDurations: buildStatusDurationsPayload(order.id) })}
              disabled={isUpdating}
              style={{
                ...STATUS_BUTTON_STYLE,
                background: color,
                color: "white",
                borderColor: color,
                minWidth: "200px",
                opacity: isUpdating ? 0.65 : 1,
                cursor: isUpdating ? "not-allowed" : "pointer",
              }}
            >
              Guardar tempos deste pedido
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderOrderSection(title, description, sectionOrders) {
    if (!sectionOrders.length) return null;

    return (
      <div style={{ display: "grid", gap: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{title}</div>
            <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>{description}</div>
          </div>
          <Badge bg="#eff6ff" color="#1d4ed8">
            <Package size={12} /> {sectionOrders.length} pedido(s)
          </Badge>
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          {sectionOrders.map((order) => renderOrderCard(order))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: "700" }}>Pedidos da loja</div>
          <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
            Controla o andamento de cada encomenda, define tempos manuais por etapa e deixa o cliente acompanhar a contagem.
            {totalOrdersCount > 0 ? ` A mostrar ${loadedOrdersCount} de ${totalOrdersCount} pedido(s).` : ""}
          </div>
        </div>

        <button onClick={onRefresh} disabled={loading} style={{ padding: "10px 14px", borderRadius: "14px", border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: loading ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px", opacity: loading ? 0.6 : 1 }}>
          <RefreshCw size={14} /> {loading ? "A carregar..." : "Atualizar"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
        <StatTile label="Total" value={summary?.totalCount ?? orders.length} hint="encomendas" color={color} />
        <StatTile label="Pendente" value={statusCounts.pending} hint="por iniciar" color={color} />
        <StatTile label="Em curso" value={statusCounts.inProgress} hint="em preparacao" color={color} />
        <StatTile label="A caminho" value={statusCounts.onTheWay} hint="em entrega" color={color} />
        <StatTile label="Entregue" value={statusCounts.delivered} hint="concluidas" color={color} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        <StatTile label="Pedidos de hoje" value={todaySummary.count} hint="mantem as concluidas aqui" color={color} />
        <StatTile label="Receita de hoje" value={fmtMoney(todaySummary.revenue, store?.currencyCode || "AOA")} hint="volume dos pedidos do dia" color={color} />
        <StatTile label="Concluidos hoje" value={todaySummary.deliveredCount} hint="entregues no dia atual" color={color} />
        <StatTile label="Crescimento 7 dias" value={formatGrowthLabel(growth)} hint="comparado aos 7 dias anteriores" color={color} />
      </div>

      <MiniRevenueChart points={revenueSeries} currencyCode={store?.currencyCode || "AOA"} color={color} />

      {orders.length === 0 ? (
        <div style={{ ...SURFACE_STYLE, padding: "32px 24px", textAlign: "center", color: "var(--color-text-secondary)" }}>
          <Package size={34} style={{ marginBottom: "10px", opacity: 0.35 }} />
          <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-text-primary)" }}>Ainda nao existem encomendas</div>
          <div style={{ marginTop: "6px", fontSize: "13px", lineHeight: 1.7 }}>
            Quando um cliente finalizar um pedido, ele aparece aqui com o estado inicial pendente.
          </div>
        </div>
      ) : (
        <>
          {renderOrderSection(
            "Pedidos de hoje",
            "Todos os pedidos criados hoje continuam aqui, incluindo os que ja foram concluidos.",
            todayOrders,
          )}
          {renderOrderSection(
            "Historico recente",
            "Pedidos de dias anteriores para consulta e acompanhamento.",
            historicalOrders,
          )}
          <div style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "10px", justifyItems: "center", textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              {pageInfo?.hasMore
                ? `Ja carregamos ${loadedOrdersCount} de ${totalOrdersCount} pedidos.`
                : `Todos os ${loadedOrdersCount} pedido(s) disponiveis nesta conta ja foram carregados.`}
            </div>
            {pageInfo?.hasMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore || loading || !onLoadMore}
                style={{
                  ...STATUS_BUTTON_STYLE,
                  background: color,
                  color: "white",
                  borderColor: color,
                  minWidth: "220px",
                  opacity: loadingMore ? 0.65 : 1,
                  cursor: loadingMore || loading || !onLoadMore ? "not-allowed" : "pointer",
                }}
              >
                {loadingMore ? "A carregar mais..." : "Carregar mais pedidos"}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
