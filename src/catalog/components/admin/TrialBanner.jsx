import React from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  Store,
  Wallet,
} from "lucide-react";
import { buildPlanActivationLink, getPlanAccessState } from "../../utils/catalog.js";

function formatDateLabel(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDaysRemaining(value) {
  if (!value) return 0;

  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) return 0;

  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const expiryDay = new Date(expiresAt.getFullYear(), expiresAt.getMonth(), expiresAt.getDate()).getTime();
  return Math.ceil((expiryDay - todayDay) / (1000 * 60 * 60 * 24));
}

function getTrialLimitCopy(maxFreeProducts, productCount) {
  const numericLimit = Number(maxFreeProducts);

  if (!Number.isInteger(numericLimit) || numericLimit <= 0) {
    return "";
  }

  return `Plano Trial: ate ${numericLimit} produtos. Estas com ${productCount || 0}.`;
}

function ActionButton({ as = "button", children, tone = "light", href = "", onClick }) {
  const sharedStyle = {
    border: "none",
    borderRadius: "16px",
    padding: "12px 18px",
    fontSize: "13px",
    fontWeight: "800",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    textDecoration: "none",
    cursor: "pointer",
    boxShadow:
      tone === "light"
        ? "0 16px 38px rgba(0,0,0,0.16)"
        : "inset 0 1px 0 rgba(255,255,255,0.08)",
    background:
      tone === "light"
        ? "white"
        : tone === "danger"
          ? "rgba(127, 29, 29, 0.24)"
          : "rgba(255,255,255,0.12)",
    color: tone === "light" ? "#0f172a" : "white",
    borderColor: tone === "light" ? "transparent" : "rgba(255,255,255,0.16)",
  };

  if (as === "a") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={sharedStyle}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} style={sharedStyle}>
      {children}
    </button>
  );
}

export default function TrialBanner({
  planStatus,
  planExpiresAt,
  storeId,
  storeName,
  referenceId,
  supportWhatsApp,
  maxFreeProducts,
  productCount,
  planAccessMessage,
  onOpenPlans,
  activeRequest = null,
}) {
  if (!planStatus && !planExpiresAt) return null;

  const planAccess = getPlanAccessState(planStatus, planExpiresAt);
  const normalizedStatus = String(planStatus || "").trim().toLowerCase();
  const displayId = referenceId || String(storeId || "").slice(0, 8).toUpperCase();
  const waLink = buildPlanActivationLink({
    supportWhatsApp,
    storeName,
    referenceId,
    storeId,
  });
  const canOpenPlans = typeof onOpenPlans === "function";
  const hasActivationRequest = Boolean(activeRequest?.id || activeRequest?.status);
  const primaryActionLabel = hasActivationRequest
    ? "Continuar ativacao do plano"
    : "Sinalizar ativacao do plano";
  const expiryLabel = formatDateLabel(planExpiresAt);
  const trialLimitCopy = getTrialLimitCopy(maxFreeProducts, productCount);

  if (!planAccess.allowed) {
    const inactiveTitle =
      normalizedStatus === "trial"
        ? "O trial terminou e a tua loja ficou inativa para clientes."
        : normalizedStatus === "past_due"
          ? "A loja esta inativa porque o plano entrou em atraso."
          : normalizedStatus === "canceled"
            ? "A loja esta inativa porque o plano foi cancelado."
            : "O prazo do plano terminou e a loja ficou inativa.";
    const inactiveDetail =
      planAccessMessage
      || "A vitrine publica fica bloqueada e as areas de catalogo so voltam ao normal depois da reativacao.";
    const statusLabel =
      normalizedStatus === "trial"
        ? "Trial expirado"
        : normalizedStatus === "past_due"
          ? "Pagamento em atraso"
          : normalizedStatus === "canceled"
            ? "Plano cancelado"
            : "Plano expirado";

    return (
      <div style={{ padding: "20px 20px 0" }}>
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "30px",
            padding: "22px",
            color: "white",
            background: "linear-gradient(135deg, rgba(69,10,10,0.98) 0%, rgba(127,29,29,0.96) 48%, rgba(180,83,9,0.94) 100%)",
            boxShadow: "0 28px 70px rgba(127, 29, 29, 0.28)",
          }}
        >
          <div style={{ position: "absolute", width: "220px", height: "220px", borderRadius: "999px", background: "rgba(255,255,255,0.08)", top: "-110px", right: "-48px" }} />
          <div style={{ position: "absolute", width: "160px", height: "160px", borderRadius: "999px", background: "rgba(251,191,36,0.14)", bottom: "-62px", left: "-28px" }} />

          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" }}>
            <div style={{ display: "grid", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 14px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", fontSize: "11px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  <ShieldAlert size={14} /> Loja inativa
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 14px", borderRadius: "999px", background: "rgba(254,226,226,0.18)", fontSize: "11px", fontWeight: "800" }}>
                  <AlertCircle size={14} /> {statusLabel}
                </span>
                {hasActivationRequest ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 14px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", fontSize: "11px", fontWeight: "800" }}>
                    <Wallet size={14} /> Pedido de ativacao em curso
                  </span>
                ) : null}
              </div>

              <div style={{ fontSize: "31px", lineHeight: 1.04, fontWeight: "800", fontFamily: "var(--font-display)", maxWidth: "700px" }}>
                {inactiveTitle}
              </div>

              <div style={{ fontSize: "13px", lineHeight: 1.75, color: "rgba(255,255,255,0.86)", maxWidth: "660px" }}>
                {inactiveDetail}
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {canOpenPlans ? (
                  <ActionButton onClick={onOpenPlans}>
                    <Wallet size={15} /> {primaryActionLabel} <ArrowRight size={14} />
                  </ActionButton>
                ) : waLink ? (
                  <ActionButton as="a" href={waLink}>
                    <Wallet size={15} /> {primaryActionLabel} <ExternalLink size={14} />
                  </ActionButton>
                ) : null}

                {canOpenPlans && waLink ? (
                  <ActionButton as="a" href={waLink} tone="danger">
                    <ExternalLink size={14} /> Falar com suporte
                  </ActionButton>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "9px 13px", borderRadius: "999px", background: "rgba(15,23,42,0.24)", fontSize: "12px", fontWeight: "700" }}>
                  <Store size={14} /> Vitrine publica pausada
                </span>
                {expiryLabel ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "9px 13px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", fontSize: "12px", fontWeight: "700" }}>
                    <Clock size={14} /> Expirou em {expiryLabel}
                  </span>
                ) : null}
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "9px 13px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", fontSize: "12px", fontWeight: "700" }}>
                  ID <strong>{displayId}</strong>
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ padding: "18px", borderRadius: "24px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.76, marginBottom: "8px" }}>
                  O que acontece agora
                </div>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", lineHeight: 1.6 }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                    Clientes deixam de abrir a vitrine enquanto o plano estiver inativo.
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", lineHeight: 1.6 }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                    O painel avisa em todas as areas para acelerar a reativacao.
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", lineHeight: 1.6 }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                    Assim que o plano for aprovado, a loja volta ao ar automaticamente.
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                <div style={{ padding: "16px", borderRadius: "20px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.72 }}>Estado</div>
                  <div style={{ marginTop: "7px", fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Inativa</div>
                  <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.84 }}>Loja bloqueada para clientes.</div>
                </div>

                <div style={{ padding: "16px", borderRadius: "20px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.72 }}>Proximo passo</div>
                  <div style={{ marginTop: "7px", fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                    {hasActivationRequest ? "Continuar" : "Reativar"}
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.84 }}>
                    {hasActivationRequest ? "Segue o pedido que ja foi aberto." : "Escolhe um plano e gera o pedido."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (normalizedStatus !== "trial" || !planExpiresAt) return null;

  const diffDays = getDaysRemaining(planExpiresAt);
  if (diffDays <= 0) return null;

  return (
    <div style={{ padding: "20px 20px 0" }}>
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "26px",
          padding: "18px 20px",
          color: "#7c2d12",
          background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 46%, #fef3c7 100%)",
          border: "1px solid #fed7aa",
          boxShadow: "0 18px 40px rgba(194, 65, 12, 0.1)",
        }}
      >
        <div style={{ position: "absolute", width: "180px", height: "180px", borderRadius: "999px", background: "rgba(255,255,255,0.42)", top: "-92px", right: "-32px" }} />

        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", alignItems: "center" }}>
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 13px", borderRadius: "999px", background: "rgba(255,255,255,0.68)", width: "fit-content", fontSize: "11px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              <Clock size={14} /> Trial a terminar
            </div>

            <div style={{ fontSize: "24px", lineHeight: 1.08, fontWeight: "800", fontFamily: "var(--font-display)", color: "#7c2d12" }}>
              Tens {diffDays} {diffDays === 1 ? "dia" : "dias"} antes da loja precisar de um plano ativo.
            </div>

            <div style={{ fontSize: "13px", lineHeight: 1.7, color: "#9a3412", maxWidth: "680px" }}>
              Prepara a reativacao com antecedencia para a vitrine nao sair do ar. {trialLimitCopy || "Escolhe o plano com calma e deixa o pagamento pronto dentro do painel."}
            </div>
          </div>

          <div style={{ display: "grid", gap: "10px", justifyItems: "start" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "9px 13px", borderRadius: "999px", background: "rgba(255,255,255,0.68)", fontSize: "12px", fontWeight: "700" }}>
                <Clock size={14} /> Expira em {expiryLabel || "breve"}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "9px 13px", borderRadius: "999px", background: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: "700" }}>
                ID <strong>{displayId}</strong>
              </span>
            </div>

            {canOpenPlans ? (
              <button
                type="button"
                onClick={onOpenPlans}
                style={{
                  background: "#9a3412",
                  color: "white",
                  padding: "12px 18px",
                  borderRadius: "16px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: "800",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  boxShadow: "0 16px 34px rgba(154, 52, 18, 0.18)",
                }}
              >
                <Wallet size={15} /> Escolher plano agora <ArrowRight size={14} />
              </button>
            ) : waLink ? (
              <ActionButton as="a" href={waLink} tone="danger">
                <Wallet size={15} /> Assinar agora <ExternalLink size={14} />
              </ActionButton>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
