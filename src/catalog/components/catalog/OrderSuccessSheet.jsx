import React from "react";
import { Check, Copy, ExternalLink, Phone, X } from "lucide-react";
import { SURFACE_STYLE } from "../../constants.js";
import { fmtMoney } from "../../utils/format.js";
import { Badge } from "../common/UiBits.jsx";
import { formatCustomerDiscountPercent, formatOrderDateTime, getOrderStatusMeta } from "../../utils/orders.js";

export default function OrderSuccessSheet({ order, trackingUrl = "", merchantNotification = null, onClose, onTrack, onOpenWhatsApp }) {
  const [copied, setCopied] = React.useState(false);
  const statusMeta = getOrderStatusMeta(order?.status);
  const deliveredByCloudApi = merchantNotification?.channel === "whatsapp_cloud_api" && merchantNotification?.delivered;
  const queuedByCloudApi = merchantNotification?.channel === "whatsapp_cloud_api" && merchantNotification?.queued;
  const cloudApiFallback = merchantNotification?.attempted && !merchantNotification?.delivered;

  async function handleCopy() {
    if (!trackingUrl || !navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (error) {}
  }

  if (!order) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 240, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "16px" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.46)" }} />
      <div data-testid="order-success-sheet" style={{ ...SURFACE_STYLE, position: "relative", width: "min(560px, 100%)", padding: "22px", borderRadius: "28px", display: "grid", gap: "16px", boxShadow: "0 24px 70px rgba(0,0,0,0.2)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "14px", right: "14px", width: "34px", height: "34px", borderRadius: "999px", border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)" }}>
          <X size={16} />
        </button>

        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontSize: "12px", fontWeight: "800", marginBottom: "12px" }}>
            <Check size={14} /> Pedido gravado com sucesso
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", fontFamily: "var(--font-display)", lineHeight: 1.08 }}>
            O teu pedido já pode ser acompanhado.
          </div>
          <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            Guarda este código e o link de acompanhamento. O lojista pode agora atualizar o estado da encomenda ao longo do processo.
          </div>
          {deliveredByCloudApi ? (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#166534", fontWeight: "700" }}>
              O pedido foi enviado automaticamente ao WhatsApp do lojista pela integracao oficial.
            </div>
          ) : null}
          {queuedByCloudApi ? (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#1d4ed8", fontWeight: "700" }}>
              O pedido entrou na fila de entrega automática e será enviado ao lojista sem bloquear a tua compra.
            </div>
          ) : null}
          {cloudApiFallback ? (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#b45309", fontWeight: "700" }}>
              A entrega automática falhou e o sistema abriu o WhatsApp como alternativa.
            </div>
          ) : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <div style={{ padding: "14px 16px", borderRadius: "20px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)" }}>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", marginBottom: "6px" }}>Código</div>
            <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-mono)" }}>{order.trackingCode}</div>
            <div style={{ marginTop: "8px" }}>
              <Badge bg={statusMeta.bg} color={statusMeta.color}>
                {statusMeta.label}
              </Badge>
            </div>
          </div>

          <div style={{ padding: "14px 16px", borderRadius: "20px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)" }}>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", marginBottom: "6px" }}>Criado em</div>
            <div style={{ fontSize: "16px", fontWeight: "800" }}>{formatOrderDateTime(order.createdAt)}</div>
            <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Estado inicial: {statusMeta.label}
            </div>
          </div>

          <div style={{ padding: "14px 16px", borderRadius: "20px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)" }}>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", marginBottom: "6px" }}>Total final</div>
            <div style={{ fontSize: "16px", fontWeight: "800" }}>{fmtMoney(order.totalAmount, order.currencyCode)}</div>
            <div style={{ marginTop: "6px", fontSize: "12px", color: order.discountAmount > 0 ? "#166534" : "var(--color-text-secondary)" }}>
              {order.discountAmount > 0
                ? `Desconto fidelidade ${formatCustomerDiscountPercent(order.discountPercent)} aplicado.`
                : "Sem desconto fidelidade neste pedido."}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          <button data-testid="order-track" onClick={onTrack} style={{ width: "100%", padding: "13px 16px", borderRadius: "16px", border: "none", background: "linear-gradient(135deg, var(--color-text-primary) 0%, #22433d 100%)", color: "white", cursor: "pointer", fontSize: "14px", fontWeight: "800", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <ExternalLink size={15} /> Acompanhar pedido
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" }}>
            <button onClick={handleCopy} disabled={!trackingUrl} style={{ padding: "11px 14px", borderRadius: "14px", border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: trackingUrl ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: trackingUrl ? 1 : 0.55 }}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Link copiado" : "Copiar link"}
            </button>

            <button onClick={onOpenWhatsApp} style={{ padding: "11px 14px", borderRadius: "14px", border: "none", background: "#25D366", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <Phone size={14} /> Abrir WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
