import React from "react";
import { ArrowLeft, Clock3, Package, Phone, Star } from "lucide-react";
import { SURFACE_STYLE } from "../../constants.js";
import { fmtMoney } from "../../utils/format.js";
import {
  buildOrderTrackingUrl,
  formatCustomerDiscountPercent,
  formatOrderDateTime,
  formatOrderDurationMs,
  getOrderReviewEligibility,
  getFulfillmentLabel,
  getOrderCurrentStatusTiming,
  getOrderRegionLabel,
  getOrderStatusMeta,
  getOrderStatusTimingMeta,
  normalizeOrderStatusTimeline,
  ORDER_STATUS_OPTIONS,
} from "../../utils/orders.js";
import { Badge } from "../common/UiBits.jsx";
import BrandMark from "../common/BrandMark.jsx";

const TIMING_VARIANT_STYLE = {
  current: { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" },
  overdue: { background: "#fff1f2", color: "#be123c", borderColor: "#fecdd3" },
  done: { background: "#ecfdf5", color: "#166534", borderColor: "#bbf7d0" },
  upcoming: { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" },
  idle: { background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", borderColor: "var(--color-border-tertiary)" },
};

function StepTimingCard({ label, timing }) {
  const variantStyle = TIMING_VARIANT_STYLE[timing.variant] || TIMING_VARIANT_STYLE.idle;

  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "20px",
        background: variantStyle.background,
        color: variantStyle.color,
        border: `1px solid ${variantStyle.borderColor}`,
        display: "grid",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
        <div style={{ fontSize: "11px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.84 }}>{label}</div>
        <Badge bg="rgba(255,255,255,0.68)" color={variantStyle.color} borderColor="rgba(255,255,255,0.3)">
          {timing.stepState === "current" ? "Atual" : timing.stepState === "done" ? "Feito" : "A seguir"}
        </Badge>
      </div>
      <div style={{ fontSize: "20px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{timing.primary}</div>
      <div style={{ fontSize: "11px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>{timing.eyebrow}</div>
      <div style={{ fontSize: "12px", lineHeight: 1.65 }}>{timing.secondary}</div>
    </div>
  );
}

function ReviewStars({ value = 0, onChange, disabled = false, color = "#f59e0b" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      {[1, 2, 3, 4, 5].map((ratingValue) => {
        const active = ratingValue <= value;
        return (
          <button
            key={ratingValue}
            type="button"
            onClick={() => onChange?.(ratingValue)}
            disabled={disabled}
            aria-label={`${ratingValue} estrela${ratingValue === 1 ? "" : "s"}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "42px",
              height: "42px",
              borderRadius: "14px",
              border: active ? `1px solid ${color}33` : "1px solid var(--color-border-tertiary)",
              background: active ? `${color}14` : "white",
              color,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.65 : 1,
            }}
          >
            <Star size={20} fill={active ? color : "none"} />
          </button>
        );
      })}
    </div>
  );
}

export default function OrderTrackingPage({
  order,
  loading = false,
  error = "",
  reviewBusy = false,
  onSubmitReview,
  onBackToStore,
}) {
  const [now, setNow] = React.useState(() => Date.now());
  const [reviewRating, setReviewRating] = React.useState(0);
  const [reviewComment, setReviewComment] = React.useState("");

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    setReviewRating(Number(order?.review?.rating || 0));
    setReviewComment(order?.review?.comment || "");
  }, [order?.id, order?.review?.rating, order?.review?.comment, order?.review?.updatedAt]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "var(--color-background-secondary)" }}>
        <div style={{ ...SURFACE_STYLE, maxWidth: "420px", width: "100%", padding: "26px", textAlign: "center" }}>
          <div style={{ fontSize: "20px", fontWeight: "800", fontFamily: "var(--font-display)" }}>A carregar encomenda...</div>
          <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
            Estamos a procurar o estado mais recente do pedido.
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "var(--color-background-secondary)" }}>
        <div style={{ ...SURFACE_STYLE, maxWidth: "460px", width: "100%", padding: "26px", textAlign: "center", display: "grid", gap: "10px" }}>
          <div style={{ fontSize: "24px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Encomenda nao encontrada</div>
          <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            {error || "O link de acompanhamento pode estar incompleto ou a encomenda ja nao existe."}
          </div>
          <button onClick={onBackToStore} style={{ marginTop: "8px", justifySelf: "center", padding: "11px 16px", borderRadius: "14px", border: "none", background: "var(--color-text-primary)", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
      </div>
    );
  }

  const store = order.store || {};
  const statusMeta = getOrderStatusMeta(order.status);
  const regionLabel = getOrderRegionLabel(store.country);
  const trackingUrl = buildOrderTrackingUrl(order.trackingToken);
  const location = [order.area, order.region].filter(Boolean).join(", ");
  const currentTiming = getOrderCurrentStatusTiming(order, now);
  const currentTimingStyle = TIMING_VARIANT_STYLE[currentTiming.variant] || TIMING_VARIANT_STYLE.idle;
  const timeline = normalizeOrderStatusTimeline(order.statusTimeline, order.status, order.createdAt, order.statusUpdatedAt);
  const deliveredEntry = timeline.find((entry) => entry.status === "delivered");
  const totalCycleEnd = deliveredEntry?.completedAt || now;
  const totalCycleMs = Math.max(0, new Date(totalCycleEnd).getTime() - new Date(order.createdAt).getTime());
  const review = order.review || null;
  const reviewEligibility = getOrderReviewEligibility(order);
  const canReviewOrder = reviewEligibility.eligible;
  const savedReviewRating = Number(review?.rating || 0);
  const savedReviewComment = String(review?.comment || "").trim();
  const normalizedDraftComment = String(reviewComment || "").trim();
  const hasSavedReview = savedReviewRating > 0;
  const hasReviewChanges = reviewRating !== savedReviewRating || normalizedDraftComment !== savedReviewComment;
  const reviewReadyToSubmit = canReviewOrder && reviewRating > 0 && (!hasSavedReview || hasReviewChanges);
  const reviewSectionTitle = canReviewOrder
    ? hasSavedReview
      ? "Atualiza a tua avaliacao desta loja"
      : "A tua compra foi concluida. Avalia esta loja"
    : "Avaliacao disponivel apos a entrega";
  const reviewSectionDescription = canReviewOrder
    ? "Escolhe as estrelas e, se quiseres, deixa um comentario. Comentarios publicados podem aparecer para outros clientes como testemunho."
    : reviewEligibility.reason;

  async function handleReviewSubmit(event) {
    event.preventDefault();
    if (!reviewReadyToSubmit || !onSubmitReview || reviewBusy || !canReviewOrder) {
      return;
    }

    await onSubmitReview(reviewRating, reviewComment);
  }

  return (
    <div data-testid="tracking-page" style={{ minHeight: "100vh", background: "var(--color-background-secondary)", fontFamily: "var(--font-sans)" }}>
      <div style={{ background: `linear-gradient(135deg, ${store.color || "#0c2522"} 0%, #0c2522 70%, #f0c978 180%)`, color: "white", padding: "24px 18px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: "240px", height: "240px", borderRadius: "999px", background: "rgba(255,255,255,0.08)", top: "-100px", right: "-60px" }} />
        <div style={{ position: "relative", maxWidth: "960px", margin: "0 auto", display: "grid", gap: "16px" }}>
          <button onClick={onBackToStore} style={{ width: "fit-content", padding: "8px 12px", borderRadius: "999px", border: "none", background: "rgba(255,255,255,0.16)", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <ArrowLeft size={14} /> Voltar para a loja
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <BrandMark brand={{ name: store.name || "Loja", logoUrl: store.logo || "", initials: "LG", accent: store.color || "#1c9a74", dark: "#0c2522" }} size={52} rounded={16} />
            <div>
              <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.78 }}>Acompanhamento da encomenda</div>
              <div style={{ fontSize: "30px", lineHeight: 1.05, fontWeight: "800", fontFamily: "var(--font-display)" }}>{store.name || "Minha Loja"}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <Badge bg={statusMeta.bg} color={statusMeta.color}>
              {statusMeta.label}
            </Badge>
            <div style={{ fontSize: "12px", opacity: 0.88 }}>Codigo: <strong>{order.trackingCode}</strong></div>
            <div style={{ fontSize: "12px", opacity: 0.88 }}>Atualizado em {formatOrderDateTime(order.statusUpdatedAt)}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "20px 18px 32px", display: "grid", gap: "16px" }}>
        <div
          style={{
            ...SURFACE_STYLE,
            padding: "20px",
            display: "grid",
            gap: "14px",
            background: currentTimingStyle.background,
            color: currentTimingStyle.color,
            border: `1px solid ${currentTimingStyle.borderColor}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "800", opacity: 0.82 }}>{currentTiming.eyebrow}</div>
              <div style={{ marginTop: "6px", fontSize: "28px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{currentTiming.primary}</div>
            </div>
            <Badge bg="rgba(255,255,255,0.72)" color={currentTimingStyle.color} borderColor="rgba(255,255,255,0.3)">
              <Clock3 size={12} /> {statusMeta.label}
            </Badge>
          </div>
          <div style={{ fontSize: "13px", lineHeight: 1.65 }}>{currentTiming.secondary}</div>
        </div>

        <div style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "14px" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Linha do pedido com tempo por etapa</div>
            <div style={{ marginTop: "6px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
              A loja define os tempos manualmente e a contagem aparece aqui em cada fase do pedido.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" }}>
            {ORDER_STATUS_OPTIONS.map((step) => (
              <StepTimingCard key={step.value} label={step.label} timing={getOrderStatusTimingMeta(order, step.value, now)} />
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          <div style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "12px" }}>
            <div style={{ fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Resumo da encomenda</div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Cliente: <strong style={{ color: "var(--color-text-primary)" }}>{order.customerName || "Nao identificado"}</strong>
            </div>
            {order.customerPhone ? (
              <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                Telefone: <strong style={{ color: "var(--color-text-primary)" }}>{order.customerPhone}</strong>
              </div>
            ) : null}
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Recebimento: <strong style={{ color: "var(--color-text-primary)" }}>{getFulfillmentLabel(order.fulfillmentType)}</strong>
            </div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              {regionLabel}: <strong style={{ color: "var(--color-text-primary)" }}>{order.region || "Nao definido"}</strong>
            </div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Area: <strong style={{ color: "var(--color-text-primary)" }}>{location || "Nao definida"}</strong>
            </div>
            {order.pickupTime ? <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Horario de retirada: <strong style={{ color: "var(--color-text-primary)" }}>{order.pickupTime}</strong></div> : null}
            {order.deliveryTime ? <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Horario de entrega: <strong style={{ color: "var(--color-text-primary)" }}>{order.deliveryTime}</strong></div> : null}
            {order.notes ? <div style={{ padding: "12px", borderRadius: "16px", background: "var(--color-background-secondary)", fontSize: "13px", lineHeight: 1.7, color: "var(--color-text-secondary)" }}>{order.notes}</div> : null}
          </div>

          <div style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "12px" }}>
            <div style={{ fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Dados de acompanhamento</div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Pedido criado em <strong style={{ color: "var(--color-text-primary)" }}>{formatOrderDateTime(order.createdAt)}</strong>
            </div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Tempo total do pedido: <strong style={{ color: "var(--color-text-primary)" }}>{formatOrderDurationMs(totalCycleMs, { includeSeconds: false, maxParts: 3 })}</strong>
            </div>
            {order.discountAmount > 0 ? (
              <>
                <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                  Subtotal: <strong style={{ color: "var(--color-text-primary)" }}>{fmtMoney(order.subtotalAmount, order.currencyCode)}</strong>
                </div>
                <div style={{ fontSize: "13px", color: "#166534" }}>
                  Desconto fidelidade ({formatCustomerDiscountPercent(order.discountPercent)}): <strong>-{fmtMoney(order.discountAmount, order.currencyCode)}</strong>
                </div>
              </>
            ) : null}
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Total da encomenda: <strong style={{ color: "var(--color-text-primary)" }}>{fmtMoney(order.totalAmount, order.currencyCode)}</strong>
            </div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Itens: <strong style={{ color: "var(--color-text-primary)" }}>{order.itemCount}</strong>
            </div>
            {store.pickupNote ? <div style={{ padding: "12px", borderRadius: "16px", background: "var(--color-background-secondary)", fontSize: "13px", lineHeight: 1.7, color: "var(--color-text-secondary)" }}><strong style={{ color: "var(--color-text-primary)" }}>Nota da loja:</strong> {store.pickupNote}</div> : null}
            {trackingUrl ? <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", wordBreak: "break-word" }}>Link: {trackingUrl}</div> : null}
          </div>
        </div>

        <div style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
            <Package size={16} /> Itens do pedido
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {(order.items || []).map((item) => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "12px", alignItems: "center", padding: "12px 14px", borderRadius: "18px", background: "var(--color-background-secondary)" }}>
                {item.productImage ? <img src={item.productImage} alt={item.productName} style={{ width: "52px", height: "52px", borderRadius: "14px", objectFit: "cover" }} /> : <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "rgba(12,37,34,0.08)" }} />}
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "700" }}>{item.productName}</div>
                  <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    {item.quantity} x {fmtMoney(item.unitPrice, order.currencyCode)}
                  </div>
                </div>
                <div style={{ fontSize: "13px", fontWeight: "800" }}>{fmtMoney(item.lineTotal, order.currencyCode)}</div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleReviewSubmit} style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "14px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
              {reviewSectionTitle}
            </div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
              {reviewSectionDescription}
            </div>
          </div>

          {!canReviewOrder ? (
            <div style={{ padding: "14px 16px", borderRadius: "18px", background: "#eff6ff", border: "1px solid #bfdbfe", display: "grid", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#1d4ed8" }}>
                Aguarda a confirmacao final da entrega
              </div>
              <div style={{ fontSize: "13px", color: "#1d4ed8", lineHeight: 1.7 }}>
                Assim que a loja marcar esta encomenda como entregue, este mesmo link fica pronto para receber a tua avaliacao.
              </div>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>
              Classificacao
            </div>
            <ReviewStars
              value={reviewRating}
              onChange={setReviewRating}
              disabled={reviewBusy || !canReviewOrder}
            />
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              {reviewRating > 0
                ? `${reviewRating} de 5 estrela${reviewRating === 1 ? "" : "s"}`
                : "Ainda nao escolheste uma classificacao."}
            </div>
          </div>

          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>
              Comentario
            </span>
            <textarea
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              maxLength={1200}
              rows={4}
              placeholder={
                canReviewOrder
                  ? "Conta a tua experiencia com o atendimento, rapidez e entrega."
                  : "A avaliacao fica disponivel quando a encomenda for entregue."
              }
              disabled={reviewBusy || !canReviewOrder}
              style={{
                width: "100%",
                minHeight: "120px",
                resize: "vertical",
                padding: "14px 16px",
                borderRadius: "18px",
                border: "1px solid var(--color-border-tertiary)",
                background: "white",
                color: "var(--color-text-primary)",
                fontSize: "13px",
                lineHeight: 1.6,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </label>

          {review ? (
            <div style={{ padding: "14px 16px", borderRadius: "18px", background: "var(--color-background-secondary)", display: "grid", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "var(--color-text-primary)" }}>
                Avaliacao atual guardada
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {review.rating} estrela{review.rating === 1 ? "" : "s"}
                {review.updatedAt ? ` · Atualizada em ${formatOrderDateTime(review.updatedAt)}` : ""}
              </div>
              {review.comment ? (
                <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                  "{review.comment}"
                </div>
              ) : (
                <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                  Guardaste a classificacao em estrelas. Podes acrescentar um comentario quando quiseres.
                </div>
              )}
            </div>
          ) : null}

          {hasSavedReview && !hasReviewChanges ? (
            <div style={{ padding: "14px 16px", borderRadius: "18px", background: "#ecfdf5", border: "1px solid #bbf7d0", display: "grid", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#166534" }}>
                A tua avaliacao ja esta guardada
              </div>
              <div style={{ fontSize: "13px", color: "#166534", lineHeight: 1.7 }}>
                Se quiseres mudar as estrelas ou o comentario, edita os campos acima e toca em atualizar.
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              {!canReviewOrder
                ? reviewEligibility.reason
                : hasSavedReview && !hasReviewChanges
                ? "Avaliacao confirmada neste link."
                : review
                  ? "Podes atualizar a tua avaliacao sempre que precisares neste mesmo link."
                  : "A tua opiniao ajuda a loja a melhorar e aumenta a confianca de novos clientes."}
            </div>
            <button
              type="submit"
              disabled={reviewBusy || !reviewReadyToSubmit}
              style={{
                padding: "12px 18px",
                borderRadius: "16px",
                border: "none",
                background: store.color || "#1c9a74",
                color: "white",
                cursor: reviewBusy || !reviewReadyToSubmit ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: "800",
                opacity: reviewBusy || !reviewReadyToSubmit ? 0.68 : 1,
              }}
            >
              {reviewBusy
                ? "A guardar avaliacao..."
                : !canReviewOrder
                  ? "Aguarda entrega"
                : hasSavedReview && !hasReviewChanges
                  ? "Avaliacao guardada"
                  : review
                    ? "Atualizar avaliacao"
                    : "Enviar avaliacao"}
            </button>
          </div>
        </form>

        {store.whatsapp ? (
          <a href={`https://wa.me/${String(store.whatsapp).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ ...SURFACE_STYLE, padding: "16px 18px", textDecoration: "none", color: "inherit", display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content" }}>
            <Phone size={15} /> Falar com a loja no WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}
