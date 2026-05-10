import assert from "node:assert/strict";
import {
  getOrderReviewEligibility,
  isOrderReviewEligible,
} from "../shared/orderReviewEligibility.js";

export async function runOrderReviewEligibilityTests() {
  assert.equal(isOrderReviewEligible("delivered"), true);
  assert.equal(isOrderReviewEligible("DELIVERED"), true);
  assert.equal(isOrderReviewEligible({ status: "pending" }), false);

  const blocked = getOrderReviewEligibility("pending");
  assert.equal(blocked.eligible, false);
  assert.match(blocked.reason, /entregue/i);

  const allowed = getOrderReviewEligibility({ status: "delivered" });
  assert.equal(allowed.eligible, true);
  assert.equal(allowed.reason, "");
}
