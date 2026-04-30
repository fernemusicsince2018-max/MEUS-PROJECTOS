const OPEN_PLAN_REQUEST_STATUS_SET = new Set(["pending_payment", "proof_submitted", "under_review", "needs_correction"]);
const MERCHANT_PAYMENT_PROOF_SUBMITTABLE_STATUS_SET = new Set(["pending_payment", "needs_correction"]);
const PLAN_PAYMENT_PROOF_ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const PLAN_PAYMENT_PROOF_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

export function isOpenPlanRequestStatus(value) {
  return OPEN_PLAN_REQUEST_STATUS_SET.has(normalizeStatus(value));
}

export function canMerchantSubmitPlanProof(value) {
  return MERCHANT_PAYMENT_PROOF_SUBMITTABLE_STATUS_SET.has(normalizeStatus(value));
}

export function formatPlanRequestStatusLabel(value) {
  const normalized = normalizeStatus(value);
  if (normalized === "pending_payment") return "Aguarda pagamento";
  if (normalized === "proof_submitted") return "Comprovativo enviado";
  if (normalized === "under_review") return "Em revisao";
  if (normalized === "needs_correction") return "Precisa de correcao";
  if (normalized === "activated") return "Ativado";
  if (normalized === "rejected") return "Rejeitado";
  if (normalized === "expired") return "Expirado";
  return "Sem estado";
}

export function formatPaymentProofStatusLabel(value) {
  const normalized = normalizeStatus(value);
  if (normalized === "not_submitted") return "Por enviar";
  if (normalized === "submitted") return "Enviado";
  if (normalized === "reviewing") return "Em revisao";
  if (normalized === "accepted") return "Aceite";
  if (normalized === "rejected") return "Rejeitado";
  return "Sem comprovativo";
}

export function getPlanRequestStatusTone(value) {
  const normalized = normalizeStatus(value);
  if (normalized === "activated") {
    return { bg: "#dcfce7", color: "#166534" };
  }
  if (normalized === "rejected" || normalized === "expired") {
    return { bg: "#fee2e2", color: "#b91c1c" };
  }
  if (normalized === "needs_correction") {
    return { bg: "#fff7ed", color: "#9a3412" };
  }
  if (normalized === "proof_submitted" || normalized === "under_review") {
    return { bg: "#eff6ff", color: "#1d4ed8" };
  }
  return { bg: "#f3f4f6", color: "#475569" };
}

export function getPaymentProofStatusTone(value) {
  const normalized = normalizeStatus(value);
  if (normalized === "accepted") {
    return { bg: "#dcfce7", color: "#166534" };
  }
  if (normalized === "rejected") {
    return { bg: "#fee2e2", color: "#b91c1c" };
  }
  if (normalized === "submitted" || normalized === "reviewing") {
    return { bg: "#eff6ff", color: "#1d4ed8" };
  }
  return { bg: "#f3f4f6", color: "#475569" };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler o comprovativo selecionado."));
    reader.readAsDataURL(file);
  });
}

export async function buildPlanPaymentProofDataUrl(file) {
  if (!file) {
    throw new Error("Seleciona o comprovativo do pagamento.");
  }

  if (!PLAN_PAYMENT_PROOF_ALLOWED_TYPES.has(String(file.type || "").toLowerCase())) {
    throw new Error("Usa um comprovativo em PDF, PNG, JPG ou WebP.");
  }

  if (Number(file.size || 0) > PLAN_PAYMENT_PROOF_MAX_FILE_SIZE_BYTES) {
    throw new Error("O comprovativo deve ter ate 5 MB.");
  }

  return readFileAsDataUrl(file);
}
