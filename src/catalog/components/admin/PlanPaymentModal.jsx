import React from "react";
import { Clock3, Copy, ExternalLink, FileText, MessageCircleMore, Receipt, Upload, X } from "lucide-react";
import { FIELD_STYLE, SURFACE_STYLE, TEXTAREA_STYLE } from "../../constants.js";
import FLabel from "../common/FLabel.jsx";
import { Badge } from "../common/UiBits.jsx";
import { fmtMoney } from "../../utils/format.js";
import {
  buildPlanPaymentProofDataUrl,
  canMerchantSubmitPlanProof,
  formatPaymentProofStatusLabel,
  formatPlanRequestStatusLabel,
  getPaymentProofStatusTone,
  getPlanRequestStatusTone,
} from "../../utils/planRequests.js";

function formatDateLabel(value) {
  if (!value) return "Sem prazo definido";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem prazo definido";

  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTimeLabel(value) {
  if (!value) return "Sem registo";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registo";

  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function createProofDraft(request) {
  return {
    payerName: "",
    payerPhone: "",
    paymentReferenceText: request?.paymentReference || "",
    paidAmount: request?.paidAmount != null ? String(request.paidAmount) : String(request?.totalPrice || ""),
    paidAt: toDateInputValue(request?.paidAt) || new Date().toISOString().slice(0, 10),
    note: "",
    dataUrl: "",
    fileName: "",
    fileLabel: "",
  };
}

function buildPaymentDetailsText(request) {
  const lines = [
    `Plano: ${request?.planName || "Plano comercial"}`,
    `Valor: ${fmtMoney(request?.totalPrice || 0, request?.currencyCode || "AOA")}`,
    `Referencia: ${request?.paymentReference || "Sem referencia"}`,
    `Metodo: ${request?.paymentMethod || "Sem metodo configurado"}`,
    `Prazo: ${formatDateLabel(request?.paymentDueAt)}`,
  ];

  if (request?.paymentBankName) lines.push(`Banco: ${request.paymentBankName}`);
  if (request?.paymentAccountName) lines.push(`Titular: ${request.paymentAccountName}`);
  if (request?.paymentAccountNumber) lines.push(`Conta: ${request.paymentAccountNumber}`);
  if (request?.paymentIban) lines.push(`IBAN: ${request.paymentIban}`);
  if (request?.paymentInstructions) lines.push(`Instrucoes: ${request.paymentInstructions}`);

  return lines.join("\n");
}

export default function PlanPaymentModal({
  request,
  onClose,
  onSubmitProof,
  color = "#16a34a",
}) {
  const [proofDraft, setProofDraft] = React.useState(() => createProofDraft(request));
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState("");
  const [showProofForm, setShowProofForm] = React.useState(false);

  React.useEffect(() => {
    setProofDraft(createProofDraft(request));
    setError("");
    setSubmitting(false);
    setCopyFeedback("");
    setShowProofForm(false);
  }, [request]);

  if (!request) return null;

  const statusTone = getPlanRequestStatusTone(request.status);
  const proofTone = getPaymentProofStatusTone(request.paymentProofStatus);
  const latestProof = request.latestProof || null;
  const canSubmitProof = Boolean(onSubmitProof) && canMerchantSubmitPlanProof(request.status);
  const hasPaymentDetails = Boolean(
    request.paymentMethod
    || request.paymentBankName
    || request.paymentAccountName
    || request.paymentAccountNumber
    || request.paymentIban
    || request.paymentInstructions,
  );
  const proofActionLabel = showProofForm
    ? "Fechar envio"
    : request.status === "needs_correction"
      ? "Enviar novo comprovativo"
      : "Ja fiz o pagamento";

  async function handleCopyDetails() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setCopyFeedback("Copia manualmente os dados deste painel.");
      return;
    }

    await navigator.clipboard.writeText(buildPaymentDetailsText(request));
    setCopyFeedback("Dados de pagamento copiados.");
    window.setTimeout(() => setCopyFeedback(""), 2500);
  }

  async function handleProofFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await buildPlanPaymentProofDataUrl(file);
      setProofDraft((current) => ({
        ...current,
        dataUrl,
        fileName: file.name || "comprovativo-plano",
        fileLabel: file.name || "comprovativo-plano",
      }));
      setError("");
    } catch (failure) {
      setError(failure.message || "Nao foi possivel preparar o comprovativo.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSubmitProof() {
    if (!canSubmitProof || !onSubmitProof) return;

    if (!proofDraft.dataUrl) {
      setError("Anexa o comprovativo em imagem ou PDF.");
      return;
    }

    if (!proofDraft.payerName.trim()) {
      setError("Indica o nome do pagador.");
      return;
    }

    if (!proofDraft.payerPhone.trim()) {
      setError("Indica o telefone do pagador.");
      return;
    }

    if (!proofDraft.paidAmount.trim()) {
      setError("Indica o valor pago.");
      return;
    }

    if (!proofDraft.paidAt.trim()) {
      setError("Indica a data do pagamento.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onSubmitProof({
        requestId: request.id,
        dataUrl: proofDraft.dataUrl,
        fileName: proofDraft.fileName || "comprovativo-plano",
        payerName: proofDraft.payerName,
        payerPhone: proofDraft.payerPhone,
        paymentReferenceText: proofDraft.paymentReferenceText,
        paidAmount: proofDraft.paidAmount,
        paidCurrencyCode: request.currencyCode || "AOA",
        paidAt: proofDraft.paidAt,
        note: proofDraft.note,
      });

      setProofDraft((current) => ({
        ...current,
        dataUrl: "",
        fileName: "",
        fileLabel: "",
      }));
      setShowProofForm(false);
    } catch (failure) {
      setError(failure.message || "Nao foi possivel enviar o comprovativo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15, 23, 42, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "min(760px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "var(--color-background-primary)", borderRadius: "28px", boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <Badge bg={statusTone.bg} color={statusTone.color}>
                <Receipt size={12} /> {formatPlanRequestStatusLabel(request.status)}
              </Badge>
              <Badge bg={proofTone.bg} color={proofTone.color}>
                <FileText size={12} /> {formatPaymentProofStatusLabel(request.paymentProofStatus)}
              </Badge>
            </div>
            <div style={{ fontSize: "22px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
              Pagamento do plano {request.planName || "comercial"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Pedido criado em {formatDateTimeLabel(request.requestedAt)}. Usa este painel para pagar, enviar o comprovativo e acompanhar a revisao.
            </div>
          </div>

          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-secondary)" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px", display: "grid", gap: "18px" }}>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <div style={{ ...SURFACE_STYLE, padding: "16px" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>Valor do plano</div>
              <div style={{ marginTop: "8px", fontSize: "22px", fontWeight: "800" }}>{fmtMoney(request.totalPrice || 0, request.currencyCode || "AOA")}</div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>{request.durationDays} dias contratados</div>
            </div>

            <div style={{ ...SURFACE_STYLE, padding: "16px" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>Referencia</div>
              <div style={{ marginTop: "8px", fontSize: "18px", fontWeight: "800", wordBreak: "break-word" }}>{request.paymentReference || "Sem referencia"}</div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>Usa esta referencia no comprovativo.</div>
            </div>

            <div style={{ ...SURFACE_STYLE, padding: "16px" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>Prazo</div>
              <div style={{ marginTop: "8px", fontSize: "18px", fontWeight: "800" }}>{formatDateLabel(request.paymentDueAt)}</div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock3 size={13} /> Envia o comprovativo antes deste prazo.
              </div>
            </div>
          </section>

          <section style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "14px", background: hasPaymentDetails ? "var(--color-background-primary)" : "#fff7ed", borderColor: hasPaymentDetails ? "var(--color-border-tertiary)" : "#fed7aa" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Dados para pagamento</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                  {hasPaymentDetails
                    ? "Confirma os dados abaixo, faz o pagamento e envia o comprovativo aqui mesmo. O WhatsApp fica apenas como apoio."
                    : "A equipa ainda nao configurou os dados do pagamento neste ambiente. Usa o WhatsApp de suporte apenas como apoio."}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={handleCopyDetails} style={{ border: "none", borderRadius: "12px", padding: "10px 14px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", cursor: "pointer", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <Copy size={14} /> Copiar dados
                </button>
                {request.whatsappLink ? (
                  <button type="button" onClick={() => window.open(request.whatsappLink, "_blank", "noopener,noreferrer")} style={{ border: "none", borderRadius: "12px", padding: "10px 14px", background: "#ecfdf5", color: "#166534", cursor: "pointer", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <MessageCircleMore size={14} /> Falar no suporte via WhatsApp
                  </button>
                ) : null}
              </div>
            </div>

            {copyFeedback ? (
              <div style={{ fontSize: "12px", color: "#166534", background: "#dcfce7", borderRadius: "12px", padding: "10px 12px" }}>
                {copyFeedback}
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              <div style={{ ...SURFACE_STYLE, padding: "14px", background: "var(--color-background-secondary)" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>Metodo</div>
                <div style={{ marginTop: "6px", fontSize: "15px", fontWeight: "800" }}>{request.paymentMethod || "Sem metodo configurado"}</div>
              </div>
              <div style={{ ...SURFACE_STYLE, padding: "14px", background: "var(--color-background-secondary)" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>Banco</div>
                <div style={{ marginTop: "6px", fontSize: "15px", fontWeight: "800" }}>{request.paymentBankName || "Sem banco configurado"}</div>
              </div>
              <div style={{ ...SURFACE_STYLE, padding: "14px", background: "var(--color-background-secondary)" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>Titular</div>
                <div style={{ marginTop: "6px", fontSize: "15px", fontWeight: "800" }}>{request.paymentAccountName || "Sem titular configurado"}</div>
              </div>
              <div style={{ ...SURFACE_STYLE, padding: "14px", background: "var(--color-background-secondary)" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>Conta / IBAN</div>
                <div style={{ marginTop: "6px", fontSize: "15px", fontWeight: "800", wordBreak: "break-word" }}>
                  {request.paymentAccountNumber || request.paymentIban || "Sem conta configurada"}
                </div>
              </div>
            </div>

            <div style={{ padding: "14px 16px", borderRadius: "18px", background: "rgba(28, 154, 116, 0.06)", fontSize: "13px", lineHeight: 1.7, color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>
              {request.paymentInstructions || "Nao existem instrucoes extra configuradas. Se precisares de ajuda, usa o WhatsApp de suporte deste pedido."}
            </div>
          </section>

          {request.reviewNote ? (
            <section style={{ ...SURFACE_STYLE, padding: "16px", background: request.status === "needs_correction" ? "#fff7ed" : "var(--color-background-secondary)", borderColor: request.status === "needs_correction" ? "#fed7aa" : "var(--color-border-tertiary)" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.08em", color: request.status === "needs_correction" ? "#9a3412" : "var(--color-text-secondary)" }}>
                Observacao da equipa
              </div>
              <div style={{ marginTop: "8px", fontSize: "13px", lineHeight: 1.6, color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>
                {request.reviewNote}
              </div>
            </section>
          ) : null}

          <section style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Comprovativo</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                  O plano so avanca para ativacao depois de a equipa rever este comprovativo oficial.
                </div>
              </div>

              {canSubmitProof ? (
                <button type="button" onClick={() => setShowProofForm((current) => !current)} style={{ border: "none", borderRadius: "12px", padding: "10px 14px", background: color, color: "white", cursor: "pointer", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <Upload size={14} /> {proofActionLabel}
                </button>
              ) : null}
            </div>

            {latestProof ? (
              <div style={{ ...SURFACE_STYLE, padding: "14px", background: "var(--color-background-secondary)", display: "grid", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700" }}>{latestProof.originalFileName || "Comprovativo enviado"}</div>
                  {latestProof.downloadUrl ? (
                    <a href={latestProof.downloadUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", fontSize: "12px", fontWeight: "700", color: "#1d4ed8", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <ExternalLink size={13} /> Ver comprovativo
                    </a>
                  ) : null}
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", display: "grid", gap: "4px" }}>
                  <div>Enviado em {formatDateTimeLabel(latestProof.submittedAt)}</div>
                  <div>Pagador: {latestProof.payerName || "Sem nome"}</div>
                  <div>Telefone: {latestProof.payerPhone || "Sem telefone"}</div>
                  <div>Valor: {latestProof.paidAmount != null ? fmtMoney(latestProof.paidAmount, latestProof.paidCurrencyCode || request.currencyCode || "AOA") : "Sem valor indicado"}</div>
                  <div>Data do pagamento: {formatDateLabel(latestProof.paidAt)}</div>
                  {latestProof.note ? <div>Nota enviada: {latestProof.note}</div> : null}
                </div>
              </div>
            ) : (
              <div style={{ padding: "14px 16px", borderRadius: "16px", background: "#fff7ed", color: "#9a3412", fontSize: "12px", lineHeight: 1.6 }}>
                Ainda nao recebemos nenhum comprovativo deste pedido.
              </div>
            )}

            {canSubmitProof && !showProofForm ? (
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", background: "var(--color-background-secondary)", borderRadius: "14px", padding: "12px 14px", lineHeight: 1.6 }}>
                Depois de concluir o pagamento, clica em <strong style={{ color: "var(--color-text-primary)" }}>Ja fiz o pagamento</strong> para anexar a imagem ou PDF do comprovativo e enviar os dados do pagador.
              </div>
            ) : null}

            {showProofForm && canSubmitProof ? (
              <div style={{ display: "grid", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                  <FLabel label="Nome do pagador *">
                    <input value={proofDraft.payerName} onChange={(event) => setProofDraft((current) => ({ ...current, payerName: event.target.value }))} placeholder="Quem fez o pagamento?" style={FIELD_STYLE} />
                  </FLabel>
                  <FLabel label="Telefone do pagador *">
                    <input value={proofDraft.payerPhone} onChange={(event) => setProofDraft((current) => ({ ...current, payerPhone: event.target.value }))} placeholder="Ex: 923000000" style={FIELD_STYLE} />
                  </FLabel>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                  <FLabel label="Referencia do pagamento">
                    <input value={proofDraft.paymentReferenceText} onChange={(event) => setProofDraft((current) => ({ ...current, paymentReferenceText: event.target.value }))} placeholder="Referencia usada no comprovativo" style={FIELD_STYLE} />
                  </FLabel>
                  <FLabel label="Valor pago *">
                    <input value={proofDraft.paidAmount} onChange={(event) => setProofDraft((current) => ({ ...current, paidAmount: event.target.value }))} placeholder="Ex: 5000" inputMode="decimal" style={FIELD_STYLE} />
                  </FLabel>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                  <FLabel label="Data do pagamento *">
                    <input type="date" value={proofDraft.paidAt} onChange={(event) => setProofDraft((current) => ({ ...current, paidAt: event.target.value }))} style={FIELD_STYLE} />
                  </FLabel>
                  <FLabel label="Comprovativo *" hint="Aceita PDF, PNG, JPG ou WebP ate 5 MB.">
                    <div style={{ display: "grid", gap: "8px" }}>
                      <input type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={handleProofFileChange} style={FIELD_STYLE} />
                      {proofDraft.fileLabel ? (
                        <div style={{ fontSize: "12px", color: "#166534", background: "#dcfce7", borderRadius: "12px", padding: "10px 12px" }}>
                          {proofDraft.fileLabel}
                        </div>
                      ) : null}
                    </div>
                  </FLabel>
                </div>

                <FLabel label="Observacao opcional">
                  <textarea value={proofDraft.note} onChange={(event) => setProofDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Ex: pagamento feito a partir da conta da empresa." rows={3} style={TEXTAREA_STYLE} />
                </FLabel>

                {error ? (
                  <div style={{ fontSize: "12px", color: "#b91c1c", background: "#fee2e2", borderRadius: "12px", padding: "10px 12px" }}>
                    {error}
                  </div>
                ) : null}

                <button type="button" onClick={handleSubmitProof} disabled={submitting} style={{ border: "none", borderRadius: "14px", padding: "13px 16px", background: color, color: "white", cursor: submitting ? "wait" : "pointer", fontWeight: "800", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: submitting ? 0.8 : 1 }}>
                  <Upload size={15} /> {submitting ? "A enviar comprovativo..." : "Enviar comprovativo"}
                </button>
              </div>
            ) : null}

            {!canSubmitProof && request.status !== "activated" ? (
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", background: "var(--color-background-secondary)", borderRadius: "14px", padding: "12px 14px" }}>
                O comprovativo ja foi enviado. Agora a equipa precisa concluir a revisao antes de qualquer nova acao.
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
