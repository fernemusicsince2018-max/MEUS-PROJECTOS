import assert from "node:assert/strict";
import {
  canMerchantSubmitPlanProof,
  formatPaymentProofStatusLabel,
  formatPlanRequestStatusLabel,
  getPaymentProofStatusTone,
  getPlanRequestStatusTone,
  isOpenPlanRequestStatus,
} from "../src/catalog/utils/planRequests.js";

export async function runPlanRequestsTests() {
  assert.equal(isOpenPlanRequestStatus("pending_payment"), true);
  assert.equal(isOpenPlanRequestStatus("proof_submitted"), true);
  assert.equal(isOpenPlanRequestStatus("UNDER_REVIEW"), true);
  assert.equal(isOpenPlanRequestStatus("activated"), false);

  assert.equal(canMerchantSubmitPlanProof("pending_payment"), true);
  assert.equal(canMerchantSubmitPlanProof("needs_correction"), true);
  assert.equal(canMerchantSubmitPlanProof("proof_submitted"), false);

  assert.equal(formatPlanRequestStatusLabel("pending_payment"), "Aguarda pagamento");
  assert.equal(formatPlanRequestStatusLabel("proof_submitted"), "Comprovativo enviado");
  assert.equal(formatPlanRequestStatusLabel("activated"), "Ativado");

  assert.equal(formatPaymentProofStatusLabel("not_submitted"), "Por enviar");
  assert.equal(formatPaymentProofStatusLabel("reviewing"), "Em revisao");
  assert.equal(formatPaymentProofStatusLabel("accepted"), "Aceite");

  assert.deepEqual(getPlanRequestStatusTone("needs_correction"), { bg: "#fff7ed", color: "#9a3412" });
  assert.deepEqual(getPlanRequestStatusTone("activated"), { bg: "#dcfce7", color: "#166534" });
  assert.deepEqual(getPaymentProofStatusTone("submitted"), { bg: "#eff6ff", color: "#1d4ed8" });
  assert.deepEqual(getPaymentProofStatusTone("rejected"), { bg: "#fee2e2", color: "#b91c1c" });
}
