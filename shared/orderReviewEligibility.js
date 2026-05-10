const REVIEW_ELIGIBLE_STATUS = "delivered";

function normalizeOrderStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveOrderStatus(orderOrStatus) {
  if (orderOrStatus && typeof orderOrStatus === "object") {
    return normalizeOrderStatus(orderOrStatus.status);
  }

  return normalizeOrderStatus(orderOrStatus);
}

export function isOrderReviewEligible(orderOrStatus) {
  return resolveOrderStatus(orderOrStatus) === REVIEW_ELIGIBLE_STATUS;
}

export function getOrderReviewEligibility(orderOrStatus) {
  const status = resolveOrderStatus(orderOrStatus);
  const eligible = status === REVIEW_ELIGIBLE_STATUS;

  return {
    status,
    eligible,
    reason: eligible
      ? ""
      : "A avaliacao desta loja fica disponivel apenas depois de a encomenda ser marcada como entregue.",
  };
}
