import React from "react";
import { AlertCircle, ArrowRight, Clock, ExternalLink } from "lucide-react";
import { buildPlanActivationLink, getPlanAccessState } from "../../utils/catalog.js";

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
}) {
  if (!planStatus && !planExpiresAt) return null;

  const planAccess = getPlanAccessState(planStatus, planExpiresAt);
  const displayId = referenceId || String(storeId || "").slice(0, 8).toUpperCase();
  const waLink = buildPlanActivationLink({
    supportWhatsApp,
    storeName,
    referenceId,
    storeId,
  });
  const canOpenPlans = typeof onOpenPlans === "function";

  if (!planAccess.allowed) {
    return (
      <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "12px 20px", borderBottom: "1px solid #fecaca" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: "700" }}>
              <AlertCircle size={16} />
              {planAccessMessage || planAccess.message}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.85 }}>
              Continuas com acesso ao painel, mas o catalogo publico e a gestao de produtos ficam bloqueados ate ativares um plano.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "11px", opacity: 0.8 }}>ID: <strong>{displayId}</strong></div>
            {canOpenPlans ? (
              <button type="button" onClick={onOpenPlans} style={{ background: "#b91c1c", color: "white", padding: "8px 16px", borderRadius: "8px", border: "none", textDecoration: "none", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                Escolher plano <ArrowRight size={14} />
              </button>
            ) : waLink ? (
              <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ background: "#b91c1c", color: "white", padding: "8px 16px", borderRadius: "8px", textDecoration: "none", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                Ativar plano agora <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (planStatus !== "trial" || !planExpiresAt) return null;

  const expires = new Date(planExpiresAt);
  const now = new Date();
  const diffTime = expires - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const numericLimit = Number(maxFreeProducts);
  const limitCopy =
    Number.isInteger(numericLimit) && numericLimit > 0
      ? `Plano Trial: ate ${numericLimit} produtos. Estas com ${productCount || 0}.`
      : "";

  if (diffDays <= 0) {
    return (
      <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "12px 20px", borderBottom: "1px solid #fecaca" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: "700" }}>
              <AlertCircle size={16} />
              O teu periodo de teste gratuito expirou. Assina um plano para manter o teu catalogo online.
            </div>
            {limitCopy ? <div style={{ fontSize: "11px", opacity: 0.85 }}>{limitCopy}</div> : null}
          </div>
          {canOpenPlans ? (
            <button type="button" onClick={onOpenPlans} style={{ background: "#b91c1c", color: "white", padding: "8px 16px", borderRadius: "8px", border: "none", textDecoration: "none", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              Escolher plano <ArrowRight size={14} />
            </button>
          ) : waLink ? (
            <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ background: "#b91c1c", color: "white", padding: "8px 16px", borderRadius: "8px", textDecoration: "none", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              Assinar Agora <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff7ed", color: "#9a3412", padding: "12px 20px", borderBottom: "1px solid #ffedd5" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: "700" }}>
            <Clock size={16} />
            Tens <span style={{ textDecoration: "underline", margin: "0 2px" }}>{diffDays} {diffDays === 1 ? "dia" : "dias"}</span> de teste gratuito restante.
          </div>
          {limitCopy ? <div style={{ fontSize: "11px", opacity: 0.85 }}>{limitCopy}</div> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "11px", opacity: 0.8 }}>ID: <strong>{displayId}</strong></div>
          {canOpenPlans ? (
            <button type="button" onClick={onOpenPlans} style={{ background: "#9a3412", color: "white", padding: "8px 16px", borderRadius: "8px", border: "none", textDecoration: "none", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              Escolher plano <ArrowRight size={14} />
            </button>
          ) : waLink ? (
            <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ background: "#9a3412", color: "white", padding: "8px 16px", borderRadius: "8px", textDecoration: "none", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              Assinar Agora <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
