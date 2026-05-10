import assert from "node:assert/strict";
import {
  buildPlanActivationLink,
  calculatePlanTotalPrice,
  getMerchantPlanDurationOptions,
  getPlanCountdown,
  getPlanTimeRemaining,
  isPaidMerchantPlan,
  supportsPlanCountdown,
} from "../src/catalog/utils/catalog.js";

export async function runPlanSelectionTests() {
  assert.equal(calculatePlanTotalPrice(5000, 30), 5000);
  assert.equal(calculatePlanTotalPrice(5000, 60), 10000);
  assert.equal(calculatePlanTotalPrice(7500, 90), 22500);
  assert.equal(calculatePlanTotalPrice("invalido", 30), 0);
  assert.equal(calculatePlanTotalPrice(5000, 0), 0);
  assert.equal(isPaidMerchantPlan({ priceMonthly: 5000 }), true);
  assert.equal(isPaidMerchantPlan({ priceMonthly: 0 }), false);
  assert.deepEqual(
    getMerchantPlanDurationOptions({ code: "starter" }).map((option) => option.value),
    [30, 60],
  );
  assert.deepEqual(
    getMerchantPlanDurationOptions({ code: "pro" }).map((option) => option.value),
    [90, 120, 150],
  );
  assert.deepEqual(
    getMerchantPlanDurationOptions({ code: "scale" }).map((option) => option.label),
    ["6 meses", "12 meses"],
  );
  assert.equal(supportsPlanCountdown("active"), true);
  assert.equal(supportsPlanCountdown("trial"), true);
  assert.equal(supportsPlanCountdown("past_due"), false);

  const countdown = getPlanCountdown("active", "2026-05-10", new Date("2026-05-07T10:00:00Z"));
  assert.deepEqual(
    countdown,
    {
      daysRemaining: 3,
      bg: "#fef3c7",
      color: "#b45309",
      borderColor: "#fde68a",
      label: "3 dias restantes",
    },
  );

  const timeRemaining = getPlanTimeRemaining("trial", "2026-05-10", new Date("2026-05-07T12:30:00+01:00"));
  assert.deepEqual(
    timeRemaining,
    {
      compactLabel: "3d 11h 30m",
      detailLabel: "Faltam 3 dias, 11 horas e 30 minutos para o trial terminar.",
      bg: "#fff7ed",
      color: "#9a3412",
      borderColor: "#fed7aa",
    },
  );

  const link = buildPlanActivationLink({
    supportWhatsApp: "244 900 000 000",
    storeName: "Loja Teste",
    referenceId: "123456",
    planName: "Plano Pro",
    durationDays: 60,
    totalPrice: 10000,
    currencyCode: "AOA",
    merchantEmail: "lojista@example.com",
  });

  assert.match(link, /^https:\/\/wa\.me\/244900000000\?text=/);

  const url = new URL(link);
  const text = decodeURIComponent(url.searchParams.get("text") || "");
  assert.match(text, /Loja Teste/);
  assert.match(text, /123456/);
  assert.match(text, /Plano Pro/);
  assert.match(text, /60 dias/);
  assert.match(text, /Kz 10\.000,00/);
  assert.match(text, /lojista@example\.com/);

  assert.equal(
    buildPlanActivationLink({
      supportWhatsApp: "",
      storeName: "Loja Teste",
    }),
    "",
  );
}
