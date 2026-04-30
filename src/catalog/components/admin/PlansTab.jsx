import React from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, MessageCircleMore, Receipt, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { FIELD_STYLE, SURFACE_STYLE } from "../../constants.js";
import {
  calculatePlanTotalPrice,
  getMerchantPlanDurationOptions,
  getPlanAccessState,
  isPaidMerchantPlan,
} from "../../utils/catalog.js";
import { fmtMoney } from "../../utils/format.js";
import {
  formatPaymentProofStatusLabel,
  formatPlanRequestStatusLabel,
  getPaymentProofStatusTone,
  getPlanRequestStatusTone,
  isOpenPlanRequestStatus,
} from "../../utils/planRequests.js";
import { Badge } from "../common/UiBits.jsx";
import PlanPaymentModal from "./PlanPaymentModal.jsx";

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

function formatDateTimeLabel(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCurrentPlanLabel(currentPlanStatus, currentPlanExpiresAt) {
  const normalizedStatus = String(currentPlanStatus || "").trim().toLowerCase();
  if (normalizedStatus === "active" && currentPlanExpiresAt) {
    return `Plano ativo ate ${formatDateLabel(currentPlanExpiresAt)}`;
  }

  if (normalizedStatus === "trial" && currentPlanExpiresAt) {
    return `Trial ativo ate ${formatDateLabel(currentPlanExpiresAt)}`;
  }

  if (normalizedStatus === "past_due") {
    return "Plano em atraso";
  }

  if (normalizedStatus === "canceled") {
    return "Plano cancelado";
  }

  return "Sem plano comercial ativo";
}

export default function PlansTab({
  store,
  session,
  planCatalog,
  loading,
  error,
  onRefresh,
  onRequestActivation,
  onSubmitPaymentProof,
}) {
  const [durationByPlanId, setDurationByPlanId] = React.useState({});
  const [requestingPlanId, setRequestingPlanId] = React.useState("");
  const [paymentRequest, setPaymentRequest] = React.useState(null);

  const plans = Array.isArray(planCatalog?.plans) ? planCatalog.plans : [];
  const availablePlans = plans.filter(isPaidMerchantPlan);
  const catalogStore = planCatalog?.store || {};
  const activeRequest = planCatalog?.activeRequest && isOpenPlanRequestStatus(planCatalog.activeRequest.status)
    ? planCatalog.activeRequest
    : null;
  const currentPlanId = String(catalogStore.currentPlanId || "").trim();
  const currentPlanStatus = catalogStore.currentPlanStatus || session?.planStatus || "";
  const currentPlanExpiresAt = catalogStore.currentPlanExpiresAt || session?.planExpiresAt || "";
  const currentPlanCurrencyCode = catalogStore.currentPlanCurrencyCode || store?.currencyCode || "AOA";
  const currentPlanTotalPrice = Number(catalogStore.currentPlanTotalPrice || 0);
  const currentPlanDurationDays = Number(catalogStore.currentPlanDurationDays || 0);
  const productCount = Number(catalogStore.productCount ?? 0);
  const maxFreeProducts = Number(catalogStore.maxFreeProducts ?? store?.maxFreeProducts ?? 0);
  const planAccess = getPlanAccessState(currentPlanStatus, currentPlanExpiresAt);
  const referenceId = catalogStore.referenceId || session?.referenceId || "";
  const storeId = catalogStore.id || session?.storeId || "";
  const storeName = store?.name || catalogStore.name || session?.storeName || "Minha Loja";

  React.useEffect(() => {
    setDurationByPlanId((current) => {
      const next = { ...current };
      let changed = false;

      for (const plan of availablePlans) {
        const allowedOptions = getMerchantPlanDurationOptions(plan);
        const defaultDuration = Number(allowedOptions[0]?.value || 30);
        const currentValue = Number(next[plan.id] || 0);
        const isAllowed = allowedOptions.some((option) => option.value === currentValue);

        if (isAllowed) continue;
        next[plan.id] = defaultDuration;
        changed = true;
      }

      return changed ? next : current;
    });
  }, [availablePlans]);

  React.useEffect(() => {
    setPaymentRequest((current) => {
      if (!current || !activeRequest) return current;
      return current.id === activeRequest.id ? activeRequest : current;
    });
  }, [activeRequest]);

  function handleDurationChange(planId, value) {
    setDurationByPlanId((current) => ({
      ...current,
      [planId]: Number(value) || 30,
    }));
  }

  async function handleOpenPaymentPanel(plan, durationDays) {
    if (!onRequestActivation) return;

    setRequestingPlanId(plan.id);

    try {
      const response = await onRequestActivation({
        planId: plan.id,
        durationDays,
      });

      if (response?.request) {
        setPaymentRequest(response.request);
      }
    } finally {
      setRequestingPlanId("");
    }
  }

  const headerCopy = activeRequest
    ? "Ja existe um pedido de plano em aberto. Continua pelo painel de pagamento, envia o comprovativo oficial e usa o WhatsApp apenas como apoio."
    : planAccess.allowed
      ? "Escolhe um plano antes de o trial terminar, gera a referencia de pagamento e envia o comprovativo oficial pelo painel."
      : "O teu catalogo ja precisa de um plano comercial. Escolhe abaixo, paga com a referencia indicada e anexa o comprovativo no painel.";

  const activeRequestStatusTone = activeRequest ? getPlanRequestStatusTone(activeRequest.status) : null;
  const activeProofStatusTone = activeRequest ? getPaymentProofStatusTone(activeRequest.paymentProofStatus) : null;

  return (
    <>
      <div style={{ display: "grid", gap: "18px" }}>
        <section
          style={{
            ...SURFACE_STYLE,
            padding: "22px",
            background: "linear-gradient(135deg, rgba(12, 37, 34, 0.96) 0%, rgba(28, 154, 116, 0.96) 62%, rgba(240, 201, 120, 0.95) 180%)",
            color: "white",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", width: "200px", height: "200px", borderRadius: "999px", background: "rgba(255,255,255,0.08)", top: "-96px", right: "-42px" }} />
          <div style={{ position: "relative", display: "grid", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <Badge bg="rgba(255,255,255,0.16)" color="white" borderColor="rgba(255,255,255,0.14)">
                <Wallet size={12} /> Escolha do plano
              </Badge>
              <Badge bg={planAccess.allowed ? "rgba(220,252,231,0.16)" : "rgba(254,226,226,0.16)"} color="white" borderColor="rgba(255,255,255,0.14)">
                <ShieldCheck size={12} /> {getCurrentPlanLabel(currentPlanStatus, currentPlanExpiresAt)}
              </Badge>
              {activeRequestStatusTone ? (
                <Badge bg="rgba(255,255,255,0.16)" color="white" borderColor="rgba(255,255,255,0.14)">
                  <Receipt size={12} /> Pedido em andamento
                </Badge>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: "8px", maxWidth: "760px" }}>
              <div style={{ fontSize: "30px", fontWeight: "800", lineHeight: 1.05, fontFamily: "var(--font-display)" }}>
                Ativa o plano certo e envia o comprovativo sem sair do teu painel.
              </div>
              <div style={{ fontSize: "13px", opacity: 0.92, maxWidth: "640px" }}>
                {headerCopy}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <div style={{ padding: "14px 16px", borderRadius: "20px", background: "rgba(255,255,255,0.12)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8 }}>Loja</div>
                <div style={{ marginTop: "6px", fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{storeName}</div>
                <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.88 }}>ID {referenceId || String(storeId).slice(0, 8).toUpperCase()}</div>
              </div>

              <div style={{ padding: "14px 16px", borderRadius: "20px", background: "rgba(255,255,255,0.12)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8 }}>Catalogo atual</div>
                <div style={{ marginTop: "6px", fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{productCount} produto{productCount === 1 ? "" : "s"}</div>
                <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.88 }}>
                  {maxFreeProducts > 0 ? `Trial ate ${maxFreeProducts} produtos.` : "Sem limite de trial definido."}
                </div>
              </div>

              <div style={{ padding: "14px 16px", borderRadius: "20px", background: "rgba(255,255,255,0.12)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8 }}>Plano atual</div>
                <div style={{ marginTop: "6px", fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                  {currentPlanTotalPrice > 0 ? fmtMoney(currentPlanTotalPrice, currentPlanCurrencyCode) : "Sem custo ativo"}
                </div>
                <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.88 }}>
                  {currentPlanDurationDays > 0 ? `${currentPlanDurationDays} dias configurados` : "Pronto para nova ativacao"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {activeRequest ? (
          <section style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "14px", borderColor: "rgba(28, 154, 116, 0.24)", boxShadow: "0 18px 40px rgba(28, 154, 116, 0.08)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <Badge bg={activeRequestStatusTone.bg} color={activeRequestStatusTone.color}>
                    <Receipt size={12} /> {formatPlanRequestStatusLabel(activeRequest.status)}
                  </Badge>
                  <Badge bg={activeProofStatusTone.bg} color={activeProofStatusTone.color}>
                    <Clock3 size={12} /> {formatPaymentProofStatusLabel(activeRequest.paymentProofStatus)}
                  </Badge>
                </div>
                <div style={{ fontSize: "20px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                  Pedido atual: {activeRequest.planName || "Plano comercial"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  Criado em {formatDateTimeLabel(activeRequest.requestedAt)}. Referencia {activeRequest.paymentReference || "sem referencia"}.
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setPaymentRequest(activeRequest)} style={{ border: "none", borderRadius: "12px", padding: "10px 14px", background: store?.color || "#16a34a", color: "white", cursor: "pointer", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <Receipt size={14} /> Abrir painel de pagamento
                </button>
                {activeRequest.whatsappLink ? (
                  <button type="button" onClick={() => window.open(activeRequest.whatsappLink, "_blank", "noopener,noreferrer")} style={{ border: "none", borderRadius: "12px", padding: "10px 14px", background: "#ecfdf5", color: "#166534", cursor: "pointer", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <MessageCircleMore size={14} /> Suporte no WhatsApp
                  </button>
                ) : null}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <div style={{ ...SURFACE_STYLE, padding: "14px", background: "var(--color-background-secondary)" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>Valor</div>
                <div style={{ marginTop: "6px", fontSize: "18px", fontWeight: "800" }}>{fmtMoney(activeRequest.totalPrice || 0, activeRequest.currencyCode || "AOA")}</div>
              </div>
              <div style={{ ...SURFACE_STYLE, padding: "14px", background: "var(--color-background-secondary)" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>Prazo do comprovativo</div>
                <div style={{ marginTop: "6px", fontSize: "18px", fontWeight: "800" }}>{formatDateLabel(activeRequest.paymentDueAt) || "Sem prazo"}</div>
              </div>
              <div style={{ ...SURFACE_STYLE, padding: "14px", background: "var(--color-background-secondary)" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>Ultimo envio</div>
                <div style={{ marginTop: "6px", fontSize: "18px", fontWeight: "800" }}>{formatDateTimeLabel(activeRequest.lastProofSubmittedAt) || "Ainda nao enviado"}</div>
              </div>
            </div>
          </section>
        ) : null}

        {error ? (
          <section style={{ ...SURFACE_STYLE, padding: "18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", background: "#fff7ed", borderColor: "#fed7aa" }}>
            <div style={{ display: "grid", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "800", color: "#9a3412" }}>
                <AlertCircle size={15} /> Nao foi possivel carregar os planos agora.
              </div>
              <div style={{ fontSize: "12px", color: "#9a3412", opacity: 0.9 }}>{error}</div>
            </div>
            <button type="button" onClick={onRefresh} style={{ border: "none", borderRadius: "12px", padding: "10px 14px", background: "#9a3412", color: "white", cursor: "pointer", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <RefreshCw size={14} /> Tentar novamente
            </button>
          </section>
        ) : null}

        {loading && !availablePlans.length ? (
          <section style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "8px" }}>
            <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>A carregar os planos disponiveis...</div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Estamos a preparar os tipos de plano para esta loja.</div>
          </section>
        ) : null}

        {!loading && !availablePlans.length ? (
          <section style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "8px" }}>
            <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Ainda nao existem planos pagos configurados.</div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Assim que o super admin criar os planos pagos, eles aparecem aqui para o lojista escolher.
            </div>
          </section>
        ) : null}

        {availablePlans.length ? (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {availablePlans.map((plan) => {
              const durationOptions = getMerchantPlanDurationOptions(plan);
              const durationDays = Number(durationByPlanId[plan.id] || durationOptions[0]?.value || 30);
              const estimatedTotal = calculatePlanTotalPrice(plan.priceMonthly, durationDays);
              const coversCurrentCatalog = !plan.maxProducts || productCount <= plan.maxProducts;
              const isCurrentPaidPlan = currentPlanId && currentPlanId === plan.id;
              const isRequestingThisPlan = requestingPlanId === plan.id;

              return (
                <article key={plan.id} style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "14px", boxShadow: isCurrentPaidPlan ? "0 18px 40px rgba(28, 154, 116, 0.14)" : "none", borderColor: isCurrentPaidPlan ? "rgba(28, 154, 116, 0.35)" : "var(--color-border-tertiary)" }}>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <div>
                        <div style={{ fontSize: "20px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{plan.name}</div>
                        <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>{plan.code}</div>
                      </div>
                      {isCurrentPaidPlan ? (
                        <Badge bg="#dcfce7" color="#166534">
                          <CheckCircle2 size={12} /> Atual
                        </Badge>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "28px", fontWeight: "800", color: store?.color || "var(--color-text-primary)", letterSpacing: "-0.03em" }}>
                        {fmtMoney(plan.priceMonthly, plan.currencyCode)}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>/ 30 dias</div>
                    </div>

                    <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", minHeight: "38px" }}>
                      {plan.description || "Plano comercial pronto para ativar a vitrine, manter produtos e desbloquear a operacao da loja."}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <Badge bg={coversCurrentCatalog ? "#dcfce7" : "#fff7ed"} color={coversCurrentCatalog ? "#166534" : "#9a3412"}>
                      <ShieldCheck size={12} />
                      {plan.maxProducts ? `Ate ${plan.maxProducts} produtos` : "Produtos ilimitados"}
                    </Badge>
                    <Badge bg="#eff6ff" color="#1d4ed8">
                      <Wallet size={12} />
                      {plan.maxTeamMembers ? `${plan.maxTeamMembers} membro${plan.maxTeamMembers === 1 ? "" : "s"}` : "Equipa flexivel"}
                    </Badge>
                  </div>

                  <div style={{ display: "grid", gap: "10px" }}>
                    <label style={{ display: "grid", gap: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700" }}>Duracao pretendida</span>
                      <select value={durationDays} onChange={(event) => handleDurationChange(plan.id, event.target.value)} style={FIELD_STYLE}>
                        {durationOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={{ ...SURFACE_STYLE, padding: "12px 14px", borderRadius: "16px", background: "rgba(28, 154, 116, 0.04)" }}>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", marginBottom: "6px" }}>
                        Total estimado
                      </div>
                      <div style={{ fontSize: "19px", fontWeight: "800", color: "var(--color-text-primary)" }}>{fmtMoney(estimatedTotal, plan.currencyCode)}</div>
                      <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                        O pagamento recebe uma referencia unica e o comprovativo oficial segue neste painel antes da ativacao final.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenPaymentPanel(plan, durationDays)}
                      disabled={!onRequestActivation || isRequestingThisPlan}
                      style={{
                        border: "none",
                        borderRadius: "14px",
                        padding: "12px 16px",
                        background: onRequestActivation ? (store?.color || "#16a34a") : "var(--color-border-tertiary)",
                        color: "white",
                        cursor: onRequestActivation && !isRequestingThisPlan ? "pointer" : "not-allowed",
                        fontWeight: "800",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        opacity: isRequestingThisPlan ? 0.8 : 1,
                      }}
                    >
                      <Receipt size={16} /> {isRequestingThisPlan ? "A abrir pagamento..." : "Escolher e gerar pagamento"} <ArrowRight size={14} />
                    </button>

                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Clock3 size={14} />
                      O sistema cria o pedido, mostra a referencia do pagamento e recebe o comprovativo antes da revisao.
                    </div>

                    {!coversCurrentCatalog ? (
                      <div style={{ fontSize: "12px", color: "#9a3412", background: "#fff7ed", borderRadius: "12px", padding: "10px 12px" }}>
                        Este plano pode ficar curto para os {productCount} produtos que ja tens no catalogo.
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
      </div>

      {paymentRequest ? (
        <PlanPaymentModal
          request={paymentRequest}
          onClose={() => setPaymentRequest(null)}
          onSubmitProof={onSubmitPaymentProof}
          color={store?.color || "#16a34a"}
        />
      ) : null}
    </>
  );
}
