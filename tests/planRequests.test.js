import assert from "node:assert/strict";
import {
  canMerchantSubmitPlanProof,
  formatPaymentProofStatusLabel,
  formatPlanRequestStatusLabel,
  getPaymentProofStatusTone,
  getPlanRequestStatusTone,
  isOpenPlanRequestStatus,
} from "../src/catalog/utils/planRequests.js";
import {
  PLAN_REQUEST_RETURNING_SQL,
  PLAN_REQUEST_SELECT_SQL,
  resolvePlanActivationRequestAction,
} from "../netlify/functions/_plan-requests.js";

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

  assert.match(PLAN_REQUEST_SELECT_SQL, /\brequests\.id\b/);
  assert.doesNotMatch(PLAN_REQUEST_RETURNING_SQL, /\brequests\./);
  assert.match(PLAN_REQUEST_RETURNING_SQL, /\bid\b/);

  assert.deepEqual(
    resolvePlanActivationRequestAction(null, {
      planId: "starter",
      durationDays: 30,
      totalPrice: 2850,
    }),
    {
      action: "create",
      status: "",
      sameSelection: false,
      locked: false,
      replaceable: false,
    },
  );

  assert.deepEqual(
    resolvePlanActivationRequestAction(
      {
        status: "pending_payment",
        plan_id: "starter",
        duration_days: 30,
        total_price: 5000,
      },
      {
        planId: "starter",
        durationDays: 30,
        totalPrice: 5000,
      },
    ),
    {
      action: "reuse",
      status: "pending_payment",
      sameSelection: true,
      locked: false,
      replaceable: true,
    },
  );

  assert.deepEqual(
    resolvePlanActivationRequestAction(
      {
        status: "pending_payment",
        plan_id: "starter",
        duration_days: 30,
        total_price: 5000,
      },
      {
        planId: "starter",
        durationDays: 30,
        totalPrice: 2850,
      },
    ),
    {
      action: "replace",
      status: "pending_payment",
      sameSelection: false,
      locked: false,
      replaceable: true,
    },
  );

  assert.deepEqual(
    resolvePlanActivationRequestAction(
      {
        status: "needs_correction",
        plan_id: "starter",
        duration_days: 30,
        total_price: 5000,
      },
      {
        planId: "pro",
        durationDays: 90,
        totalPrice: 12000,
      },
    ),
    {
      action: "replace",
      status: "needs_correction",
      sameSelection: false,
      locked: false,
      replaceable: true,
    },
  );

  assert.deepEqual(
    resolvePlanActivationRequestAction(
      {
        status: "proof_submitted",
        plan_id: "starter",
        duration_days: 30,
        total_price: 5000,
      },
      {
        planId: "pro",
        durationDays: 90,
        totalPrice: 12000,
      },
    ),
    {
      action: "blocked",
      status: "proof_submitted",
      sameSelection: false,
      locked: true,
      replaceable: false,
    },
  );
}
