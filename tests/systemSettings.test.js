import assert from "node:assert/strict";
import { buildSystemSettingsCatalog, getSystemSettings, invalidateSystemSettingsCache } from "../netlify/functions/_settings.js";

export async function runSystemSettingsTests() {
  invalidateSystemSettingsCache();
  const defaults = buildSystemSettingsCatalog();
  assert.equal(defaults.trial_enabled?.value, "true");
  assert.match(defaults.trial_enabled?.description || "", /trial gratuito/i);
  assert.equal(defaults.merchant_registration_enabled?.value, "true");
  assert.match(defaults.merchant_registration_enabled?.description || "", /cadastros publicos/i);
  assert.equal(defaults.payment_method_label?.value, "Transferencia bancaria");
  assert.equal(defaults.payment_proof_deadline_hours?.value, "72");
  assert.equal(defaults.payment_bank_name?.category, "payments");

  const merged = buildSystemSettingsCatalog({
    trial_enabled: { value: "false", category: "", description: "" },
    merchant_registration_enabled: { value: "false", category: "", description: "" },
    payment_method_label: { value: "Deposito bancario", category: "", description: "" },
  });
  assert.equal(merged.trial_enabled?.value, "false");
  assert.equal(merged.trial_enabled?.category, "plans");
  assert.match(merged.trial_enabled?.description || "", /novas contas/i);
  assert.equal(merged.merchant_registration_enabled?.value, "false");
  assert.equal(merged.merchant_registration_enabled?.category, "system");
  assert.equal(merged.payment_method_label?.value, "Deposito bancario");
  assert.equal(merged.payment_method_label?.category, "payments");

  const queryable = {
    async query() {
      return {
        rows: [
          { key: "trial_enabled", value: "false", category: "plans", description: "" },
          { key: "merchant_registration_enabled", value: "false", category: "system", description: "" },
          { key: "default_plan_days", value: "14", category: "plans", description: "" },
          { key: "payment_method_label", value: "Transferencia expressa", category: "payments", description: "" },
          { key: "payment_proof_deadline_hours", value: "96", category: "payments", description: "" },
          { key: "payment_bank_name", value: "Banco Teste", category: "payments", description: "" },
        ],
      };
    },
  };

  const settings = await getSystemSettings(queryable);
  assert.equal(settings.trialEnabled, false);
  assert.equal(settings.merchantRegistrationEnabled, false);
  assert.equal(settings.trialDays, 14);
  assert.equal(settings.paymentMethodLabel, "Transferencia expressa");
  assert.equal(settings.paymentProofDeadlineHours, 96);
  assert.equal(settings.paymentBankName, "Banco Teste");
  assert.equal(settings.settings.trial_enabled?.value, "false");
  assert.equal(settings.settings.merchant_registration_enabled?.value, "false");

  invalidateSystemSettingsCache();
  let queryCount = 0;
  const cachedQueryable = {
    async query() {
      queryCount += 1;
      return {
        rows: [
          { key: "support_whatsapp", value: "244911111111", category: "general", description: "" },
        ],
      };
    },
  };

  const firstCachedRead = await getSystemSettings(cachedQueryable);
  const secondCachedRead = await getSystemSettings(cachedQueryable);
  assert.equal(queryCount, 1);
  assert.equal(firstCachedRead.supportWhatsApp, "244911111111");
  assert.equal(secondCachedRead.supportWhatsApp, "244911111111");

  invalidateSystemSettingsCache();
  await getSystemSettings(cachedQueryable);
  assert.equal(queryCount, 2);
}
