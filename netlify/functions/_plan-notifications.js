function normalizeDigits(value, maxLength = 32) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
}

function formatMoney(value, currencyCode = "AOA") {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: currencyCode || "AOA",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    return `${amount.toFixed(2)} ${currencyCode || "AOA"}`;
  }
}

function createDurationOption(value, label) {
  return {
    value: Number(value),
    label,
  };
}

function getMerchantPlanDurationOptions(plan = {}) {
  const code = String(plan?.code || "").trim().toLowerCase();
  const name = String(plan?.name || "").trim().toLowerCase();
  const combined = `${code} ${name}`.trim();

  if (code === "starter" || name.includes("starter")) {
    return [
      createDurationOption(30, "30 dias"),
      createDurationOption(60, "60 dias"),
    ];
  }

  if (code === "pro" || /\bpro\b/.test(combined)) {
    return [
      createDurationOption(90, "90 dias"),
      createDurationOption(120, "120 dias"),
      createDurationOption(150, "150 dias"),
    ];
  }

  if (code === "scale" || name.includes("scale")) {
    return [
      createDurationOption(180, "6 meses"),
      createDurationOption(360, "12 meses"),
    ];
  }

  return [
    createDurationOption(30, "30 dias"),
    createDurationOption(60, "60 dias"),
    createDurationOption(90, "90 dias"),
  ];
}

function calculatePlanTotalPrice(basePrice, durationDays) {
  const price = Number(basePrice || 0);
  const safeDurationDays = Number(durationDays || 0);
  if (!Number.isFinite(price) || !Number.isFinite(safeDurationDays) || safeDurationDays < 30) {
    return 0;
  }

  return price * (safeDurationDays / 30);
}

function normalizeRequestedDuration(plan, value) {
  const parsed = Number(value || 0);
  const allowedDurations = getMerchantPlanDurationOptions(plan).map((option) => option.value);

  if (allowedDurations.includes(parsed)) {
    return parsed;
  }

  const error = new Error("A duracao pretendida nao esta disponivel para este plano.");
  error.status = 400;
  throw error;
}

function buildPlanActivationRequestMessage({
  storeName,
  referenceId,
  storeId,
  planName,
  durationDays,
  totalPrice,
  currencyCode,
  merchantEmail,
  paymentReference,
}) {
  const displayId = referenceId || String(storeId || "").slice(0, 8).toUpperCase();
  const details = [
    `Ola! Gostaria de ativar um plano para a minha loja: ${storeName || "Minha Loja"}. (ID: ${displayId})`,
  ];

  if (planName) {
    details.push(`Plano pretendido: ${planName}`);
  }

  if (Number.isFinite(Number(durationDays)) && Number(durationDays) >= 30) {
    details.push(`Duracao pretendida: ${Number(durationDays)} dias`);
  }

  if (Number.isFinite(Number(totalPrice)) && Number(totalPrice) > 0) {
    details.push(`Valor estimado: ${formatMoney(totalPrice, currencyCode || "AOA")}`);
  }

  if (paymentReference) {
    details.push(`Referencia de pagamento: ${String(paymentReference).trim()}`);
  }

  if (merchantEmail) {
    details.push(`Email da conta: ${String(merchantEmail).trim()}`);
  }

  return details.join("\n");
}

function buildPlanActivationWhatsAppLink({
  supportWhatsApp,
  storeName,
  referenceId,
  storeId,
  planName,
  durationDays,
  totalPrice,
  currencyCode,
  merchantEmail,
  paymentReference,
}) {
  const supportNumber = normalizeDigits(supportWhatsApp);
  if (!supportNumber) return "";

  const messageText = buildPlanActivationRequestMessage({
    storeName,
    referenceId,
    storeId,
    planName,
    durationDays,
    totalPrice,
    currencyCode,
    merchantEmail,
    paymentReference,
  });

  return `https://wa.me/${supportNumber}?text=${encodeURIComponent(messageText)}`;
}

export {
  buildPlanActivationRequestMessage,
  buildPlanActivationWhatsAppLink,
  calculatePlanTotalPrice,
  getMerchantPlanDurationOptions,
  normalizeRequestedDuration,
};
