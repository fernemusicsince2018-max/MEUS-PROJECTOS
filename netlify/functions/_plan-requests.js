import { randomBytes } from "node:crypto";
import { hasColumn } from "./_postgres.js";
import { createSignedStorageUrl } from "./_storage.js";

const PLAN_REQUEST_STATUS_VALUES = new Set([
  "pending_payment",
  "proof_submitted",
  "under_review",
  "needs_correction",
  "activated",
  "rejected",
  "expired",
]);

const OPEN_PLAN_REQUEST_STATUSES = new Set([
  "pending_payment",
  "proof_submitted",
  "under_review",
  "needs_correction",
]);

const REPLACEABLE_PLAN_REQUEST_STATUSES = new Set([
  "pending_payment",
  "needs_correction",
]);

const LOCKED_PLAN_REQUEST_STATUSES = new Set([
  "proof_submitted",
  "under_review",
]);

const FINAL_PLAN_REQUEST_STATUSES = new Set([
  "activated",
  "rejected",
  "expired",
]);

const PAYMENT_PROOF_STATUS_VALUES = new Set([
  "not_submitted",
  "submitted",
  "reviewing",
  "accepted",
  "rejected",
]);

const PAYMENT_PROOF_REVIEW_STATUS_VALUES = new Set([
  "submitted",
  "reviewing",
  "accepted",
  "rejected",
]);

const PLAN_PAYMENT_FLOW_SCHEMA_REQUIREMENTS = Object.freeze([
  { tableName: "catalog_plan_activation_requests", columnName: "payment_reference" },
  { tableName: "catalog_plan_activation_requests", columnName: "payment_proof_status" },
  { tableName: "catalog_plan_activation_requests", columnName: "payment_due_at" },
  { tableName: "catalog_plan_payment_proofs", columnName: "request_id" },
  { tableName: "catalog_plan_payment_proofs", columnName: "payment_reference_text" },
]);

const PLAN_REQUEST_COLUMNS = Object.freeze([
  "id",
  "store_id",
  "user_id",
  "plan_id",
  "plan_code",
  "plan_name",
  "store_name",
  "merchant_email",
  "reference_id",
  "store_whatsapp",
  "product_count",
  "current_plan_status",
  "current_plan_name",
  "duration_days",
  "total_price",
  "currency_code",
  "message_text",
  "whatsapp_link",
  "payment_reference",
  "payment_method",
  "payment_instructions",
  "payment_bank_name",
  "payment_account_name",
  "payment_account_number",
  "payment_iban",
  "payment_proof_status",
  "merchant_note",
  "review_note",
  "paid_amount",
  "paid_currency_code",
  "paid_at",
  "payment_due_at",
  "last_proof_submitted_at",
  "status",
  "requested_at",
  "resolved_at",
  "resolved_by_user_id",
  "activated_at",
  "activated_by_user_id",
]);

function buildPlanRequestProjectionSql(alias = "") {
  const prefix = String(alias || "").trim();
  return PLAN_REQUEST_COLUMNS
    .map((columnName) => (prefix ? `${prefix}.${columnName}` : columnName))
    .join(",\n  ");
}

const PLAN_REQUEST_SELECT_SQL = buildPlanRequestProjectionSql("requests");
const PLAN_REQUEST_RETURNING_SQL = buildPlanRequestProjectionSql();

function cleanText(value, maxLength = null) {
  const text = String(value || "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function cleanDigits(value, maxLength = 64) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
}

function normalizePlanRequestStatus(value, fallback = "pending_payment") {
  const normalized = cleanText(value).toLowerCase();
  return PLAN_REQUEST_STATUS_VALUES.has(normalized) ? normalized : fallback;
}

function normalizePaymentProofStatus(value, fallback = "not_submitted") {
  const normalized = cleanText(value).toLowerCase();
  return PAYMENT_PROOF_STATUS_VALUES.has(normalized) ? normalized : fallback;
}

function normalizePaymentProofReviewStatus(value, fallback = "submitted") {
  const normalized = cleanText(value).toLowerCase();
  return PAYMENT_PROOF_REVIEW_STATUS_VALUES.has(normalized) ? normalized : fallback;
}

function parseIsoDateOrNull(value) {
  const normalized = cleanText(value);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error("Indica uma data valida.");
    error.status = 400;
    throw error;
  }

  return parsed.toISOString();
}

function parseMoneyOrNull(value) {
  if (value == null || String(value).trim() === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    const error = new Error("Indica um valor de pagamento valido.");
    error.status = 400;
    throw error;
  }

  return Number(numeric.toFixed(2));
}

function parsePositiveIntegerSetting(value, fallback) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return fallback;
  return numeric;
}

function buildPaymentReference(referenceId = "") {
  const baseReference = cleanDigits(referenceId, 12) || randomBytes(3).toString("hex").toUpperCase();
  const timestampChunk = Date.now().toString().slice(-6);
  const randomChunk = randomBytes(2).toString("hex").toUpperCase();
  return `PLN-${baseReference}-${timestampChunk}-${randomChunk}`;
}

function buildPaymentSnapshot(systemSettings = {}, options = {}) {
  const deadlineHours = parsePositiveIntegerSetting(systemSettings.paymentProofDeadlineHours, 72);
  const requestedAt = options.requestedAt ? new Date(options.requestedAt) : new Date();
  const paymentDueAt = new Date(requestedAt.getTime() + deadlineHours * 60 * 60 * 1000).toISOString();

  return {
    paymentReference: buildPaymentReference(options.referenceId),
    paymentMethod: cleanText(systemSettings.paymentMethodLabel, 80) || "Transferencia bancaria",
    paymentInstructions: cleanText(systemSettings.paymentInstructions, 4000),
    paymentBankName: cleanText(systemSettings.paymentBankName, 160),
    paymentAccountName: cleanText(systemSettings.paymentAccountName, 160),
    paymentAccountNumber: cleanText(systemSettings.paymentAccountNumber, 80),
    paymentIban: cleanText(systemSettings.paymentIban, 80),
    paymentDueAt,
  };
}

function buildPlanPaymentFlowSchemaErrorMessage(missingRequirements = []) {
  const missingList = missingRequirements
    .map((entry) => `${entry.tableName}.${entry.columnName}`)
    .join(", ");

  const baseMessage = "A base de dados ainda nao foi atualizada para o novo fluxo de planos. Aplica backend/postgresql/migrations/20260426_plan_payment_flow.sql e corre npm run db:check:schema.";
  return missingList ? `${baseMessage} Em falta: ${missingList}.` : baseMessage;
}

async function getPlanPaymentFlowSchemaStatus(queryable) {
  let checks = await Promise.all(
    PLAN_PAYMENT_FLOW_SCHEMA_REQUIREMENTS.map(async (requirement) => ({
      ...requirement,
      present: await hasColumn(queryable, requirement.tableName, requirement.columnName),
    })),
  );

  let missingRequirements = checks.filter((entry) => !entry.present);
  if (missingRequirements.length) {
    const refreshedChecks = await Promise.all(
      PLAN_PAYMENT_FLOW_SCHEMA_REQUIREMENTS.map(async (requirement) => ({
        ...requirement,
        present: await hasColumn(
          queryable,
          requirement.tableName,
          requirement.columnName,
          "public",
          { refresh: true },
        ),
      })),
    );
    checks = refreshedChecks;
    missingRequirements = checks.filter((entry) => !entry.present);
  }

  return {
    ready: missingRequirements.length === 0,
    missingRequirements,
  };
}

async function assertPlanPaymentFlowSchema(queryable) {
  const status = await getPlanPaymentFlowSchemaStatus(queryable);
  if (status.ready) {
    return status;
  }

  const error = new Error(buildPlanPaymentFlowSchemaErrorMessage(status.missingRequirements));
  error.status = 503;
  error.code = "PLAN_PAYMENT_FLOW_SCHEMA_OUTDATED";
  error.missingRequirements = status.missingRequirements;
  throw error;
}

function isOpenPlanRequestStatus(value) {
  return OPEN_PLAN_REQUEST_STATUSES.has(normalizePlanRequestStatus(value));
}

function isFinalPlanRequestStatus(value) {
  return FINAL_PLAN_REQUEST_STATUSES.has(normalizePlanRequestStatus(value));
}

function resolvePlanActivationRequestAction(request, selection = {}) {
  if (!request) {
    return {
      action: "create",
      status: "",
      sameSelection: false,
      locked: false,
      replaceable: false,
    };
  }

  const status = normalizePlanRequestStatus(request.status);
  const currentPlanId = cleanText(request.plan_id ?? request.planId, 120);
  const currentDurationDays = Number(request.duration_days ?? request.durationDays ?? 0);
  const currentTotalPrice = Number(request.total_price ?? request.totalPrice ?? 0);
  const nextPlanId = cleanText(selection.planId, 120);
  const nextDurationDays = Number(selection.durationDays || 0);
  const nextTotalPrice = Number(selection.totalPrice || 0);
  const sameSelection =
    currentPlanId === nextPlanId
    && currentDurationDays === nextDurationDays
    && currentTotalPrice === nextTotalPrice;
  const locked = LOCKED_PLAN_REQUEST_STATUSES.has(status);
  const replaceable = REPLACEABLE_PLAN_REQUEST_STATUSES.has(status);

  if (sameSelection) {
    return {
      action: "reuse",
      status,
      sameSelection: true,
      locked,
      replaceable,
    };
  }

  if (replaceable) {
    return {
      action: "replace",
      status,
      sameSelection: false,
      locked: false,
      replaceable: true,
    };
  }

  return {
    action: "blocked",
    status,
    sameSelection: false,
    locked,
    replaceable: false,
  };
}

function toPlanPaymentProofPayload(row, options = {}) {
  return {
    id: row.id,
    requestId: row.request_id,
    submittedByUserId: row.submitted_by_user_id || "",
    reviewedByUserId: row.reviewed_by_user_id || "",
    originalFileName: row.original_file_name || "",
    mimeType: row.mime_type || "",
    sizeBytes: Number(row.size_bytes || 0),
    storageBucket: row.storage_bucket || "",
    storagePath: row.storage_path || "",
    payerName: row.payer_name || "",
    payerPhone: row.payer_phone || "",
    paymentReferenceText: row.payment_reference_text || "",
    paidAmount: row.paid_amount == null ? null : Number(row.paid_amount),
    paidCurrencyCode: row.paid_currency_code || "AOA",
    paidAt: row.paid_at || null,
    note: row.note || "",
    reviewStatus: normalizePaymentProofReviewStatus(row.review_status),
    reviewNote: row.review_note || "",
    submittedAt: row.submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    downloadUrl: options.downloadUrl || "",
  };
}

function toPlanActivationRequestPayload(row, options = {}) {
  const proofs = Array.isArray(options.proofs) ? options.proofs : [];
  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id,
    planId: row.plan_id,
    planCode: row.plan_code || "",
    planName: row.plan_name || "",
    storeName: row.store_name || "",
    merchantEmail: row.merchant_email || "",
    referenceId: row.reference_id || "",
    storeWhatsApp: row.store_whatsapp || "",
    productCount: Number(row.product_count || 0),
    currentPlanStatus: row.current_plan_status || "trial",
    currentPlanName: row.current_plan_name || "",
    durationDays: Number(row.duration_days || 0),
    totalPrice: Number(row.total_price || 0),
    currencyCode: row.currency_code || "AOA",
    messageText: row.message_text || "",
    whatsappLink: row.whatsapp_link || "",
    paymentReference: row.payment_reference || "",
    paymentMethod: row.payment_method || "",
    paymentInstructions: row.payment_instructions || "",
    paymentBankName: row.payment_bank_name || "",
    paymentAccountName: row.payment_account_name || "",
    paymentAccountNumber: row.payment_account_number || "",
    paymentIban: row.payment_iban || "",
    paymentProofStatus: normalizePaymentProofStatus(row.payment_proof_status),
    merchantNote: row.merchant_note || "",
    reviewNote: row.review_note || "",
    paidAmount: row.paid_amount == null ? null : Number(row.paid_amount),
    paidCurrencyCode: row.paid_currency_code || "AOA",
    paidAt: row.paid_at || null,
    paymentDueAt: row.payment_due_at || null,
    lastProofSubmittedAt: row.last_proof_submitted_at || null,
    status: normalizePlanRequestStatus(row.status),
    requestedAt: row.requested_at || null,
    resolvedAt: row.resolved_at || null,
    resolvedByUserId: row.resolved_by_user_id || "",
    activatedAt: row.activated_at || null,
    activatedByUserId: row.activated_by_user_id || "",
    proofs,
    latestProof: proofs[0] || null,
  };
}

async function buildSignedProofDownloadUrl(row) {
  const storageBucket = cleanText(row.storage_bucket);
  const storagePath = cleanText(row.storage_path);
  if (!storageBucket || !storagePath) {
    return "";
  }

  try {
    return await createSignedStorageUrl({
      bucket: storageBucket,
      objectPath: storagePath,
      expiresInSeconds: 900,
    });
  } catch (error) {
    return "";
  }
}

async function listPlanPaymentProofs(queryable, requestIds = []) {
  const safeRequestIds = [...new Set((requestIds || []).map((value) => cleanText(value)).filter(Boolean))];
  if (!safeRequestIds.length) {
    return new Map();
  }

  const result = await queryable.query(
    `select
       proofs.id,
       proofs.request_id,
       proofs.submitted_by_user_id,
       proofs.reviewed_by_user_id,
       proofs.original_file_name,
       proofs.mime_type,
       proofs.size_bytes,
       proofs.storage_bucket,
       proofs.storage_path,
       proofs.payer_name,
       proofs.payer_phone,
       proofs.payment_reference_text,
       proofs.paid_amount,
       proofs.paid_currency_code,
       proofs.paid_at,
       proofs.note,
       proofs.review_status,
       proofs.review_note,
       proofs.submitted_at,
       proofs.reviewed_at
     from public.catalog_plan_payment_proofs proofs
     where proofs.request_id = any($1::text[])
     order by proofs.submitted_at desc, proofs.id desc`,
    [safeRequestIds],
  );

  const proofsByRequestId = new Map();
  for (const row of result.rows) {
    const downloadUrl = await buildSignedProofDownloadUrl(row);
    const proof = toPlanPaymentProofPayload(row, { downloadUrl });
    const existing = proofsByRequestId.get(row.request_id) || [];
    existing.push(proof);
    proofsByRequestId.set(row.request_id, existing);
  }

  return proofsByRequestId;
}

async function mapPlanRequestsWithProofs(queryable, rows = []) {
  const requestIds = rows.map((row) => row.id).filter(Boolean);
  const proofsByRequestId = await listPlanPaymentProofs(queryable, requestIds);
  return rows.map((row) =>
    toPlanActivationRequestPayload(row, {
      proofs: proofsByRequestId.get(row.id) || [],
    }),
  );
}

export {
  PLAN_REQUEST_RETURNING_SQL,
  PLAN_REQUEST_SELECT_SQL,
  assertPlanPaymentFlowSchema,
  buildPaymentReference,
  buildPaymentSnapshot,
  buildPlanRequestProjectionSql,
  cleanDigits,
  cleanText,
  getPlanPaymentFlowSchemaStatus,
  isFinalPlanRequestStatus,
  isOpenPlanRequestStatus,
  listPlanPaymentProofs,
  mapPlanRequestsWithProofs,
  normalizePaymentProofReviewStatus,
  normalizePaymentProofStatus,
  normalizePlanRequestStatus,
  parseIsoDateOrNull,
  parseMoneyOrNull,
  resolvePlanActivationRequestAction,
  toPlanActivationRequestPayload,
  toPlanPaymentProofPayload,
};
