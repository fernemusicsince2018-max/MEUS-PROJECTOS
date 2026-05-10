import React from "react";
import { AlertTriangle, ArrowLeftRight, BarChart3, Bell, Check, ChevronDown, ChevronUp, Clock3, Copy, Crown, ExternalLink, Globe, ImagePlus, Package, RefreshCw, RotateCcw, Settings, ShieldCheck, Store, Trash2, User, UserCog, Users, Wallet, X } from "lucide-react";
import { FIELD_STYLE, PASSWORD_POLICY_HINT, STORE_CURRENCY_OPTIONS, SURFACE_STYLE, TEXTAREA_STYLE } from "../../constants.js";
import {
  formatPaymentProofStatusLabel,
  formatPlanRequestStatusLabel,
  getPaymentProofStatusTone,
  getPlanRequestStatusTone,
  isOpenPlanRequestStatus,
} from "../../utils/planRequests.js";
import FLabel from "../common/FLabel.jsx";
import BrandMark from "../common/BrandMark.jsx";
import SuperAdminFinanceTab from "./SuperAdminFinanceTab.jsx";
import { Badge, CollapsiblePanel, PreviewLine, StatTile, ToggleTile } from "../common/UiBits.jsx";

const ACCOUNT_STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "suspended", label: "Suspenso" },
];

const PLAN_STATUS_OPTIONS = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Ativo" },
  { value: "past_due", label: "Em atraso" },
  { value: "canceled", label: "Cancelado" },
];

const PLAN_DURATION_DEFAULT_DAYS = 30;
const PLAN_DURATION_STEP_DAYS = 30;
const PLAN_DURATION_OPTIONS = [
  { value: "7", label: "7 dias (Grátis)" },
  ...Array.from({ length: 12 }, (_, index) => {
  const days = (index + 1) * PLAN_DURATION_STEP_DAYS;
  return { value: String(days), label: `${days} dias` };
})];

const EMPTY_SUMMARY = {
  totalClients: 0,
  activeClients: 0,
  suspendedClients: 0,
  publicStores: 0,
  pendingAccessRequests: 0,
  activePlans: 0,
  trashedClients: 0,
  pendingPlanRequests: 0,
  totalAdminUsers: 0,
  activeAdminUsers: 0,
  suspendedAdminUsers: 0,
};

const EMPTY_PAGE_INFO = Object.freeze({
  total: 0,
  limit: 24,
  hasMore: false,
  endCursor: "",
});

const SUPER_ADMIN_ACCESS_OPTIONS = Object.freeze([
  {
    key: "clientes",
    label: "Clientes",
    description: "Ver, filtrar e gerir contas lojistas.",
  },
  {
    key: "equipa",
    label: "Equipa",
    description: "Abrir a área dos admins auxiliares.",
  },
  {
    key: "financeiro",
    label: "Financeiro",
    description: "Consultar eventos e histórico financeiro.",
  },
  {
    key: "lixo",
    label: "Lixo",
    description: "Recuperar ou eliminar empresas removidas.",
  },
  {
    key: "planos",
    label: "Planos",
    description: "Criar pacotes e ajustar precos sem mexer no codigo.",
  },
  {
    key: "configuracoes",
    label: "Configuracoes",
    description: "Alterar variaveis globais da plataforma.",
  },
]);

const DEFAULT_SUPER_ADMIN_ACCESS = Object.freeze({
  clientes: true,
  equipa: false,
  financeiro: false,
  lixo: false,
  planos: false,
  configuracoes: false,
});

const FULL_SUPER_ADMIN_ACCESS = Object.freeze({
  clientes: true,
  equipa: true,
  financeiro: true,
  lixo: true,
  planos: true,
  configuracoes: true,
});

const SUPER_ADMIN_PRIMARY_TABS = Object.freeze([
  ["clientes", "Clientes", Users],
  ["equipa", "Equipa", UserCog],
  ["financeiro", "Financeiro", BarChart3],
  ["lixo", "Lixo", Trash2],
  ["planos", "Planos", Wallet],
]);

function getDefaultSuperAdminAccess() {
  return { ...DEFAULT_SUPER_ADMIN_ACCESS };
}

function getFullSuperAdminAccess() {
  return { ...FULL_SUPER_ADMIN_ACCESS };
}

function normalizeSuperAdminAccess(value, options = {}) {
  if (options.fullAccess) {
    return getFullSuperAdminAccess();
  }

  let rawValue = value;
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    rawValue = {};
  }

  const next = getDefaultSuperAdminAccess();
  for (const option of SUPER_ADMIN_ACCESS_OPTIONS) {
    if (option.key === "clientes") {
      next[option.key] = true;
      continue;
    }

    next[option.key] = Boolean(rawValue[option.key]);
  }

  return next;
}

function setSuperAdminAccessValue(value, accessKey, checked, options = {}) {
  const next = normalizeSuperAdminAccess(value, options);
  if (accessKey !== "clientes") {
    next[accessKey] = Boolean(checked);
  }
  return next;
}

function getEnabledSuperAdminAccessOptions(value, options = {}) {
  const normalized = normalizeSuperAdminAccess(value, options);
  return SUPER_ADMIN_ACCESS_OPTIONS.filter((option) => normalized[option.key]);
}

function createEmptyAdminUserDraft() {
  return {
    userId: "",
    fullName: "",
    email: "",
    password: "",
    accountStatus: "active",
    superAdminAccess: getDefaultSuperAdminAccess(),
  };
}

const EMPTY_ADMIN_USER_DRAFT = createEmptyAdminUserDraft();

const EMPTY_PLAN_DRAFT = {
  id: "",
  code: "",
  name: "",
  description: "",
  priceMonthly: "5000",
  currencyCode: "AOA",
  maxProducts: "",
  maxTeamMembers: "",
  active: true,
  sortOrder: "0",
};

const TAB_BUTTON_STYLE = {
  padding: "14px 14px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginBottom: "-1px",
};

const ACTION_BUTTON_STYLE = {
  border: "none",
  borderRadius: "var(--border-radius-md)",
  padding: "11px 14px",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
};

const CLIENT_VIEW_OPTIONS = Object.freeze([
  { value: "list", label: "Lista" },
  { value: "grid", label: "Grelha" },
]);

const DEFAULT_CLIENT_VIEW_MODE = "list";
const CLIENT_VIEW_STORAGE_KEY = "cat:superadmin-client-view";

const PROFILE_IMAGE_DATA_URL_MAX_LENGTH = 400000;
const PROFILE_IMAGE_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const PROFILE_IMAGE_MAX_DIMENSION = 320;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PENDING_ACCESS_PREVIEW_LIMIT = 6;
const SYSTEM_SETTING_LABELS = Object.freeze({
  support_whatsapp: "WhatsApp de suporte",
  trial_enabled: "Trial gratis para novas contas",
  trial_days: "Dias de trial",
  default_plan_days: "Dias padrao do plano",
  maintenance_mode: "Modo de manutencao",
  app_maintenance: "Modo de manutencao",
  merchant_registration_enabled: "Cadastro público de lojistas",
  max_free_products: "Limite de produtos gratis",
  payment_proof_deadline_hours: "Prazo do comprovativo",
  payment_method_label: "Metodo",
  payment_instructions: "Instrucoes de pagamento",
  payment_bank_name: "Banco",
  payment_account_name: "Titular",
  payment_account_number: "Conta",
  payment_iban: "IBAN",
});

const SYSTEM_SETTING_SORT_ORDER = Object.freeze({
  support_whatsapp: 10,
  trial_enabled: 20,
  trial_days: 30,
  default_plan_days: 31,
  max_free_products: 40,
  merchant_registration_enabled: 50,
  maintenance_mode: 60,
  app_maintenance: 61,
  payment_proof_deadline_hours: 70,
  payment_method_label: 71,
  payment_bank_name: 72,
  payment_account_name: 73,
  payment_account_number: 74,
  payment_iban: 75,
  payment_instructions: 76,
});

const BOOLEAN_SETTING_DEFAULTS = Object.freeze({
  trial_enabled: true,
  maintenance_mode: false,
  app_maintenance: false,
  merchant_registration_enabled: true,
});

function toDateInputValue(value) {
  return value ? String(value).slice(0, 10) : "";
}

function buildTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToDateInput(value, days) {
  const raw = String(value || "").trim();
  const parsedDays = Number(days || 0);

  if (!raw || !Number.isInteger(parsedDays) || parsedDays < 1) {
    return "";
  }

  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return "";

  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return "";

  date.setUTCDate(date.getUTCDate() + parsedDays);
  return date.toISOString().slice(0, 10);
}

function calculatePlanTotalPrice(basePrice, durationDays) {
  const price = Number(basePrice || 0);
  const days = Number(durationDays || 0);
  if (!Number.isFinite(price) || !Number.isFinite(days) || (days < PLAN_DURATION_DEFAULT_DAYS && days !== 7)) {
    return 0;
  }

  return price * (days / PLAN_DURATION_STEP_DAYS);
}

function getPlanDefinition(plans, planId) {
  return plans.find((plan) => plan.id === planId) || null;
}

function supportsCountdownPlanStatus(planStatus) {
  const normalized = String(planStatus || "").trim().toLowerCase();
  return normalized === "active" || normalized === "trial";
}

function isPendingAccessClient(client) {
  return !String(client?.storeId || "").trim();
}

function syncClientDraft(draft, plans) {
  const next = { ...draft };

  if (!next.planId) {
    next.planStartedAt = "";
    next.planExpiresAt = "";
    next.planDurationDays = "";
    next.planTotalPrice = 0;
    next.planCurrencyCode = "AOA";
    return next;
  }

  const selectedPlan = getPlanDefinition(plans, next.planId);
  const durationDays = Number(next.planDurationDays || PLAN_DURATION_DEFAULT_DAYS);
  const safeDurationDays =
    Number.isInteger(durationDays) && (durationDays === 7 || durationDays >= PLAN_DURATION_DEFAULT_DAYS)
      ? durationDays
      : PLAN_DURATION_DEFAULT_DAYS;
  const startedAt = next.planStartedAt || buildTodayDateInputValue();

  next.planStartedAt = startedAt;
  next.planDurationDays = String(safeDurationDays);
  next.planExpiresAt = addDaysToDateInput(startedAt, safeDurationDays);
  next.planTotalPrice = calculatePlanTotalPrice(selectedPlan?.priceMonthly ?? 0, safeDurationDays);
  next.planCurrencyCode = selectedPlan?.currencyCode || next.planCurrencyCode || "AOA";

  return next;
}

function toClientDraft(client, plans) {
  return {
    ...syncClientDraft(
      {
        ...client,
        planStartedAt: toDateInputValue(client.planStartedAt),
        planExpiresAt: toDateInputValue(client.planExpiresAt),
        planDurationDays:
          client.planDurationDays === "" || client.planDurationDays == null
            ? client.planId
              ? String(PLAN_DURATION_DEFAULT_DAYS)
              : ""
            : String(client.planDurationDays),
        planTotalPrice: Number(client.planTotalPrice || 0),
        planCurrencyCode: client.planCurrencyCode || "AOA",
        referenceId: client.referenceId || "",
      },
      plans,
    ),
    internalNotes: client.internalNotes || "",
  };
}

function toPlanDraft(plan) {
  return {
    id: plan.id || "",
    code: plan.code || "",
    name: plan.name || "",
    description: plan.description || "",
    priceMonthly: String(plan.priceMonthly ?? 5000),
    currencyCode: plan.currencyCode || "AOA",
    maxProducts: plan.maxProducts === "" || plan.maxProducts == null ? "" : String(plan.maxProducts),
    maxTeamMembers: plan.maxTeamMembers === "" || plan.maxTeamMembers == null ? "" : String(plan.maxTeamMembers),
    active: Boolean(plan.active),
    sortOrder: String(plan.sortOrder ?? 0),
  };
}

function toAdminUserDraft(adminUser) {
  return {
    userId: adminUser?.userId || "",
    fullName: adminUser?.fullName || "",
    email: adminUser?.email || "",
    password: "",
    accountStatus: adminUser?.accountStatus || "active",
    superAdminAccess: normalizeSuperAdminAccess(adminUser?.superAdminAccess, { fullAccess: Boolean(adminUser?.isProtected) }),
  };
}

function trimSelectionToAllowed(currentSelection, allowedIds) {
  const allowed = new Set(allowedIds);
  let changed = false;
  const next = new Set();

  currentSelection.forEach((id) => {
    if (allowed.has(id)) {
      next.add(id);
    } else {
      changed = true;
    }
  });

  return changed ? next : currentSelection;
}

function formatDateLabel(value) {
  if (!value) return "Sem registo";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registo";
  return date.toLocaleDateString("pt-PT");
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

function formatPlanStatusLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "active") return "Ativo";
  if (normalized === "past_due") return "Em atraso";
  if (normalized === "canceled") return "Cancelado";
  if (normalized === "trial") return "Trial";
  return "Sem plano";
}

function formatMoney(value, currencyCode) {
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

function formatSettingLabel(key) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return "Variavel do sistema";
  if (SYSTEM_SETTING_LABELS[normalizedKey]) return SYSTEM_SETTING_LABELS[normalizedKey];

  return normalizedKey
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => {
      const lowerWord = word.toLowerCase();
      if (lowerWord === "whatsapp") return "WhatsApp";
      return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
    })
    .join(" ");
}

function formatSettingSummaryValue(key, value) {
  const normalizedKey = String(key || "").trim();
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return "Sem valor";

  if (normalizedKey === "trial_enabled" || normalizedKey === "maintenance_mode" || normalizedKey === "app_maintenance" || normalizedKey === "merchant_registration_enabled") {
    return normalizedValue.toLowerCase() === "true" ? "Ativado" : "Desativado";
  }

  if (normalizedKey === "trial_days" || normalizedKey === "default_plan_days") {
    const totalDays = Number(normalizedValue);
    return Number.isFinite(totalDays) ? `${totalDays} dias` : normalizedValue;
  }

  if (normalizedKey === "max_free_products") {
    const totalProducts = Number(normalizedValue);
    return Number.isFinite(totalProducts) ? `${totalProducts} produtos` : normalizedValue;
  }

  if (normalizedKey === "payment_proof_deadline_hours") {
    const totalHours = Number(normalizedValue);
    return Number.isFinite(totalHours) ? `${totalHours} horas` : normalizedValue;
  }

  if (normalizedKey === "payment_instructions" && normalizedValue.length > 64) {
    return `${normalizedValue.slice(0, 61)}...`;
  }

  return normalizedValue;
}

function sortSettingEntries(entries = []) {
  return [...entries].sort(([leftKey], [rightKey]) => {
    const leftOrder = SYSTEM_SETTING_SORT_ORDER[leftKey] ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = SYSTEM_SETTING_SORT_ORDER[rightKey] ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(leftKey || "").localeCompare(String(rightKey || ""), "pt", { sensitivity: "base" });
  });
}

function isBooleanSettingKey(key) {
  return Object.prototype.hasOwnProperty.call(BOOLEAN_SETTING_DEFAULTS, String(key || "").trim());
}

function parseBooleanSettingDraft(key, value) {
  const normalizedKey = String(key || "").trim();
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (["1", "true", "yes", "on", "sim"].includes(normalizedValue)) return true;
  if (["0", "false", "no", "off", "nao", "não"].includes(normalizedValue)) return false;
  return BOOLEAN_SETTING_DEFAULTS[normalizedKey] ?? false;
}

function getCalendarDayTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return Number.NaN;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getCalendarDayEndTimestamp(value) {
  const dayStart = getCalendarDayTimestamp(value);
  if (!Number.isFinite(dayStart)) return Number.NaN;
  return dayStart + DAY_IN_MS - 1;
}

function formatRemainingUnit(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function joinRemainingParts(parts) {
  if (parts.length <= 1) return parts[0] || "";
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

function getPlanCountdown(planStatus, planExpiresAt, referenceDate = new Date()) {
  const normalizedStatus = String(planStatus || "").trim().toLowerCase();
  if (!supportsCountdownPlanStatus(normalizedStatus) || !planExpiresAt) {
    return null;
  }

  const expiresAtTime = getCalendarDayTimestamp(planExpiresAt);
  const todayTime = getCalendarDayTimestamp(referenceDate);
  if (!Number.isFinite(expiresAtTime) || !Number.isFinite(todayTime)) {
    return null;
  }

  const daysRemaining = Math.ceil((expiresAtTime - todayTime) / DAY_IN_MS);
  const isTrial = normalizedStatus === "trial";
  const subject = isTrial ? "Trial" : "Plano";
  if (daysRemaining < 0) {
    const daysExpired = Math.abs(daysRemaining);
    return {
      daysRemaining,
      bg: "#fee2e2",
      color: "#b91c1c",
      label: daysExpired === 1 ? `${subject} expirou ontem` : `${subject} expirou ha ${daysExpired} dias`,
    };
  }

  if (daysRemaining === 0) {
    return {
      daysRemaining,
      bg: "#fef3c7",
      color: "#b45309",
      label: isTrial ? "Trial termina hoje" : "Termina hoje",
    };
  }

  if (daysRemaining <= 7) {
    return {
      daysRemaining,
      bg: "#fef3c7",
      color: "#b45309",
      label: daysRemaining === 1
        ? (isTrial ? "Trial: 1 dia restante" : "1 dia restante")
        : (isTrial ? `Trial: ${daysRemaining} dias restantes` : `${daysRemaining} dias restantes`),
    };
  }

  return {
    daysRemaining,
    bg: "#dcfce7",
    color: "#166534",
    label: daysRemaining === 1
      ? (isTrial ? "Trial: 1 dia restante" : "1 dia restante")
      : (isTrial ? `Trial: ${daysRemaining} dias restantes` : `${daysRemaining} dias restantes`),
  };
}

function getPlanTimeRemaining(planStatus, planExpiresAt, referenceTime = Date.now()) {
  const normalizedStatus = String(planStatus || "").trim().toLowerCase();
  if (!supportsCountdownPlanStatus(normalizedStatus) || !planExpiresAt) {
    return null;
  }

  const expiresAtTime = getCalendarDayEndTimestamp(planExpiresAt);
  const nowTime = referenceTime instanceof Date ? referenceTime.getTime() : Number(referenceTime);
  if (!Number.isFinite(expiresAtTime) || !Number.isFinite(nowTime)) {
    return null;
  }

  const diffMs = expiresAtTime - nowTime;
  if (diffMs < 0) {
    const daysExpired = Math.max(1, Math.ceil(Math.abs(diffMs) / DAY_IN_MS));
    return {
      compactLabel: "Tempo esgotado",
      detailLabel: daysExpired === 1 ? "Expirou ontem." : `Expirou ha ${daysExpired} dias.`,
      bg: "#fff1f2",
      color: "#9f1239",
      borderColor: "#fecdd3",
    };
  }

  const totalMinutes = Math.max(0, Math.ceil(diffMs / (60 * 1000)));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const compactParts = [];
  const detailParts = [];

  if (days > 0) {
    compactParts.push(`${days}d`);
    detailParts.push(formatRemainingUnit(days, "dia", "dias"));
  }

  compactParts.push(`${String(hours).padStart(2, "0")}h`);
  compactParts.push(`${String(minutes).padStart(2, "0")}m`);

  if (hours > 0 || days > 0) {
    detailParts.push(formatRemainingUnit(hours, "hora", "horas"));
  }
  detailParts.push(formatRemainingUnit(minutes, "minuto", "minutos"));

  const warning = days <= 7;
  const isTrial = normalizedStatus === "trial";
  return {
    compactLabel: compactParts.join(" "),
    detailLabel: isTrial
      ? `Faltam ${joinRemainingParts(detailParts)} para o trial terminar.`
      : `Faltam ${joinRemainingParts(detailParts)}.`,
    bg: warning ? "#fff7ed" : "#ecfdf5",
    color: warning ? "#9a3412" : "#166534",
    borderColor: warning ? "#fed7aa" : "#bbf7d0",
  };
}

function isUrgentPlanCountdown(countdown, maxDays = 3) {
  const daysRemaining = Number(countdown?.daysRemaining);
  return Number.isFinite(daysRemaining) && daysRemaining >= 0 && daysRemaining <= maxDays;
}

function getAvatarInitials(name, email) {
  const source = String(name || email || "?").trim();
  if (!source) return "?";

  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  }

  return source.slice(0, 1).toUpperCase();
}

function normalizeClientViewMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return CLIENT_VIEW_OPTIONS.some((option) => option.value === normalized) ? normalized : DEFAULT_CLIENT_VIEW_MODE;
}

function getInitialClientViewMode() {
  if (typeof window === "undefined") {
    return DEFAULT_CLIENT_VIEW_MODE;
  }

  try {
    return normalizeClientViewMode(window.localStorage.getItem(CLIENT_VIEW_STORAGE_KEY));
  } catch (error) {
    return DEFAULT_CLIENT_VIEW_MODE;
  }
}

function isProfilePhotoDataUrl(value) {
  return /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i.test(String(value || "").trim());
}

function isProfilePhotoHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function validateProfilePhoto(value) {
  const photo = String(value || "").trim();
  if (!photo) return "";

  if (isProfilePhotoHttpUrl(photo)) {
    if (photo.length > 2048) {
      return "O link da foto e demasiado longo.";
    }

    return "";
  }

  if (isProfilePhotoDataUrl(photo)) {
    if (photo.length > PROFILE_IMAGE_DATA_URL_MAX_LENGTH) {
      return "A foto ficou grande demais. Usa uma imagem menor.";
    }

    return "";
  }

  return "Usa uma URL http/https valida ou carrega uma imagem do teu dispositivo.";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel preparar a imagem selecionada."));
    image.src = src;
  });
}

async function buildProfilePhotoDataUrl(file) {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Seleciona um ficheiro de imagem valido.");
  }

  if (Number(file.size || 0) > PROFILE_IMAGE_MAX_FILE_SIZE_BYTES) {
    throw new Error("A foto deve ter ate 2 MB.");
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(sourceDataUrl);
  const width = image.naturalWidth || image.width || PROFILE_IMAGE_MAX_DIMENSION;
  const height = image.naturalHeight || image.height || PROFILE_IMAGE_MAX_DIMENSION;
  const scale = Math.min(1, PROFILE_IMAGE_MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Nao foi possivel preparar a foto agora.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const optimizedDataUrl = mimeType === "image/png"
    ? canvas.toDataURL(mimeType)
    : canvas.toDataURL(mimeType, 0.82);

  if (optimizedDataUrl.length > PROFILE_IMAGE_DATA_URL_MAX_LENGTH) {
    throw new Error("A foto ficou grande demais mesmo apos otimizar. Escolhe outra imagem.");
  }

  return optimizedDataUrl;
}

function playNotificationSound() {
  const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
  audio.play().catch((error) => {
    console.warn("Autoplay bloqueado pelo browser. Interage com a página para ativar sons.", error);
  });
}

function SuperAdminAccessEditor({ value, onChange, disabled = false, accent, defaultOpen = false }) {
  const access = normalizeSuperAdminAccess(value);
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const enabledCount = SUPER_ADMIN_ACCESS_OPTIONS.filter((option) => Boolean(access[option.key])).length;
  const hiddenSummary = enabledCount === 1
    ? "Clientes ativo por padrao."
    : `${enabledCount} areas ativas nesta conta.`;

  return (
    <div style={{ display: "grid", gap: "10px", padding: "14px", borderRadius: "18px", border: "1px solid var(--color-border-tertiary)", background: "rgba(255,255,255,0.55)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: "4px" }}>
          <div style={{ fontSize: "12px", fontWeight: "800", color: "var(--color-text-primary)" }}>Areas do painel</div>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
            {isOpen ? "Liga ou desliga as areas que este admin pode abrir." : hiddenSummary}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          style={{
            ...ACTION_BUTTON_STYLE,
            background: isOpen ? "var(--color-background-secondary)" : accent,
            color: isOpen ? "var(--color-text-primary)" : "white",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isOpen ? "Esconder" : "Mostrar"}
        </button>
      </div>

      {isOpen ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
          {SUPER_ADMIN_ACCESS_OPTIONS.map((option) => {
            const checked = Boolean(access[option.key]);
            const locked = option.key === "clientes";

            return (
              <label
                key={option.key}
                style={{
                  display: "grid",
                  gap: "6px",
                  padding: "14px",
                  borderRadius: "18px",
                  border: `1px solid ${checked ? `${accent}33` : "var(--color-border-tertiary)"}`,
                  background: checked ? `${accent}10` : "var(--color-background-secondary)",
                  cursor: disabled || locked ? "default" : "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--color-text-primary)" }}>{option.label}</div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled || locked}
                    onChange={(event) => onChange(option.key, event.target.checked)}
                  />
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{option.description}</div>
                {locked ? (
                  <div style={{ fontSize: "11px", fontWeight: "700", color: accent }}>Clientes fica sempre ativo para este tipo de conta.</div>
                ) : null}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ProfileModal({ user, onSave, onClose, accent, busy }) {
  const [form, setForm] = React.useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    avatarUrl: user?.avatarUrl || "",
  });
  const [error, setError] = React.useState("");
  const [isFormVisible, setIsFormVisible] = React.useState(true);
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    setForm({
      fullName: user?.fullName || "",
      email: user?.email || "",
      avatarUrl: user?.avatarUrl || "",
    });
    setError("");
    setIsFormVisible(true);
  }, [user]);

  async function handlePhotoSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const avatarUrl = await buildProfilePhotoDataUrl(file);
      setForm((current) => ({ ...current, avatarUrl }));
      setError("");
    } catch (failure) {
      setError(failure.message || "Nao foi possivel carregar a foto.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSubmit() {
    const email = String(form.email || "").trim();
    const avatarUrl = String(form.avatarUrl || "").trim();
    const photoError = validateProfilePhoto(avatarUrl);

    if (!email || !email.includes("@")) {
      setError("Indica um email valido.");
      return;
    }

    if (photoError) {
      setError(photoError);
      return;
    }

    setError("");
    try {
      const result = await onSave({
        fullName: String(form.fullName || "").trim(),
        email,
        avatarUrl,
      });

      if (result?.ok === false) {
        setError(result.errorMessage || "Nao foi possivel guardar o perfil.");
      }
    } catch (failure) {
      setError(failure.message || "Nao foi possivel guardar o perfil.");
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "20px" }}>
      <div style={{ ...SURFACE_STYLE, width: "100%", maxWidth: "460px", padding: "0", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "20px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: accent, display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              <UserCog size={18} />
            </div>
            <div style={{ fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Meu Perfil Admin</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}><X size={20} /></button>
        </div>
        
        <div style={{ padding: "20px", display: "grid", gap: "16px" }}>
          <CollapsiblePanel
            title="Formulario do perfil"
            description="Podes ocultar estes campos e deixar apenas um resumo visivel antes de guardar."
            open={isFormVisible}
            onToggle={() => setIsFormVisible((current) => !current)}
            summary={
              <div style={{ display: "grid", gap: "10px" }}>
                <PreviewLine label="Nome" value={form.fullName || "Sem nome"} />
                <PreviewLine label="Email" value={form.email || "Sem email"} />
                <PreviewLine label="Foto" value={form.avatarUrl ? "Configurada" : "Sem foto"} />
              </div>
            }
            style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}
          >
          <FLabel label="Foto do perfil" hint="Podes carregar uma imagem do dispositivo ou colar uma URL publica.">
            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <UserAvatar name={form.fullName} email={form.email} avatarUrl={form.avatarUrl} accent={accent} size={72} />
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: "none" }} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ ...ACTION_BUTTON_STYLE, background: "var(--color-background-secondary)", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <ImagePlus size={14} /> Carregar foto
                  </button>
                  {form.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm((current) => ({ ...current, avatarUrl: "" }));
                        setError("");
                      }}
                      style={{ ...ACTION_BUTTON_STYLE, background: "#fff1f2", color: "#be123c", display: "flex", alignItems: "center", gap: "8px" }}
                    >
                      <Trash2 size={14} /> Remover
                    </button>
                  )}
                </div>
              </div>
              <input
                value={form.avatarUrl}
                onChange={(event) => {
                  setForm((current) => ({ ...current, avatarUrl: event.target.value }));
                  setError("");
                }}
                style={FIELD_STYLE}
                placeholder="https://cdn.exemplo.com/minha-foto.jpg"
              />
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                Se escolheres um ficheiro local, a imagem é otimizada automaticamente antes de guardar.
              </div>
            </div>
          </FLabel>
          <FLabel label="Nome Completo">
            <input 
              value={form.fullName} 
              onChange={e => {
                setForm({...form, fullName: e.target.value});
                setError("");
              }} 
              style={FIELD_STYLE} 
              placeholder="Teu nome soberano"
            />
          </FLabel>
          <FLabel label="Email de Acesso" hint="Este email é usado para o login de Super Admin.">
            <input 
              value={form.email} 
              onChange={e => {
                setForm({...form, email: e.target.value});
                setError("");
              }} 
              style={FIELD_STYLE} 
              placeholder="admin@exemplo.com"
            />
          </FLabel>
          
          </CollapsiblePanel>
          {error && <div style={{ padding: "10px 12px", borderRadius: "12px", background: "#fee2e2", color: "#b91c1c", fontSize: "12px", fontWeight: "700" }}>{error}</div>}
          <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
            <button type="button" onClick={onClose} style={{ ...ACTION_BUTTON_STYLE, flex: 1, background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }}>
              Cancelar
            </button>
            <button 
              disabled={busy}
              type="button"
              onClick={handleSubmit} 
              style={{ ...ACTION_BUTTON_STYLE, flex: 1, background: accent, color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              {busy ? "A guardar..." : <><Check size={16} /> Guardar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const PULSE_ANIMATION = `
@keyframes avatar-attention-pulse {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
  70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}
`;

function UserAvatar({ name, email, accent, pulse, avatarUrl, size = 24 }) {
  const initials = getAvatarInitials(name, email);
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  const photo = String(avatarUrl || "").trim();
  const showPhoto = Boolean(photo) && !imageFailed;

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: showPhoto ? "var(--color-background-primary)" : accent,
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: Math.max(10, Math.round(size * 0.4)),
      fontWeight: "800",
      flexShrink: 0,
      overflow: "hidden",
      animation: pulse ? "avatar-attention-pulse 2s infinite" : "none",
      border: pulse ? `${Math.max(2, Math.round(size * 0.08))}px solid #ef4444` : "none"
    }}>
      {showPhoto ? (
        <img
          src={photo}
          alt={name || email || "Avatar"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

function PlanDistributionChart({ plans, filteredClients, accent }) {
  // Calculamos a distribuição com base nos clientes atualmente filtrados
  const counts = filteredClients.reduce((acc, client) => {
    if (client.planId) {
      acc[client.planId] = (acc[client.planId] || 0) + 1;
    }
    return acc;
  }, {});

  const totalStores = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalStores === 0) return null;

  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-text-secondary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Distribuição da Base de Clientes
      </div>
      <div style={{ display: "flex", height: "14px", borderRadius: "7px", overflow: "hidden", background: "var(--color-background-secondary)", width: "100%", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)" }}>
        {plans.map((plan, idx) => {
          const count = counts[plan.id] || 0;
          if (count === 0) return null;
          const pct = (count / totalStores) * 100;
          return (
            <div
              key={plan.id}
              style={{ width: `${pct}%`, backgroundColor: accent, opacity: 1 - (idx * 0.2), transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)", borderRight: idx < plans.length - 1 ? "1px solid rgba(255,255,255,0.2)" : "none" }}
              title={`${plan.name}: ${count} lojas (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "12px" }}>
        {plans.map((plan, idx) => (
          <div key={plan.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--color-text-secondary)" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "3px", backgroundColor: accent, opacity: 1 - (idx * 0.2) }} />
            <span>{plan.name}: <strong>{counts[plan.id] || 0}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuperAdminPanel({
  brand,
  session,
  data,
  tab,
  setTab,
  onClientsQueryChange,
  onLoadMoreClients,
  onTrashedClientsQueryChange,
  onLoadMoreTrashedClients,
  onLoadMoreFinancialEvents,
  onLogout,
  onRefresh,
  onSaveClient,
  onSaveAdminUser,
  onClientLifecycle,
  onSavePlan,
  onSaveSetting,
  onReviewPlanRequest,
  busy,
  toast,
  toastNode,
}) {
  const summary = data?.summary || EMPTY_SUMMARY;
  const plans = data?.plans || [];
  const clients = data?.clients || [];
  const clientPageInfo = data?.clientPageInfo || EMPTY_PAGE_INFO;
  const trashedClients = data?.trashedClients || [];
  const trashedClientPageInfo = data?.trashedClientPageInfo || EMPTY_PAGE_INFO;
  const recentClients = data?.recentClients || [];
  const urgentClients = data?.urgentClients || [];
  const urgentClientsTotal = Number(data?.urgentClientsTotal || 0);
  const rawPendingAccessRequests = data?.pendingAccessRequests || [];
  const adminUsers = data?.adminUsers || [];
  const adminPermissions = data?.permissions || { canManageAdminUsers: false, access: getDefaultSuperAdminAccess() };
  const financialEvents = data?.financialEvents || [];
  const financialEventPageInfo = data?.financialEventPageInfo || { ...EMPTY_PAGE_INFO, limit: 50 };
  const planActivationRequests = data?.planActivationRequests || [];
  const [search, setSearch] = React.useState("");
  const [adminSearch, setAdminSearch] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [clientViewMode, setClientViewMode] = React.useState(() => getInitialClientViewMode());
  const [clientDrafts, setClientDrafts] = React.useState({});
  const [adminUserDrafts, setAdminUserDrafts] = React.useState({});
  const [newAdminUserDraft, setNewAdminUserDraft] = React.useState(() => createEmptyAdminUserDraft());
  const [openClientFormUserId, setOpenClientFormUserId] = React.useState("");
  const [isNewAdminUserFormOpen, setIsNewAdminUserFormOpen] = React.useState(false);
  const [openAdminUserFormUserId, setOpenAdminUserFormUserId] = React.useState("");
  const [planDrafts, setPlanDrafts] = React.useState({});
  const [newPlanDraft, setNewPlanDraft] = React.useState(EMPTY_PLAN_DRAFT);
  const [isNewPlanFormOpen, setIsNewPlanFormOpen] = React.useState(false);
  const [openPlanFormId, setOpenPlanFormId] = React.useState("");
  const [isConfiguredPlansOpen, setIsConfiguredPlansOpen] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = React.useState(false);
  const [savedKeys, setSavedKeys] = React.useState(new Set());
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);
  const [countdownNow, setCountdownNow] = React.useState(() => Date.now());
  const [settingsDrafts, setSettingsDrafts] = React.useState({});
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = React.useState(true);
  const [selectedClientIds, setSelectedClientIds] = React.useState(new Set());
  const [selectedTrashedClientIds, setSelectedTrashedClientIds] = React.useState(new Set());
  const prevClientsCount = React.useRef(summary.totalClients);
  const prevPendingPlanRequestsCount = React.useRef(planActivationRequests.length);
  const menuRef = React.useRef(null);
  const notificationPanelRef = React.useRef(null);
  const lastClientsQuerySignatureRef = React.useRef("");
  const lastTrashedQuerySignatureRef = React.useRef("");

  React.useEffect(() => {
    setClientDrafts(Object.fromEntries(clients.map((client) => [client.userId, toClientDraft(client, plans)])));

    // Lógica para detectar novos registros e tocar o som
    if (summary.totalClients > prevClientsCount.current && prevClientsCount.current > 0) {
      playNotificationSound();
      if (toast) {
        const newClient = clients[0]; // O backend já envia ordenado por data
        toast(`🚀 Novo cliente: ${newClient.storeName || newClient.email}`);
      }
    }
    
    // Atualiza a referência para a próxima comparação
    prevClientsCount.current = summary.totalClients;
  }, [clients, plans, summary.totalClients, toast]);

  React.useEffect(() => {
    setAdminUserDrafts(Object.fromEntries(adminUsers.map((adminUser) => [adminUser.userId, toAdminUserDraft(adminUser)])));
  }, [adminUsers]);

  React.useEffect(() => {
    if (planActivationRequests.length > prevPendingPlanRequestsCount.current && prevPendingPlanRequestsCount.current > 0) {
      playNotificationSound();
      if (toast) {
        const latestRequest = planActivationRequests[0];
        toast(`Novo pedido de ativacao: ${latestRequest?.storeName || latestRequest?.merchantEmail || "Loja sem nome"}`);
      }
    }

    prevPendingPlanRequestsCount.current = planActivationRequests.length;
  }, [planActivationRequests, toast]);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target)) {
        setIsNotificationPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(CLIENT_VIEW_STORAGE_KEY, clientViewMode);
    } catch (error) {
      // Ignora falhas de persistencia para nao bloquear o painel.
    }
  }, [clientViewMode]);

  React.useEffect(() => {
    if (tab !== "clientes" || !onClientsQueryChange) {
      return undefined;
    }

    const normalizedSearch = search.trim();
    const signature = [normalizedSearch, dateFrom, dateTo].join("::");
    const previousSignature = lastClientsQuerySignatureRef.current;

    if (!previousSignature) {
      lastClientsQuerySignatureRef.current = signature;
      if (!normalizedSearch && !dateFrom && !dateTo) {
        return undefined;
      }
    }

    if (previousSignature === signature) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      lastClientsQuerySignatureRef.current = signature;
      onClientsQueryChange({
        search: normalizedSearch,
        dateFrom,
        dateTo,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [tab, search, dateFrom, dateTo, onClientsQueryChange]);

  React.useEffect(() => {
    if (tab !== "lixo" || !onTrashedClientsQueryChange) {
      return undefined;
    }

    const normalizedSearch = search.trim();
    const signature = normalizedSearch;
    const previousSignature = lastTrashedQuerySignatureRef.current;

    if (!previousSignature) {
      lastTrashedQuerySignatureRef.current = signature;
      if (!normalizedSearch) {
        return undefined;
      }
    }

    if (previousSignature === signature) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      lastTrashedQuerySignatureRef.current = signature;
      onTrashedClientsQueryChange({ search: normalizedSearch });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [tab, search, onTrashedClientsQueryChange]);

  const hasExpiredPlans = React.useMemo(() => {
    if (urgentClientsTotal > 0 || urgentClients.length > 0) {
      return true;
    }

    const now = new Date();
    return clients.some((client) =>
      supportsCountdownPlanStatus(client.planStatus) &&
      client.planExpiresAt &&
      new Date(client.planExpiresAt) < now,
    );
  }, [clients, urgentClients, urgentClientsTotal]);

  const recentRegistrations = React.useMemo(() => {
    // Os clientes já vêm ordenados por data de criação do backend
    return recentClients.length ? recentClients : clients.slice(0, 3);
  }, [clients, recentClients]);
  const pendingAccessRequests = React.useMemo(() => {
    const source = rawPendingAccessRequests.length
      ? rawPendingAccessRequests
      : clients.filter(isPendingAccessClient).slice(0, PENDING_ACCESS_PREVIEW_LIMIT);
    return source.filter(isPendingAccessClient);
  }, [clients, rawPendingAccessRequests]);
  const pendingAccessRequestCount = Math.max(
    Number(summary.pendingAccessRequests || 0),
    pendingAccessRequests.length,
  );
  const loadedFinancialEvents = financialEvents.length;
  const totalFinancialEvents = Math.max(Number(financialEventPageInfo.total || 0), loadedFinancialEvents);
  const financialEventsSummaryText = totalFinancialEvents > loadedFinancialEvents
    ? `${loadedFinancialEvents} de ${totalFinancialEvents} registos financeiros carregados`
    : `${totalFinancialEvents} registos financeiros acumulados`;

  React.useEffect(() => {
    setPlanDrafts(Object.fromEntries(plans.map((plan) => [plan.id, toPlanDraft(plan)])));
  }, [plans]);

  React.useEffect(() => {
    const nextSettingsDrafts = Object.fromEntries(
      Object.entries(data?.settings || {}).map(([key, info]) => [key, String(info?.value || "")]),
    );
    const hasConfiguredSettings = Object.values(nextSettingsDrafts).some((value) => String(value || "").trim() !== "");

    setSettingsDrafts(nextSettingsDrafts);
    setIsSystemSettingsOpen(!hasConfiguredSettings);
  }, [data?.settings]);

  const accent = brand.accent || "#1c9a74";
  const settingsEntries = React.useMemo(
    () => sortSettingEntries(Object.entries(data?.settings || {})),
    [data?.settings],
  );
  const configuredSettings = settingsEntries.filter(([key]) => String(settingsDrafts[key] || "").trim() !== "");
  const settingsSummary = configuredSettings.slice(0, 4).map(([key]) => ({
    key,
    label: formatSettingLabel(key),
    value: formatSettingSummaryValue(key, settingsDrafts[key]),
  }));
  const pendingPlanRequests = React.useMemo(
    () => planActivationRequests.filter((request) => isOpenPlanRequestStatus(request?.status)),
    [planActivationRequests],
  );
  const pendingPlanRequestCount = pendingPlanRequests.length;
  const canManageAdminUsers = Boolean(adminPermissions?.canManageAdminUsers);
  const currentSuperAdminAccess = React.useMemo(
    () => normalizeSuperAdminAccess(adminPermissions?.access, { fullAccess: !adminPermissions?.access && canManageAdminUsers }),
    [adminPermissions?.access, canManageAdminUsers],
  );
  const availablePrimaryTabs = React.useMemo(
    () => SUPER_ADMIN_PRIMARY_TABS.filter(([id]) => Boolean(currentSuperAdminAccess[id])),
    [currentSuperAdminAccess],
  );
  const fallbackTab = availablePrimaryTabs[0]?.[0] || "clientes";
  const canOpenSettings = Boolean(currentSuperAdminAccess.configuracoes);
  const currentAdminUserId = session?.user?.id || "";

  React.useEffect(() => {
    const tabAllowed = tab === "configuracoes"
      ? canOpenSettings
      : availablePrimaryTabs.some(([id]) => id === tab);

    if (!tabAllowed && tab !== fallbackTab) {
      setTab(fallbackTab);
    }
  }, [availablePrimaryTabs, canOpenSettings, fallbackTab, setTab, tab]);

  function openTab(nextTab) {
    const normalizedTab = String(nextTab || "").trim();
    if (!normalizedTab) return;

    const allowed = normalizedTab === "configuracoes"
      ? canOpenSettings
      : Boolean(currentSuperAdminAccess[normalizedTab]);

    if (!allowed) {
      if (toast) toast("Esta conta não tem acesso a essa área.");
      return;
    }

    setTab(normalizedTab);
  }

  async function commitSettingValue(key, nextValue, fallbackValue = "") {
    const normalizedNextValue = String(nextValue ?? "");
    const normalizedFallbackValue = String(fallbackValue ?? "");

    if (normalizedNextValue === normalizedFallbackValue || !onSaveSetting) {
      return;
    }

    try {
      await onSaveSetting({ key, value: normalizedNextValue });
      setSavedKeys((prev) => new Set(prev).add(key));
      setSettingsDrafts((current) => ({ ...current, [key]: normalizedNextValue }));
      if (toast) toast(`Configuracao ${formatSettingLabel(key)} atualizada.`);

      setTimeout(() => {
        setSavedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 3000);
    } catch (error) {
      if (toast) toast(`Erro ao atualizar ${formatSettingLabel(key)}`);
      setSettingsDrafts((current) => ({ ...current, [key]: normalizedFallbackValue }));
      throw error;
    }
  }

  const localFilteredClients = clients.filter((client) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      client.storeName,
      client.email,
      client.fullName,
      client.planName,
      client.referenceId, // Adicionado à pesquisa
      client.storeId, // Permite pesquisar pelo ID completo ou parcial
      client.userId,
    ].filter(Boolean).join(" ").toLowerCase().includes(query);

    // Normalização da data para comparação (YYYY-MM-DD)
    const planDate = client.planStartedAt ? new Date(client.planStartedAt).toISOString().slice(0, 10) : "";
    const matchesFrom = !dateFrom || (planDate && planDate >= dateFrom);
    const matchesTo = !dateTo || (planDate && planDate <= dateTo);

    return matchesSearch && matchesFrom && matchesTo;
  });

  const filteredClients = clients;

  const localFilteredTrashedClients = trashedClients.filter((client) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [
      client.storeName,
      client.email,
      client.fullName,
      client.planName,
      client.referenceId,
      client.storeId
    ].filter(Boolean).join(" ").toLowerCase().includes(query);
  });

  const filteredTrashedClients = trashedClients;

  const filteredAdminUsers = adminUsers.filter((adminUser) => {
    const query = adminSearch.trim().toLowerCase();
    if (!query) return true;

    return [
      adminUser.fullName,
      adminUser.email,
      adminUser.userId,
      adminUser.isProtected ? "principal" : "auxiliar",
      adminUser.accountStatus,
    ].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
  const helperAdminUsers = adminUsers.filter((adminUser) => !adminUser.isProtected);
  const protectedAdminUsers = adminUsers.filter((adminUser) => adminUser.isProtected);

  const filteredClientIds = React.useMemo(
    () => filteredClients.map((client) => client.userId),
    [filteredClients],
  );
  const filteredTrashedClientIds = React.useMemo(
    () => filteredTrashedClients.map((client) => client.userId),
    [filteredTrashedClients],
  );

  React.useEffect(() => {
    setSelectedClientIds((current) => trimSelectionToAllowed(current, filteredClientIds));
  }, [filteredClientIds]);

  React.useEffect(() => {
    setSelectedTrashedClientIds((current) => trimSelectionToAllowed(current, filteredTrashedClientIds));
  }, [filteredTrashedClientIds]);

  const allFilteredClientsSelected = filteredClientIds.length > 0 && filteredClientIds.every((userId) => selectedClientIds.has(userId));
  const allFilteredTrashedSelected = filteredTrashedClientIds.length > 0 && filteredTrashedClientIds.every((userId) => selectedTrashedClientIds.has(userId));

  const urgentPlanAlerts = React.useMemo(() => {
    const sourceClients = urgentClients.length ? urgentClients : clients;

    return sourceClients
      .map((client) => {
        const draft = clientDrafts[client.userId] || toClientDraft(client, plans);
        const planStatus = draft.planStatus || client.planStatus;
        const planExpiresAt = draft.planExpiresAt || client.planExpiresAt;
        const countdown = getPlanCountdown(planStatus, planExpiresAt, countdownNow);

        if (!isUrgentPlanCountdown(countdown, 3)) {
          return null;
        }

        const timeRemaining = getPlanTimeRemaining(planStatus, planExpiresAt, countdownNow);
        const selectedPlan = getPlanDefinition(plans, draft.planId || client.planId);
        const displayId = client.referenceId || String(client.storeId || "").slice(0, 8).toUpperCase();

        return {
          userId: client.userId,
          storeName: client.storeName || client.fullName || client.email,
          email: client.email,
          planExpiresAt,
          planLabel: selectedPlan?.name || client.planName || "Sem plano definido",
          countdownLabel: countdown.label,
          daysRemaining: countdown.daysRemaining,
          detailLabel: timeRemaining?.detailLabel || "",
          compactLabel: timeRemaining?.compactLabel || countdown.label,
          displayId,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const leftDays = Number(left.daysRemaining || 0);
        const rightDays = Number(right.daysRemaining || 0);
        if (leftDays !== rightDays) {
          return leftDays - rightDays;
        }

        return new Date(left.planExpiresAt).getTime() - new Date(right.planExpiresAt).getTime();
      });
  }, [clients, urgentClients, clientDrafts, plans, countdownNow]);
  const visibleUrgentPlanAlertsTotal = urgentClientsTotal || urgentPlanAlerts.length;

  function focusClientFromAlert(userId, displayId) {
    openTab("clientes");
    setDateFrom("");
    setDateTo("");
    setSearch(displayId || "");
    setOpenClientFormUserId(userId);
  }

  function focusClientFromPlanRequest(request) {
    const displayId = request?.referenceId || String(request?.storeId || "").slice(0, 8).toUpperCase();
    setIsNotificationPanelOpen(false);
    focusClientFromAlert(request?.userId || "", displayId);
  }

  async function openPendingAccessRequest(client) {
    const lookupValue = String(client?.email || client?.userId || "").trim();
    const nextSignature = [lookupValue, "", ""].join("::");

    openTab("clientes");
    setDateFrom("");
    setDateTo("");
    setSearch(lookupValue);
    lastClientsQuerySignatureRef.current = nextSignature;

    if (lookupValue && onClientsQueryChange) {
      await onClientsQueryChange({
        search: lookupValue,
        dateFrom: "",
        dateTo: "",
      });
    }

    setOpenClientFormUserId(client?.userId || "");
  }

  function copyPlanRequestMessage(request) {
    const messageText = String(request?.messageText || "").trim();
    if (!messageText || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(messageText);
    if (toast) toast("Mensagem do pedido copiada.");
  }

  function openPlanRequestWhatsApp(request) {
    const whatsappLink = String(request?.whatsappLink || "").trim();
    if (!whatsappLink || typeof window === "undefined") {
      if (toast) toast("O WhatsApp de suporte ainda nao esta configurado.");
      return;
    }
    window.open(whatsappLink, "_blank", "noopener,noreferrer");
  }

  function openPlanRequestProof(request) {
    const proofLink = String(request?.latestProof?.downloadUrl || "").trim();
    if (!proofLink || typeof window === "undefined") {
      if (toast) toast("Este pedido ainda não tem um comprovativo disponível para abrir.");
      return;
    }
    window.open(proofLink, "_blank", "noopener,noreferrer");
  }

  async function handlePlanRequestReviewAction(request, action) {
    if (!onReviewPlanRequest) return;

    let reviewNote = "";

    if (action === "needs_correction") {
      if (typeof window !== "undefined") {
        reviewNote = String(window.prompt("Escreve a orientacao que o lojista precisa de seguir para corrigir o comprovativo:", request?.reviewNote || "") || "").trim();
      }
      if (!reviewNote) return;
    }

    if (action === "rejected") {
      if (typeof window !== "undefined") {
        reviewNote = String(window.prompt("Explica porque este pedido foi rejeitado:", request?.reviewNote || "") || "").trim();
      }
      if (!reviewNote) return;
    }

    if (action === "activated" && typeof window !== "undefined") {
      const confirmed = window.confirm(`Queres aprovar e ativar agora o plano ${request?.planName || "selecionado"} para ${request?.storeName || "esta loja"}?`);
      if (!confirmed) return;
    }

    await onReviewPlanRequest({
      requestId: request?.id,
      action,
      reviewNote,
    });
  }

  function updateClientDraft(userId, changes) {
    setClientDrafts((current) => {
      const sourceClient = clients.find((client) => client.userId === userId) || {};
      const previousDraft = current[userId] || toClientDraft(sourceClient, plans);
      return {
        ...current,
        [userId]: syncClientDraft({ ...previousDraft, ...changes }, plans),
      };
    });
  }

  function toggleClientForm(userId) {
    setOpenClientFormUserId((current) => (current === userId ? "" : userId));
  }

  function toggleClientSelection(userId, checked) {
    setSelectedClientIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  }

  function toggleTrashedClientSelection(userId, checked) {
    setSelectedTrashedClientIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  }

  function toggleAllFilteredClients(checked) {
    setSelectedClientIds(checked ? new Set(filteredClientIds) : new Set());
  }

  function toggleAllFilteredTrashedClients(checked) {
    setSelectedTrashedClientIds(checked ? new Set(filteredTrashedClientIds) : new Set());
  }

  async function handleClientSave(userId) {
    const draft = clientDrafts[userId];
    if (!draft) return;
    await onSaveClient(draft);
  }

  function updateAdminUserDraft(userId, changes) {
    setAdminUserDrafts((current) => {
      const sourceAdminUser = adminUsers.find((adminUser) => adminUser.userId === userId) || {};
      const previousDraft = current[userId] || toAdminUserDraft(sourceAdminUser);
      return {
        ...current,
        [userId]: {
          ...previousDraft,
          ...changes,
        },
      };
    });
  }

  function updateAdminUserAccess(userId, accessKey, checked, options = {}) {
    setAdminUserDrafts((current) => {
      const sourceAdminUser = adminUsers.find((adminUser) => adminUser.userId === userId) || {};
      const previousDraft = current[userId] || toAdminUserDraft(sourceAdminUser);

      return {
        ...current,
        [userId]: {
          ...previousDraft,
          superAdminAccess: setSuperAdminAccessValue(previousDraft.superAdminAccess, accessKey, checked, options),
        },
      };
    });
  }

  function updateNewAdminUserAccess(accessKey, checked) {
    setNewAdminUserDraft((current) => ({
      ...current,
      superAdminAccess: setSuperAdminAccessValue(current.superAdminAccess, accessKey, checked),
    }));
  }

  function toggleAdminUserForm(userId) {
    setOpenAdminUserFormUserId((current) => (current === userId ? "" : userId));
  }

  async function handleAdminUserSave(userId) {
    if (!onSaveAdminUser) return;
    const draft = adminUserDrafts[userId];
    if (!draft) return;
    await onSaveAdminUser({
      userId,
      fullName: String(draft.fullName || "").trim(),
      email: String(draft.email || "").trim(),
      password: String(draft.password || ""),
      accountStatus: draft.accountStatus || "active",
      superAdminAccess: normalizeSuperAdminAccess(draft.superAdminAccess),
    });
  }

  async function handleCreateAdminUser() {
    if (!onSaveAdminUser) return;

    const result = await onSaveAdminUser({
      fullName: String(newAdminUserDraft.fullName || "").trim(),
      email: String(newAdminUserDraft.email || "").trim(),
      password: String(newAdminUserDraft.password || ""),
      accountStatus: newAdminUserDraft.accountStatus || "active",
      superAdminAccess: normalizeSuperAdminAccess(newAdminUserDraft.superAdminAccess),
    });

    if (result?.ok) {
      setNewAdminUserDraft(createEmptyAdminUserDraft());
      setIsNewAdminUserFormOpen(false);
    }
  }

  async function handlePlanSave(planId) {
    const draft = planDrafts[planId];
    if (!draft) return;
    await onSavePlan(draft);
  }

  async function handleCreatePlan() {
    await onSavePlan(newPlanDraft);
    setNewPlanDraft(EMPTY_PLAN_DRAFT);
    setIsNewPlanFormOpen(false);
  }

  function togglePlanForm(planId) {
    setOpenPlanFormId((current) => (current === planId ? "" : planId));
  }

  async function handleProfileSave(formData) {
    if (!onSaveClient) return;
    // Reutilizamos a lógica de save client para o próprio admin
    await onSaveClient({ userId: session.user.id, ...formData });
    setIsProfileModalOpen(false);
  }

  const handleProfileSaveWithFeedback = React.useCallback(async (formData) => {
    if (!onSaveClient) {
      return { ok: false, errorMessage: "Nao foi possivel guardar o perfil agora." };
    }

    const result = await onSaveClient({ userId: session.user.id, ...formData });
    if (result?.ok) {
      setIsProfileModalOpen(false);
    }

    return result;
  }, [onSaveClient, session?.user?.id]);

  async function handleClientLifecycleTargets(userIds, action) {
    if (!onClientLifecycle) return;

    const normalizedUserIds = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).map((value) => String(value || "").trim()).filter(Boolean))];
    if (!normalizedUserIds.length) return;

    const total = normalizedUserIds.length;

    const confirmationMessage =
      action === "trash"
        ? (total === 1 ? "Tens a certeza que queres mover esta empresa para o lixo?" : `Tens a certeza que queres mover ${total} empresas para o lixo?`)
        : action === "restore"
          ? (total === 1 ? "Queres recuperar esta empresa do lixo?" : `Queres recuperar ${total} empresas do lixo?`)
          : (total === 1 ? "Esta acao elimina a empresa para sempre. Queres continuar?" : `Esta acao elimina ${total} empresas para sempre. Queres continuar?`);

    if (typeof window !== "undefined" && !window.confirm(confirmationMessage)) {
      return;
    }

    await onClientLifecycle(total === 1 ? { userId: normalizedUserIds[0], action } : { userIds: normalizedUserIds, action });
  }

  async function handleClientLifecycle(userId, action) {
    await handleClientLifecycleTargets([userId], action);
  }

  async function handleBulkClientLifecycle(action) {
    const selectedIds = Array.from(selectedClientIds);
    if (!selectedIds.length) return;
    await handleClientLifecycleTargets(selectedIds, action);
    setSelectedClientIds(new Set());
  }

  async function handleBulkTrashedLifecycle(action) {
    const selectedIds = Array.from(selectedTrashedClientIds);
    if (!selectedIds.length) return;
    await handleClientLifecycleTargets(selectedIds, action);
    setSelectedTrashedClientIds(new Set());
  }

  const isClientGridView = clientViewMode === "grid";
  const clientCardsContainerStyle = isClientGridView
    ? { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "14px", alignItems: "start" }
    : { display: "grid", gap: "14px" };

  return (
    <div style={{ minHeight: "600px", fontFamily: "var(--font-sans)", background: "var(--color-background-secondary)" }}>
      <style>{PULSE_ANIMATION}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <BrandMark brand={brand} size={40} rounded={14} />
          <div>
            <div style={{ fontSize: "14px", fontWeight: "700", fontFamily: "var(--font-display)" }}>{brand.name}</div>
            <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>Painel central de clientes, acessos e planos</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ position: "relative" }} ref={notificationPanelRef}>
            <button
              type="button"
              onClick={() => {
                setIsNotificationPanelOpen((current) => !current);
                setIsMenuOpen(false);
              }}
              style={{
                ...ACTION_BUTTON_STYLE,
                position: "relative",
                background: isNotificationPanelOpen ? "var(--color-background-secondary)" : "transparent",
                color: isNotificationPanelOpen ? accent : "var(--color-text-secondary)",
                border: `0.5px solid ${isNotificationPanelOpen ? accent : "var(--color-border-tertiary)"}`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "44px",
                minHeight: "44px",
                padding: "10px 12px",
              }}
              aria-label="Abrir notificacoes de ativacao"
            >
              <Bell size={15} />
              {pendingPlanRequestCount ? (
                <span style={{ position: "absolute", top: "-4px", right: "-4px", minWidth: "20px", height: "20px", borderRadius: "999px", background: "#dc2626", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "800", boxShadow: "0 8px 18px rgba(220, 38, 38, 0.28)" }}>
                  {pendingPlanRequestCount > 99 ? "99+" : pendingPlanRequestCount}
                </span>
              ) : null}
            </button>
            <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: "min(420px, 92vw)", background: "white", borderRadius: "18px", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)", border: "0.5px solid var(--color-border-tertiary)", pointerEvents: isNotificationPanelOpen ? "auto" : "none", opacity: isNotificationPanelOpen ? 1 : 0, transform: isNotificationPanelOpen ? "translateY(0)" : "translateY(-10px)", transition: "all 0.2s ease", zIndex: 120, overflow: "hidden" }}>
              <div style={{ padding: "16px 18px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "grid", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ fontSize: "15px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Pedidos de ativacao</div>
                  <Badge bg={pendingPlanRequestCount ? "#fee2e2" : "#f3f4f6"} color={pendingPlanRequestCount ? "#b91c1c" : "#475569"}>
                    <Bell size={12} /> {pendingPlanRequestCount} aberto{pendingPlanRequestCount === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                  Cada pedido guarda a referência, o comprovativo enviado e as decisões da revisão antes da ativação.
                </div>
              </div>

              <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "10px", display: "grid", gap: "10px" }}>
                {pendingPlanRequests.length ? pendingPlanRequests.map((request) => {
                  const displayId = request.referenceId || String(request.storeId || "").slice(0, 8).toUpperCase();
                  const requestTone = getPlanRequestStatusTone(request.status);
                  const proofTone = getPaymentProofStatusTone(request.paymentProofStatus);
                  const latestProof = request.latestProof || null;
                  return (
                    <div key={request.id} style={{ ...SURFACE_STYLE, boxShadow: "none", padding: "14px", display: "grid", gap: "10px", borderRadius: "18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                        <div style={{ display: "grid", gap: "4px" }}>
                          <div style={{ fontSize: "15px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{request.storeName || request.merchantEmail || "Loja sem nome"}</div>
                          <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>ID {displayId} · {formatDateTimeLabel(request.requestedAt)}</div>
                        </div>
                        <div style={{ display: "grid", gap: "6px", justifyItems: "end" }}>
                          <Badge bg={requestTone.bg} color={requestTone.color}>
                            <Bell size={12} /> {formatPlanRequestStatusLabel(request.status)}
                          </Badge>
                          <Badge bg={proofTone.bg} color={proofTone.color}>
                            <Clock3 size={12} /> {formatPaymentProofStatusLabel(request.paymentProofStatus)}
                          </Badge>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                        <div><strong style={{ color: "var(--color-text-primary)" }}>Plano pedido:</strong> {request.planName || "Sem plano"} · {request.durationDays} dias</div>
                        <div><strong style={{ color: "var(--color-text-primary)" }}>Valor estimado:</strong> {formatMoney(request.totalPrice, request.currencyCode)}</div>
                        <div><strong style={{ color: "var(--color-text-primary)" }}>Referencia:</strong> {request.paymentReference || "Sem referencia"}</div>
                        <div><strong style={{ color: "var(--color-text-primary)" }}>Prazo do comprovativo:</strong> {formatDateTimeLabel(request.paymentDueAt) || "Sem prazo"}</div>
                        <div><strong style={{ color: "var(--color-text-primary)" }}>Email:</strong> {request.merchantEmail || "Sem email"}</div>
                        <div><strong style={{ color: "var(--color-text-primary)" }}>WhatsApp da loja:</strong> {request.storeWhatsApp || "Sem número configurado"}</div>
                        <div><strong style={{ color: "var(--color-text-primary)" }}>Catalogo atual:</strong> {request.productCount} produto{request.productCount === 1 ? "" : "s"} · {formatPlanStatusLabel(request.currentPlanStatus)}{request.currentPlanName ? ` (${request.currentPlanName})` : ""}</div>
                      </div>

                      <div style={{ padding: "12px 14px", borderRadius: "16px", background: "var(--color-background-secondary)", fontSize: "12px", color: "var(--color-text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {request.messageText || "Sem mensagem guardada para este pedido."}
                      </div>

                      {request.paymentInstructions ? (
                        <div style={{ padding: "12px 14px", borderRadius: "16px", background: "#eff6ff", fontSize: "12px", color: "var(--color-text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {request.paymentInstructions}
                        </div>
                      ) : null}

                      {latestProof ? (
                        <div style={{ padding: "12px 14px", borderRadius: "16px", background: "#f8fafc", fontSize: "12px", color: "var(--color-text-primary)", lineHeight: 1.6, display: "grid", gap: "6px" }}>
                          <strong style={{ display: "block" }}>Dados oficiais do comprovativo</strong>
                          <div><strong>Ficheiro:</strong> {latestProof.originalFileName || "Comprovativo enviado"}</div>
                          <div><strong>Enviado em:</strong> {formatDateTimeLabel(latestProof.submittedAt)}</div>
                          <div><strong>Pagador:</strong> {latestProof.payerName || "Sem nome"}</div>
                          <div><strong>Telefone:</strong> {latestProof.payerPhone || "Sem telefone"}</div>
                          <div><strong>Referencia usada:</strong> {latestProof.paymentReferenceText || request.paymentReference || "Sem referencia"}</div>
                          <div><strong>Valor pago:</strong> {latestProof.paidAmount != null ? formatMoney(latestProof.paidAmount, latestProof.paidCurrencyCode || request.currencyCode) : "Sem valor indicado"}</div>
                          <div><strong>Data do pagamento:</strong> {formatDateLabel(latestProof.paidAt)}</div>
                          {latestProof.note ? <div><strong>Observacao do lojista:</strong> {latestProof.note}</div> : null}
                        </div>
                      ) : (
                        <div style={{ padding: "12px 14px", borderRadius: "16px", background: "#fff7ed", fontSize: "12px", color: "#9a3412", lineHeight: 1.6 }}>
                          Ainda nao existe comprovativo oficial anexado a este pedido.
                        </div>
                      )}

                      {request.reviewNote ? (
                        <div style={{ padding: "12px 14px", borderRadius: "16px", background: request.status === "needs_correction" ? "#fff7ed" : "#f8fafc", fontSize: "12px", color: "var(--color-text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          <strong style={{ display: "block", marginBottom: "6px" }}>Observação da revisão</strong>
                          {request.reviewNote}
                        </div>
                      ) : null}

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => focusClientFromPlanRequest(request)} style={{ ...ACTION_BUTTON_STYLE, background: accent, color: "white" }}>
                          Abrir cliente
                        </button>
                        <button type="button" onClick={() => copyPlanRequestMessage(request)} style={{ ...ACTION_BUTTON_STYLE, background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }}>
                          <Copy size={13} /> Copiar mensagem
                        </button>
                        <button type="button" onClick={() => openPlanRequestWhatsApp(request)} style={{ ...ACTION_BUTTON_STYLE, background: "#ecfdf5", color: "#166534" }}>
                          Abrir WhatsApp
                        </button>
                        {latestProof?.downloadUrl ? (
                          <button type="button" onClick={() => openPlanRequestProof(request)} style={{ ...ACTION_BUTTON_STYLE, background: "#eff6ff", color: "#1d4ed8" }}>
                            <ExternalLink size={13} /> Ver comprovativo
                          </button>
                        ) : null}
                        {onReviewPlanRequest ? (
                          <button type="button" disabled={busy || !latestProof} onClick={() => handlePlanRequestReviewAction(request, "under_review")} style={{ ...ACTION_BUTTON_STYLE, background: "var(--color-background-secondary)", color: "var(--color-text-primary)", opacity: busy || !latestProof ? 0.6 : 1, cursor: busy || !latestProof ? "not-allowed" : "pointer" }}>
                            Em revisão
                          </button>
                        ) : null}
                        {onReviewPlanRequest ? (
                          <button type="button" disabled={busy || !latestProof} onClick={() => handlePlanRequestReviewAction(request, "needs_correction")} style={{ ...ACTION_BUTTON_STYLE, background: "#fff7ed", color: "#9a3412", opacity: busy || !latestProof ? 0.6 : 1, cursor: busy || !latestProof ? "not-allowed" : "pointer" }}>
                            Pedir correcao
                          </button>
                        ) : null}
                        {onReviewPlanRequest ? (
                          <button type="button" disabled={busy} onClick={() => handlePlanRequestReviewAction(request, "rejected")} style={{ ...ACTION_BUTTON_STYLE, background: "#fee2e2", color: "#b91c1c", opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer" }}>
                            Rejeitar
                          </button>
                        ) : null}
                        {onReviewPlanRequest ? (
                          <button type="button" disabled={busy || !latestProof} onClick={() => handlePlanRequestReviewAction(request, "activated")} style={{ ...ACTION_BUTTON_STYLE, background: "#dcfce7", color: "#166534", opacity: busy || !latestProof ? 0.6 : 1, cursor: busy || !latestProof ? "not-allowed" : "pointer" }}>
                            <ShieldCheck size={13} /> Aprovar e ativar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                }) : (
                  <div style={{ padding: "20px 14px", borderRadius: "16px", background: "var(--color-background-secondary)", fontSize: "12px", color: "var(--color-text-secondary)", textAlign: "center" }}>
                    Ainda nao existem pedidos abertos de ativacao.
                  </div>
                )}
              </div>
            </div>
          </div>
          <button onClick={onRefresh} disabled={busy} style={{ ...ACTION_BUTTON_STYLE, background: "transparent", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={13} /> Atualizar
          </button>
          {onLogout && (
            <div style={{ position: "relative" }} ref={menuRef}>
              <button
                onClick={() => {
                  setIsMenuOpen(!isMenuOpen);
                  setIsNotificationPanelOpen(false);
                }}
                style={{
                  ...ACTION_BUTTON_STYLE,
                  background: isMenuOpen ? "var(--color-background-secondary)" : "transparent",
                  color: isMenuOpen ? accent : "var(--color-text-secondary)",
                  border: `0.5px solid ${isMenuOpen ? accent : "var(--color-border-tertiary)"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  transition: "all 0.2s ease"
                }}
              >
                <UserAvatar name={session.user?.fullName} email={session.user?.email} avatarUrl={session.user?.avatarUrl} accent={accent} pulse={hasExpiredPlans || pendingPlanRequestCount > 0} />
                <span style={{ fontSize: "12px", fontWeight: "600", opacity: isMenuOpen ? 1 : 0.8 }}>
                  {session.user?.fullName || session.user?.email}
                </span>
                <div style={{ width: "1px", height: "12px", background: "var(--color-border-tertiary)", opacity: 0.5 }} />
                <ArrowLeftRight size={13} /> Trocar de usuário
              </button>

              {/* Menu Dropdown do Soberano */}
              <div style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                background: "white",
                padding: "8px",
                borderRadius: "14px",
                whiteSpace: "nowrap",
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                pointerEvents: isMenuOpen ? "auto" : "none",
                opacity: isMenuOpen ? 1 : 0,
                transform: isMenuOpen ? "translateY(0)" : "translateY(-10px)",
                transition: "all 0.2s ease",
                zIndex: 100,
                minWidth: "260px",
                border: "0.5px solid var(--color-border-tertiary)"
              }}>
                <div style={{ padding: "12px", borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", fontWeight: "700", textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Bell size={12} /> Últimos Registos
                  </div>
                  <div style={{ display: "grid", gap: "6px" }}>
                    {recentRegistrations.map(reg => (
                      <div key={reg.userId} style={{ padding: "6px 8px", borderRadius: "8px", background: "var(--color-background-secondary)", fontSize: "12px" }}>
                        <div style={{ fontWeight: "700", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {reg.storeName || reg.email}
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                          Aderiu em {formatDateLabel(reg.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gap: "4px", padding: "0 4px 8px" }}>
                  <div style={{ padding: "8px 12px", fontSize: "11px", color: "var(--color-text-secondary)", fontWeight: "700", textTransform: "uppercase" }}>Administração</div>
                  
                  <button 
                    onClick={() => { setIsMenuOpen(false); setIsProfileModalOpen(true); }} 
                    style={{ ...ACTION_BUTTON_STYLE, background: "transparent", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}
                  >
                    <User size={14} /> Meu Perfil
                  </button>
                  
                  <button onClick={() => { setIsMenuOpen(false); openTab("configuracoes"); }} style={{ ...ACTION_BUTTON_STYLE, background: "transparent", color: "var(--color-text-primary)", display: canOpenSettings ? "flex" : "none", alignItems: "center", gap: "10px", textAlign: "left" }}>
                    <Settings size={14} /> Configurações
                  </button>

                  <div style={{ height: "1px", background: "var(--color-border-tertiary)", margin: "4px 0" }} />
                  
                  <button onClick={onLogout} style={{ ...ACTION_BUTTON_STYLE, background: "#fee2e2", color: "#b91c1c", display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}>
                    <ArrowLeftRight size={14} /> Trocar de usuário
                  </button>
                </div>
                
                <div style={{ position: "absolute", top: "-5px", right: "20px", width: "10px", height: "10px", background: "white", transform: "rotate(45deg)", borderLeft: "0.5px solid var(--color-border-tertiary)", borderTop: "0.5px solid var(--color-border-tertiary)" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {tab === "clientes" ? (
        <div style={{ padding: "18px 20px 0" }}>
          <div style={{ background: `linear-gradient(135deg, ${brand.dark} 0%, ${accent} 55%, ${brand.highlight} 180%)`, borderRadius: "26px", padding: "20px", color: "white", marginBottom: "14px", position: "relative", overflow: "hidden", boxShadow: "0 18px 44px rgba(12, 37, 34, 0.16)" }}>
            <div style={{ position: "absolute", width: "220px", height: "220px", borderRadius: "999px", background: "rgba(255,255,255,0.08)", top: "-108px", right: "-34px" }} />
            <div style={{ position: "absolute", width: "120px", height: "120px", borderRadius: "999px", background: "rgba(255,255,255,0.08)", bottom: "-44px", left: "-24px" }} />
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ maxWidth: "640px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 10px", background: "rgba(255,255,255,0.12)", borderRadius: "999px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
                  <Crown size={12} /> Super Admin
                </div>
                <div style={{ fontSize: "26px", lineHeight: 1.06, fontFamily: "var(--font-display)", fontWeight: "800", maxWidth: "620px" }}>
                  Controlo central de clientes, acesso e catálogo comercial.
                </div>
                <div style={{ fontSize: "12px", opacity: 0.88, maxWidth: "500px", marginTop: "8px", lineHeight: 1.55 }}>
                  Gere a carteira de clientes, acompanha o estado das contas e define o plano certo para cada loja.
                </div>
              </div>
              <div style={{ padding: "13px 16px", minWidth: "200px", borderRadius: "18px", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)" }}>
                <div style={{ fontSize: "10px", opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "5px" }}>Estado do portfolio</div>
                <div style={{ fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{summary.totalClients} clientes monitorizados</div>
                <div style={{ fontSize: "11px", opacity: 0.82, marginTop: "3px" }}>{financialEventsSummaryText}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(142px, 1fr))", gap: "10px" }}>
            <StatTile compact label="Clientes" value={summary.totalClients} hint="contas lojistas" color={accent} />
            <StatTile compact label="Ativos" value={summary.activeClients} hint="podem entrar" color={accent} />
            <StatTile compact label="Suspensos" value={summary.suspendedClients} hint="acesso bloqueado" color={accent} />
            <StatTile compact label="Lojas publicas" value={summary.publicStores} hint="abertas ao cliente" color={accent} />
            <StatTile compact label="Pedidos de acesso" value={pendingAccessRequestCount} hint="contas sem loja" color={accent} />
            <StatTile compact label="Pagamentos" value={totalFinancialEvents} hint="ativacoes e renovacoes" color={accent} />
            <StatTile compact label="Planos ativos" value={summary.activePlans} hint="disponiveis para venda" color={accent} />
            <StatTile compact label="No lixo" value={summary.trashedClients} hint="prontas para recuperar" color={accent} />
          </div>

          {urgentPlanAlerts.length ? (
            <div
              style={{
                ...SURFACE_STYLE,
                marginTop: "14px",
                padding: "14px",
                border: "1px solid #fdba74",
                background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)",
                display: "grid",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "grid", gap: "4px" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "800", color: "#9a3412", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <AlertTriangle size={14} /> A vencer em 3 dias ou menos
                  </div>
                  <div style={{ fontSize: "12px", color: "#7c2d12", lineHeight: 1.5 }}>
                    {visibleUrgentPlanAlertsTotal === 1
                      ? "1 loja precisa de atencao imediata para nao ficar sem plano ativo."
                      : `${visibleUrgentPlanAlertsTotal} lojas precisam de atencao imediata para nao ficarem sem plano ativo.`}
                  </div>
                </div>
                <Badge bg="#fed7aa" color="#9a3412">
                  <Clock3 size={12} /> {visibleUrgentPlanAlertsTotal} urgentes
                </Badge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                {urgentPlanAlerts.slice(0, 6).map((alert) => (
                  <div
                    key={alert.userId}
                    style={{
                      borderRadius: "16px",
                      border: "1px solid #fdba74",
                      background: "rgba(255,255,255,0.86)",
                      padding: "12px",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
                      <div style={{ display: "grid", gap: "3px" }}>
                        <div style={{ fontSize: "14px", fontWeight: "800", fontFamily: "var(--font-display)", color: "#7c2d12" }}>{alert.storeName}</div>
                        <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>{alert.email}</div>
                      </div>
                      <Badge bg="#fff7ed" color="#9a3412">
                        <Clock3 size={12} /> {alert.countdownLabel}
                      </Badge>
                    </div>

                    <div style={{ fontSize: "11px", color: "#7c2d12", display: "grid", gap: "3px" }}>
                      <div><strong>{alert.planLabel}</strong></div>
                      <div>Termina em {formatDateLabel(alert.planExpiresAt)}</div>
                      <div>{alert.detailLabel || alert.compactLabel}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => focusClientFromAlert(alert.userId, alert.displayId)}
                      style={{
                        ...ACTION_BUTTON_STYLE,
                        background: "#ea580c",
                        color: "white",
                        width: "100%",
                      }}
                    >
                      Abrir esta loja
                    </button>
                  </div>
                ))}
              </div>

              {visibleUrgentPlanAlertsTotal > 6 ? (
                <div style={{ fontSize: "12px", color: "#9a3412" }}>
                  Mais {visibleUrgentPlanAlertsTotal - 6} loja{visibleUrgentPlanAlertsTotal - 6 === 1 ? "" : "s"} urgentes continuam na lista de clientes abaixo.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "0 20px", marginTop: "18px", background: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)" }}>
        {availablePrimaryTabs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => openTab(id)} style={{ ...TAB_BUTTON_STYLE, color: tab === id ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: tab === id ? "700" : "600", borderBottom: tab === id ? `3px solid ${accent}` : "3px solid transparent" }}>
            <Icon size={13} />
            {label}
          </button>
        ))}
        {tab === "configuracoes" && (
          <button style={{ ...TAB_BUTTON_STYLE, color: "var(--color-text-primary)", fontWeight: "700", borderBottom: `3px solid ${accent}` }}>
            <Settings size={13} /> Configurações
          </button>
        )}
      </div>

      <div style={{ padding: "20px 20px 24px", display: "grid", gap: "14px" }}>
        {tab === "clientes" ? (
          <>
            <div style={{ ...SURFACE_STYLE, padding: "14px", display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Carteira de clientes</div>
                  <div style={{ marginTop: "3px", fontSize: "11px", color: "var(--color-text-secondary)" }}>
                    Filtra por período de adesão para acompanhar o crescimento.
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flex: "1 1 400px", justifyContent: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase" }}>Desde</span>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...FIELD_STYLE, padding: "8px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase" }}>Até</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...FIELD_STYLE, padding: "8px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1", minWidth: "200px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase" }}>Pesquisa</span>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome da loja, ID, email ou plano..." style={{ ...FIELD_STYLE, padding: "8px" }} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center", paddingTop: "8px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    {clientPageInfo.total > filteredClients.length
                      ? `A mostrar ${filteredClients.length} de ${clientPageInfo.total} lojistas`
                      : `${clientPageInfo.total} lojista${clientPageInfo.total === 1 ? "" : "s"} encontrado${clientPageInfo.total === 1 ? "" : "s"}`}
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px", borderRadius: "999px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)" }}>
                    {CLIENT_VIEW_OPTIONS.map((option) => {
                      const active = clientViewMode === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setClientViewMode(option.value)}
                          aria-pressed={active ? "true" : "false"}
                          style={{
                            border: "none",
                            borderRadius: "999px",
                            padding: "8px 12px",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            background: active ? accent : "transparent",
                            color: active ? "white" : "var(--color-text-secondary)",
                            boxShadow: active ? "0 10px 20px rgba(28, 154, 116, 0.18)" : "none",
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {filteredClients.length ? (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: "700", color: "var(--color-text-primary)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={allFilteredClientsSelected}
                        onChange={(event) => toggleAllFilteredClients(event.target.checked)}
                      />
                      Selecionar tudo ({filteredClients.length})
                    </label>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      {selectedClientIds.size} selecionado{selectedClientIds.size === 1 ? "" : "s"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedClientIds(new Set())}
                      disabled={busy || selectedClientIds.size === 0}
                      style={{ ...ACTION_BUTTON_STYLE, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }}
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkClientLifecycle("trash")}
                      disabled={busy || selectedClientIds.size === 0}
                      style={{ ...ACTION_BUTTON_STYLE, background: "#fee2e2", color: "#b91c1c" }}
                    >
                      Mover selecionados para o lixo
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ ...SURFACE_STYLE, padding: "16px", display: "grid", gap: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ maxWidth: "720px" }}>
                  <div style={{ fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Pedidos de acesso</div>
                  <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                    Contas criadas sem loja associada. Abre a ativacao para criar a loja, atribuir o primeiro plano e libertar o primeiro acesso do lojista.
                  </div>
                </div>
                <Badge bg={pendingAccessRequestCount ? "#fff7ed" : "#f3f4f6"} color={pendingAccessRequestCount ? "#9a3412" : "#475569"}>
                  <Store size={12} /> {pendingAccessRequestCount} pendente{pendingAccessRequestCount === 1 ? "" : "s"}
                </Badge>
              </div>

              {pendingAccessRequests.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
                  {pendingAccessRequests.map((client) => (
                    <div
                      key={`pending-access-${client.userId}`}
                      style={{
                        padding: "14px",
                        borderRadius: "18px",
                        border: "1px solid #fdba74",
                        background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)",
                        display: "grid",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "15px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                            {client.fullName || client.email || "Conta sem nome"}
                          </div>
                          <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)", wordBreak: "break-word" }}>
                            {client.email || "Sem email"}
                          </div>
                        </div>
                        <Badge bg="#fff7ed" color="#9a3412">
                          <Store size={12} /> Sem loja
                        </Badge>
                      </div>

                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                        Registo criado em {formatDateTimeLabel(client.createdAt) || "data indisponível"}.
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <Badge bg={client.accountStatus === "active" ? "#dcfce7" : "#fee2e2"} color={client.accountStatus === "active" ? "#166534" : "#b91c1c"}>
                          <ShieldCheck size={12} /> {client.accountStatus === "active" ? "Conta ativa" : "Conta suspensa"}
                        </Badge>
                        <Badge bg="#ffedd5" color="#9a3412">
                          <AlertTriangle size={12} /> Pendente de criacao da loja
                        </Badge>
                      </div>

                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                        Esta conta ja existe, mas ainda precisa de loja e plano inicial antes do primeiro login no painel do lojista.
                      </div>

                      <button
                        type="button"
                        onClick={() => openPendingAccessRequest(client)}
                        style={{ ...ACTION_BUTTON_STYLE, background: accent, color: "white", width: "100%" }}
                      >
                        Abrir ativacao
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "14px", borderRadius: "16px", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", fontSize: "12px", lineHeight: 1.6 }}>
                  Nenhum pedido de acesso pendente agora. Assim que um novo lojista criar conta sem loja, ele aparece aqui.
                </div>
              )}

              {pendingAccessRequestCount > pendingAccessRequests.length ? (
                <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                  A mostrar os {pendingAccessRequests.length} pedidos mais recentes de um total de {pendingAccessRequestCount} conta{pendingAccessRequestCount === 1 ? "" : "s"} pendente{pendingAccessRequestCount === 1 ? "" : "s"}.
                </div>
              ) : null}
            </div>

            {filteredClients.length ? (
              <>
              <div style={clientCardsContainerStyle}>
                {filteredClients.map((client) => {
                const draft = clientDrafts[client.userId] || toClientDraft(client, plans);
                const displayId = client.referenceId || String(client.storeId || "").slice(0, 8).toUpperCase();
                const selectedPlan = getPlanDefinition(plans, draft.planId || client.planId);
                const visiblePlanName = selectedPlan?.name || client.planName || "Sem plano definido";
                const visiblePlanCode = selectedPlan?.code || client.planCode || "Atribui um plano para acompanhar esta loja.";
                const visiblePlanCurrency = selectedPlan?.currencyCode || draft.planCurrencyCode || client.planCurrencyCode || "AOA";
                const currentPlanStatus = draft.planStatus || client.planStatus;
                const currentPlanExpiresAt = draft.planExpiresAt || client.planExpiresAt;
                const planCountdown = getPlanCountdown(currentPlanStatus, currentPlanExpiresAt, countdownNow);
                const planTimeRemaining = getPlanTimeRemaining(currentPlanStatus, currentPlanExpiresAt, countdownNow);
                const isUrgentClient = isUrgentPlanCountdown(planCountdown, 3);
                const isPendingStoreCreation = isPendingAccessClient(client);
                const hasAssignedPlan = Boolean(draft.planId || client.planId);
                const isClientFormVisible = openClientFormUserId === client.userId;
                const formToggleLabel = isClientFormVisible
                  ? "Esconder formulario"
                  : isPendingStoreCreation
                    ? "Criar loja e ativar"
                    : hasAssignedPlan
                      ? "Mostrar formulario"
                      : "Ativar plano";
                return (
                  <div
                    key={client.userId}
                    className={isUrgentClient ? "superadmin-urgent-card" : undefined}
                    style={{
                      ...SURFACE_STYLE,
                      padding: "14px",
                      display: "grid",
                      gap: "12px",
                      alignContent: "start",
                      height: "100%",
                      gridColumn: isClientGridView && isClientFormVisible ? "1 / -1" : undefined,
                      border: isUrgentClient ? "1px solid #fb923c" : SURFACE_STYLE.border,
                      background: isUrgentClient
                        ? "linear-gradient(135deg, rgba(255,237,213,0.98) 0%, rgba(255,247,237,0.98) 48%, rgba(254,226,226,0.98) 100%)"
                        : SURFACE_STYLE.background,
                    }}
                  >
                    {isUrgentClient ? (
                      <span className="superadmin-urgent-ribbon" aria-hidden="true">
                        Urgente
                      </span>
                    ) : null}
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "700", color: "var(--color-text-secondary)", cursor: "pointer", width: "fit-content" }}>
                      <input
                        type="checkbox"
                        checked={selectedClientIds.has(client.userId)}
                        onChange={(event) => toggleClientSelection(client.userId, event.target.checked)}
                      />
                      Selecionar lojista
                    </label>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
                      <div style={{ display: "grid", gap: "6px", flex: "1 1 380px", minWidth: "280px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <div style={{ fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{client.storeName || client.fullName || client.email}</div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(displayId);
                              if (toast) toast(`ID ${displayId} copiado!`);
                            }}
                            style={{
                              background: "var(--color-background-secondary)",
                              border: "0.5px solid var(--color-border-tertiary)",
                              borderRadius: "999px",
                              padding: "4px 9px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "10px",
                              fontWeight: "700",
                              color: "var(--color-text-secondary)"
                            }}
                            title={`Copiar ID: ${displayId}`}
                          >
                            <Copy size={12} /> {displayId}
                          </button>
                          {isUrgentClient ? (
                            <Badge bg="#fb923c" color="#7c2d12">
                              <AlertTriangle size={12} /> Urgente
                            </Badge>
                          ) : null}
                          {isPendingStoreCreation ? (
                            <Badge bg="#ffedd5" color="#9a3412">
                              <Store size={12} /> Pendente de criacao da loja
                            </Badge>
                          ) : null}
                          <Badge bg={client.accountStatus === "active" ? "#dcfce7" : "#fee2e2"} color={client.accountStatus === "active" ? "#166534" : "#b91c1c"}>
                            <ShieldCheck size={12} /> {client.accountStatus === "active" ? "Ativo" : "Suspenso"}
                          </Badge>
                          <Badge bg={client.publicEnabled ? "#dbeafe" : "#f3f4f6"} color={client.publicEnabled ? "#1d4ed8" : "#475569"}>
                            <Globe size={12} /> {client.publicEnabled ? "Catálogo público" : "Catálogo fechado"}
                          </Badge>
                          {planCountdown ? (
                            <Badge bg={planCountdown.bg} color={planCountdown.color}>
                              <Wallet size={12} /> {planCountdown.label}
                            </Badge>
                          ) : null}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>{client.email}</div>
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "11px", color: "var(--color-text-secondary)" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Store size={12} /> {client.storeId ? `Loja ${client.storeId.slice(0, 8)}` : "Sem loja criada"}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Package size={12} /> {client.productCount} produtos
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Users size={12} /> Ultima atividade: {formatDateLabel(client.lastActivityAt)}
                          </span>
                        </div>
                      </div>

                      <div
                        className={isUrgentClient ? "superadmin-urgent-plan-panel" : undefined}
                        style={{
                          minWidth: "250px",
                          maxWidth: isClientGridView && !isClientFormVisible ? "100%" : "320px",
                          flex: isClientGridView && !isClientFormVisible ? "1 1 240px" : "0 1 320px",
                          padding: "12px",
                          borderRadius: "18px",
                          background: isUrgentClient ? "rgba(255,255,255,0.74)" : "var(--color-background-secondary)",
                          border: isUrgentClient ? "1px solid rgba(251, 146, 60, 0.45)" : "1px solid transparent",
                          display: "grid",
                          gap: "8px",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Plano atual</div>
                        <div style={{ fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)", lineHeight: 1.15 }}>{visiblePlanName}</div>
                        <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", lineHeight: 1.45 }}>{visiblePlanCode}</div>
                        {draft.planId ? (
                          <div style={{ fontSize: "11px", color: "var(--color-text-primary)", fontWeight: "700" }}>
                            {draft.planDurationDays || PLAN_DURATION_DEFAULT_DAYS} dias - {formatMoney(draft.planTotalPrice, visiblePlanCurrency)}
                          </div>
                        ) : null}
                        {draft.planExpiresAt ? (
                          <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                            Termina em {formatDateLabel(draft.planExpiresAt)}
                            {planCountdown ? ` (${planCountdown.label})` : ""}
                          </div>
                        ) : null}
                        {planTimeRemaining ? (
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: "16px",
                              background: planTimeRemaining.bg,
                              color: planTimeRemaining.color,
                              border: `1px solid ${planTimeRemaining.borderColor}`,
                              display: "grid",
                              gap: "3px",
                            }}
                          >
                            <div style={{ fontSize: "10px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.84 }}>
                              Tempo restante
                            </div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                              <Clock3 size={16} /> {planTimeRemaining.compactLabel}
                            </div>
                            <div style={{ fontSize: "10px", lineHeight: 1.4, opacity: 0.9 }}>{planTimeRemaining.detailLabel}</div>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => toggleClientForm(client.userId)}
                          style={{
                            ...ACTION_BUTTON_STYLE,
                            width: "100%",
                            background: isClientFormVisible ? "#e2e8f0" : accent,
                            color: isClientFormVisible ? "var(--color-text-primary)" : "white",
                          }}
                        >
                          {formToggleLabel}
                        </button>
                      </div>
                    </div>

                    {isClientFormVisible ? (
                      <>
                        <div style={{ padding: "10px 12px", borderRadius: "14px", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", fontSize: "11px", lineHeight: 1.5 }}>
                          Ajusta o plano, o acesso e as notas deste lojista aqui. Quando terminares, guarda as alteracoes do cliente.
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                      <FLabel label="ID de Identificação" hint="Define um código manual (ex: 6 dígitos) para este cliente.">
                        <input value={draft.referenceId || ""} onChange={(event) => updateClientDraft(client.userId, { referenceId: event.target.value })} placeholder="Ex.: 100205." style={FIELD_STYLE} />
                      </FLabel>

                      <FLabel label="Estado da conta">
                        <select value={draft.accountStatus} onChange={(event) => updateClientDraft(client.userId, { accountStatus: event.target.value })} style={FIELD_STYLE}>
                          {ACCOUNT_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FLabel>

                      <FLabel label="Plano">
                        <select value={draft.planId || ""} onChange={(event) => updateClientDraft(client.userId, { planId: event.target.value })} style={FIELD_STYLE}>
                          <option value="">Sem plano</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} ({plan.code})
                            </option>
                          ))}
                        </select>
                      </FLabel>

                      <FLabel label="Estado do plano">
                        <select value={draft.planStatus} onChange={(event) => updateClientDraft(client.userId, { planStatus: event.target.value })} style={FIELD_STYLE}>
                          {PLAN_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FLabel>

                      <FLabel label="Duracao do plano" hint="30 dias = 5.000 Kz, 60 dias = 10.000 Kz, 90 dias = 15.000 Kz.">
                        <select
                          value={draft.planDurationDays || ""}
                          onChange={(event) => updateClientDraft(client.userId, { planDurationDays: event.target.value })}
                          style={FIELD_STYLE}
                          disabled={!draft.planId}
                        >
                          <option value="">Escolhe a duracao</option>
                          {PLAN_DURATION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FLabel>

                      <FLabel label="Catálogo público">
                        <label style={{ ...FIELD_STYLE, display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                          <input type="checkbox" checked={Boolean(draft.publicEnabled)} onChange={(event) => updateClientDraft(client.userId, { publicEnabled: event.target.checked })} />
                          {draft.publicEnabled ? "Aberto para clientes" : "Fechado ao público"}
                        </label>
                      </FLabel>

                      <FLabel label="Início do plano" hint="A data final é calculada automaticamente pela duração escolhida.">
                        <input
                          type="date"
                          value={draft.planStartedAt || ""}
                          onChange={(event) => updateClientDraft(client.userId, { planStartedAt: event.target.value })}
                          style={FIELD_STYLE}
                          disabled={!draft.planId}
                        />
                      </FLabel>

                      <FLabel label="Fim calculado">
                        <div style={{ ...FIELD_STYLE, color: draft.planExpiresAt ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>
                          {draft.planExpiresAt ? formatDateLabel(draft.planExpiresAt) : "Define o plano e a duracao"}
                        </div>
                      </FLabel>

                      <FLabel label="Valor total">
                        <div style={{ ...FIELD_STYLE, color: draft.planId ? accent : "var(--color-text-secondary)", fontWeight: "700" }}>
                          {draft.planId ? formatMoney(draft.planTotalPrice, visiblePlanCurrency) : "Escolhe um plano"}
                        </div>
                      </FLabel>
                    </div>

                    <FLabel label="Notas internas" hint="Estas notas ficam apenas no painel do super admin.">
                      <textarea value={draft.internalNotes || ""} onChange={(event) => updateClientDraft(client.userId, { internalNotes: event.target.value })} style={TEXTAREA_STYLE} placeholder="Ex.: cliente em onboarding, pagamento pendente, pedir novo logo." />
                    </FLabel>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleClientLifecycle(client.userId, "trash")}
                        disabled={busy}
                        style={{ ...ACTION_BUTTON_STYLE, background: "#fee2e2", color: "#b91c1c" }}
                      >
                        {busy ? "A processar..." : "Mover para lixo"}
                      </button>
                      <button onClick={() => handleClientSave(client.userId)} disabled={busy} style={{ ...ACTION_BUTTON_STYLE, background: accent, color: "white" }}>
                        {busy ? "A guardar..." : "Guardar cliente"}
                      </button>
                    </div>
                      </>
                    ) : (
                      <div style={{ padding: "11px 14px", borderRadius: "14px", border: "0.5px dashed var(--color-border-tertiary)", color: "var(--color-text-secondary)", fontSize: "11px", lineHeight: 1.5 }}>
                        Os campos de gestao deste cliente estao escondidos. Clica em "{hasAssignedPlan ? "Mostrar formulario" : "Ativar plano"}" para abrir este formulario.
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
              {clientPageInfo.hasMore && onLoadMoreClients ? (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={onLoadMoreClients}
                    disabled={busy}
                    style={{ ...ACTION_BUTTON_STYLE, background: accent, color: "white", minWidth: "220px" }}
                  >
                    {busy ? "A carregar..." : "Carregar mais lojistas"}
                  </button>
                </div>
              ) : null}
              </>
            ) : (
              <div style={{ ...SURFACE_STYLE, padding: "22px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "13px" }}>
                Nenhum cliente corresponde a essa pesquisa.
              </div>
            )}
          </>
        ) : null}

        {tab === "equipa" ? (
          <>
            <div style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ maxWidth: "620px" }}>
                  <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Equipa do super admin</div>
                  <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                    Cria acessos auxiliares para os teus ajudantes entrarem no mesmo painel e ativarem empresas sem dependerem de uma loja propria.
                  </div>
                </div>
                <Badge bg={canManageAdminUsers ? "#dcfce7" : "#f3f4f6"} color={canManageAdminUsers ? "#166534" : "#475569"}>
                  <UserCog size={12} /> {canManageAdminUsers ? "Gestao liberada" : "Consulta apenas"}
                </Badge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                <StatTile label="Admins" value={summary.totalAdminUsers} hint="acessos do painel" color={accent} />
                <StatTile label="Ativos" value={summary.activeAdminUsers} hint="podem entrar" color={accent} />
                <StatTile label="Suspensos" value={summary.suspendedAdminUsers} hint="acesso bloqueado" color={accent} />
                <StatTile label="Principais" value={protectedAdminUsers.length} hint="contas protegidas" color={accent} />
                <StatTile label="Auxiliares" value={helperAdminUsers.length} hint="ajudantes da ativacao" color={accent} />
              </div>
            </div>

            {canManageAdminUsers ? (
              <CollapsiblePanel
                title="Novo admin auxiliar"
                description="Esta conta nasce sem loja ligada e entra diretamente no painel super admin."
                open={isNewAdminUserFormOpen}
                onToggle={() => setIsNewAdminUserFormOpen((current) => !current)}
                summary={
                  <div style={{ display: "grid", gap: "10px" }}>
                    <PreviewLine label="Nome" value={newAdminUserDraft.fullName || "Sem nome"} />
                    <PreviewLine label="Email" value={newAdminUserDraft.email || "Sem email"} />
                    <PreviewLine label="Estado" value={newAdminUserDraft.accountStatus === "active" ? "Ativo" : "Suspenso"} />
                  </div>
                }
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                  <FLabel label="Nome completo">
                    <input
                      value={newAdminUserDraft.fullName}
                      onChange={(event) => setNewAdminUserDraft((current) => ({ ...current, fullName: event.target.value }))}
                      style={FIELD_STYLE}
                      placeholder="Ex.: Maria do suporte."
                    />
                  </FLabel>
                  <FLabel label="Email de acesso">
                    <input
                      value={newAdminUserDraft.email}
                      onChange={(event) => setNewAdminUserDraft((current) => ({ ...current, email: event.target.value }))}
                      style={FIELD_STYLE}
                      placeholder="ajudante@kastrozap.com"
                    />
                  </FLabel>
                  <FLabel label="Palavra-passe inicial" hint={PASSWORD_POLICY_HINT}>
                    <input
                      type="password"
                      value={newAdminUserDraft.password}
                      onChange={(event) => setNewAdminUserDraft((current) => ({ ...current, password: event.target.value }))}
                      style={FIELD_STYLE}
                      placeholder="Define uma credencial forte"
                    />
                  </FLabel>
                  <FLabel label="Estado da conta">
                    <select
                      value={newAdminUserDraft.accountStatus}
                      onChange={(event) => setNewAdminUserDraft((current) => ({ ...current, accountStatus: event.target.value }))}
                      style={FIELD_STYLE}
                    >
                      {ACCOUNT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FLabel>
                </div>

                <SuperAdminAccessEditor
                  value={newAdminUserDraft.superAdminAccess}
                  onChange={updateNewAdminUserAccess}
                  accent={accent}
                />

                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", maxWidth: "680px", lineHeight: 1.6 }}>
                    Novos admins auxiliares nascem com acesso a Clientes. Liga as outras areas apenas quando quiseres libertar mais partes do painel.
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateAdminUser}
                    disabled={busy}
                    style={{ ...ACTION_BUTTON_STYLE, background: accent, color: "white" }}
                  >
                    {busy ? "A criar..." : "Criar admin auxiliar"}
                  </button>
                </div>
              </CollapsiblePanel>
            ) : (
              <div style={{ ...SURFACE_STYLE, padding: "18px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                So a conta principal do super admin pode criar ou alterar admins auxiliares. As outras contas podem continuar a ativar empresas normalmente, mas sem mexer na equipa.
              </div>
            )}

            <div style={{ ...SURFACE_STYLE, padding: "16px", display: "grid", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Acessos da equipa</div>
                  <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    Pesquisa por nome, email ou tipo de admin.
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 280px", maxWidth: "420px" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase" }}>Pesquisa</span>
                  <input
                    value={adminSearch}
                    onChange={(event) => setAdminSearch(event.target.value)}
                    placeholder="Nome, email ou principal/auxiliar"
                    style={{ ...FIELD_STYLE, padding: "8px" }}
                  />
                </div>
              </div>
            </div>

            {filteredAdminUsers.length ? (
              filteredAdminUsers.map((adminUser) => {
                const draft = adminUserDrafts[adminUser.userId] || toAdminUserDraft(adminUser);
                const isCurrentAdmin = adminUser.userId === currentAdminUserId;
                const isManageableAdmin = canManageAdminUsers && !adminUser.isProtected && !isCurrentAdmin;
                const isAdminFormVisible = openAdminUserFormUserId === adminUser.userId;
                const enabledAccessOptions = getEnabledSuperAdminAccessOptions(draft.superAdminAccess, { fullAccess: Boolean(adminUser.isProtected) });
                const helperDescription = adminUser.isProtected
                  ? "Conta principal protegida. Este acesso continua reservado para administracao do sistema."
                  : isCurrentAdmin
                    ? "Usa o menu Meu Perfil para mudar os teus dados pessoais."
                    : canManageAdminUsers
                      ? "Podes atualizar o nome, email, estado e redefinir a palavra-passe deste ajudante."
                      : "Consulta apenas. Pede a conta principal do super admin para alterar este acesso.";

                return (
                  <div key={adminUser.userId} style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <UserAvatar
                          name={adminUser.fullName}
                          email={adminUser.email}
                          avatarUrl={adminUser.avatarUrl}
                          accent={accent}
                          size={52}
                        />
                        <div style={{ display: "grid", gap: "6px" }}>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                              {adminUser.fullName || adminUser.email}
                            </div>
                            <Badge bg={adminUser.isProtected ? "#fef3c7" : "#dbeafe"} color={adminUser.isProtected ? "#92400e" : "#1d4ed8"}>
                              {adminUser.isProtected ? <Crown size={12} /> : <UserCog size={12} />}
                              {adminUser.isProtected ? "Principal" : "Auxiliar"}
                            </Badge>
                            <Badge bg={adminUser.accountStatus === "active" ? "#dcfce7" : "#fee2e2"} color={adminUser.accountStatus === "active" ? "#166534" : "#b91c1c"}>
                              <ShieldCheck size={12} /> {adminUser.accountStatus === "active" ? "Ativo" : "Suspenso"}
                            </Badge>
                            {isCurrentAdmin ? (
                              <Badge bg="#f3f4f6" color="#475569">
                                <User size={12} /> Esta conta
                              </Badge>
                            ) : null}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{adminUser.email}</div>
                          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                            <span>Criado em {formatDateLabel(adminUser.createdAt)}</span>
                            <span>Ultima atividade: {formatDateLabel(adminUser.lastActivityAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ minWidth: "220px", padding: "14px", borderRadius: "20px", background: "var(--color-background-secondary)" }}>
                        <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Escopo do acesso</div>
                        <div style={{ marginTop: "6px", fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                          {adminUser.isProtected ? "Acesso total" : `${enabledAccessOptions.length} área${enabledAccessOptions.length === 1 ? "" : "s"} ativa${enabledAccessOptions.length === 1 ? "" : "s"}`}
                        </div>
                        <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {enabledAccessOptions.map((option) => (
                            <Badge key={option.key} bg="#ecfdf5" color="#166534">
                              {option.label}
                            </Badge>
                          ))}
                        </div>
                        <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                          {adminUser.isProtected
                            ? "Conta principal com todas as areas do painel liberadas."
                            : "Clientes fica sempre ativo. As restantes areas podem ser abertas apenas quando precisares."}
                        </div>
                        {isManageableAdmin ? (
                          <button
                            type="button"
                            onClick={() => toggleAdminUserForm(adminUser.userId)}
                            style={{ ...ACTION_BUTTON_STYLE, width: "100%", marginTop: "12px", background: isAdminFormVisible ? "var(--color-background-primary)" : accent, color: isAdminFormVisible ? "var(--color-text-primary)" : "white" }}
                          >
                            {isAdminFormVisible ? "Esconder formulario" : "Mostrar formulario"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {isManageableAdmin ? (
                      isAdminFormVisible ? (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                          <FLabel label="Nome completo">
                            <input
                              value={draft.fullName}
                              onChange={(event) => updateAdminUserDraft(adminUser.userId, { fullName: event.target.value })}
                              style={FIELD_STYLE}
                              placeholder="Nome do ajudante"
                            />
                          </FLabel>
                          <FLabel label="Email de acesso">
                            <input
                              value={draft.email}
                              onChange={(event) => updateAdminUserDraft(adminUser.userId, { email: event.target.value })}
                              style={FIELD_STYLE}
                              placeholder="admin@exemplo.com"
                            />
                          </FLabel>
                          <FLabel label="Nova palavra-passe" hint="Deixa vazio para manter a palavra-passe atual.">
                            <input
                              type="password"
                              value={draft.password}
                              onChange={(event) => updateAdminUserDraft(adminUser.userId, { password: event.target.value })}
                              style={FIELD_STYLE}
                              placeholder="Redefinir credencial"
                            />
                          </FLabel>
                          <FLabel label="Estado da conta">
                            <select
                              value={draft.accountStatus}
                              onChange={(event) => updateAdminUserDraft(adminUser.userId, { accountStatus: event.target.value })}
                              style={FIELD_STYLE}
                            >
                              {ACCOUNT_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </FLabel>
                        </div>

                        <SuperAdminAccessEditor
                          value={draft.superAdminAccess}
                          onChange={(accessKey, checked) => updateAdminUserAccess(adminUser.userId, accessKey, checked)}
                          accent={accent}
                        />

                        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                            {PASSWORD_POLICY_HINT}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAdminUserSave(adminUser.userId)}
                            disabled={busy}
                            style={{ ...ACTION_BUTTON_STYLE, background: accent, color: "white" }}
                          >
                            {busy ? "A guardar..." : "Guardar admin"}
                          </button>
                        </div>
                      </>
                      ) : (
                        <div style={{ padding: "14px 16px", borderRadius: "16px", border: "0.5px dashed var(--color-border-tertiary)", color: "var(--color-text-secondary)", fontSize: "12px", lineHeight: 1.6 }}>
                          Os campos deste admin estao escondidos. Clica em "Mostrar formulario" para editar este acesso.
                        </div>
                      )
                    ) : (
                      <div style={{ padding: "14px 16px", borderRadius: "16px", border: "0.5px dashed var(--color-border-tertiary)", color: "var(--color-text-secondary)", fontSize: "12px", lineHeight: 1.6 }}>
                        {helperDescription}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ ...SURFACE_STYLE, padding: "22px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "13px" }}>
                Nenhum admin corresponde a essa pesquisa.
              </div>
            )}
          </>
        ) : null}

        {tab === "lixo" ? (
          <>
            <div style={{ ...SURFACE_STYLE, padding: "16px", display: "grid", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Lixo de empresas</div>
                  <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    Recupera uma empresa arquivada ou elimina-a para sempre quando ja nao fizer sentido mantela.
                  </div>
                </div>
                <div style={{ minWidth: "240px", flex: "1 1 280px", maxWidth: "360px" }}>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por nome, ID ou email..." style={FIELD_STYLE} />
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", paddingTop: "10px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                {trashedClientPageInfo.total > filteredTrashedClients.length
                  ? `A mostrar ${filteredTrashedClients.length} de ${trashedClientPageInfo.total} empresas no lixo`
                  : `${trashedClientPageInfo.total} empresa${trashedClientPageInfo.total === 1 ? "" : "s"} no lixo`}
              </div>
              {filteredTrashedClients.length ? (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: "700", color: "var(--color-text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={allFilteredTrashedSelected}
                      onChange={(event) => toggleAllFilteredTrashedClients(event.target.checked)}
                    />
                    Selecionar tudo ({filteredTrashedClients.length})
                  </label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      {selectedTrashedClientIds.size} selecionado{selectedTrashedClientIds.size === 1 ? "" : "s"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTrashedClientIds(new Set())}
                      disabled={busy || selectedTrashedClientIds.size === 0}
                      style={{ ...ACTION_BUTTON_STYLE, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }}
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkTrashedLifecycle("restore")}
                      disabled={busy || selectedTrashedClientIds.size === 0}
                      style={{ ...ACTION_BUTTON_STYLE, background: "#dcfce7", color: "#166534" }}
                    >
                      Recuperar selecionados
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkTrashedLifecycle("delete_forever")}
                      disabled={busy || selectedTrashedClientIds.size === 0}
                      style={{ ...ACTION_BUTTON_STYLE, background: "#b91c1c", color: "white" }}
                    >
                      Eliminar selecionados
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {filteredTrashedClients.length ? (
              <>
              {filteredTrashedClients.map((client) => (
                <div key={client.userId} style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "16px" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "700", color: "var(--color-text-secondary)", cursor: "pointer", width: "fit-content" }}>
                    <input
                      type="checkbox"
                      checked={selectedTrashedClientIds.has(client.userId)}
                      onChange={(event) => toggleTrashedClientSelection(client.userId, event.target.checked)}
                    />
                    Selecionar lojista
                  </label>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{client.storeName || client.fullName || client.email}</div>
                        <Badge bg="#fee2e2" color="#b91c1c">
                          <Trash2 size={12} /> No lixo
                        </Badge>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{client.email}</div>
                      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <Store size={12} /> {client.storeId ? `Loja ${client.storeId.slice(0, 8)}` : "Sem loja criada"}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <AlertTriangle size={12} /> Movida para o lixo em {formatDateLabel(client.deletedAt)}
                        </span>
                      </div>
                    </div>

                    <div style={{ minWidth: "220px", padding: "14px", borderRadius: "20px", background: "var(--color-background-secondary)" }}>
                      <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Plano antes do lixo</div>
                      <div style={{ marginTop: "6px", fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{client.planName || "Sem plano definido"}</div>
                      <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                        {client.planDurationDays ? `${client.planDurationDays} dias` : "Sem duracao ativa"} {client.planTotalPrice ? `- ${formatMoney(client.planTotalPrice, client.planCurrencyCode)}` : ""}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleClientLifecycle(client.userId, "restore")}
                      disabled={busy}
                      style={{ ...ACTION_BUTTON_STYLE, background: "#dcfce7", color: "#166534", display: "inline-flex", alignItems: "center", gap: "8px" }}
                    >
                      <RotateCcw size={13} /> {busy ? "A processar..." : "Recuperar empresa"}
                    </button>
                    <button
                      onClick={() => handleClientLifecycle(client.userId, "delete_forever")}
                      disabled={busy}
                      style={{ ...ACTION_BUTTON_STYLE, background: "#b91c1c", color: "white", display: "inline-flex", alignItems: "center", gap: "8px" }}
                    >
                      <Trash2 size={13} /> {busy ? "A processar..." : "Eliminar para sempre"}
                    </button>
                  </div>
                </div>
              ))}
              {trashedClientPageInfo.hasMore && onLoadMoreTrashedClients ? (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={onLoadMoreTrashedClients}
                    disabled={busy}
                    style={{ ...ACTION_BUTTON_STYLE, background: accent, color: "white", minWidth: "220px" }}
                  >
                    {busy ? "A carregar..." : "Carregar mais empresas"}
                  </button>
                </div>
              ) : null}
              </>
            ) : (
              <div style={{ ...SURFACE_STYLE, padding: "22px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "13px" }}>
                Nenhuma empresa esta no lixo agora.
              </div>
            )}
          </>
        ) : null}

        {tab === "financeiro" ? (
          <SuperAdminFinanceTab
            events={financialEvents}
            clients={clients}
            accent={accent}
            pageInfo={financialEventPageInfo}
            onLoadMore={onLoadMoreFinancialEvents}
            loading={busy}
          />
        ) : null}

        {tab === "planos" ? (
          <>
            <div style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "10px", background: "linear-gradient(135deg, rgba(12, 37, 34, 0.96) 0%, rgba(28, 154, 116, 0.92) 70%, rgba(240, 201, 120, 0.9) 180%)", color: "white" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <Badge bg="rgba(255,255,255,0.14)" color="white" borderColor="rgba(255,255,255,0.14)">
                  <Wallet size={12} /> Precos dos pacotes
                </Badge>
                <Badge bg="rgba(255,255,255,0.14)" color="white" borderColor="rgba(255,255,255,0.14)">
                  <Settings size={12} /> Sem mexer no codigo
                </Badge>
              </div>
              <div style={{ fontSize: "22px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                Os pacotes comerciais podem ser criados e ter o preco alterado aqui no painel.
              </div>
              <div style={{ fontSize: "13px", opacity: 0.92, maxWidth: "760px", lineHeight: 1.7 }}>
                Sempre que o super admin guardar um novo preco, a base atualiza e a aba de planos do lojista passa a mostrar o novo valor automaticamente. Nao e preciso voltar ao codigo para trocar os precos.
              </div>
            </div>
            {/* Seção de Criação de Novos Planos */}
            <div style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "16px", borderLeft: `4px solid ${accent}` }}>
              <div>
                  <div style={{ fontSize: "20px", fontWeight: "800", fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}>Novo Pacote de Assinatura</div>
                <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  Configure os limites técnicos e o preço base mensal (30 dias) para os novos lojistas.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewPlanFormOpen((current) => !current)}
                style={{
                  border: "0.5px solid var(--color-border-tertiary)",
                  borderRadius: "999px",
                  padding: "9px 12px",
                  background: isNewPlanFormOpen ? "var(--color-background-secondary)" : "var(--color-background-primary)",
                  color: "var(--color-text-primary)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "700",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                  justifySelf: "flex-start",
                }}
              >
                {isNewPlanFormOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {isNewPlanFormOpen ? "Esconder formulario" : "Mostrar formulario"}
              </button>

              {isNewPlanFormOpen ? (
                <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                <FLabel label="Codigo">
                  <input value={newPlanDraft.code} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, code: event.target.value })} placeholder="enterprise" style={FIELD_STYLE} />
                </FLabel>
                <FLabel label="Nome">
                  <input value={newPlanDraft.name} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, name: event.target.value })} placeholder="Enterprise" style={FIELD_STYLE} />
                </FLabel>
                <FLabel label="Preco do pacote / 30 dias" hint="Ex: 5.000 Kz por cada bloco de 30 dias.">
                  <input type="number" min="0" step="0.01" value={newPlanDraft.priceMonthly} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, priceMonthly: event.target.value })} style={FIELD_STYLE} />
                </FLabel>
                <FLabel label="Moeda">
                  <select value={newPlanDraft.currencyCode} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, currencyCode: event.target.value })} style={FIELD_STYLE}>
                    {STORE_CURRENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.value}
                      </option>
                    ))}
                  </select>
                </FLabel>
                <FLabel label="Max. produtos">
                  <input type="number" min="0" step="1" value={newPlanDraft.maxProducts} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, maxProducts: event.target.value })} style={FIELD_STYLE} />
                </FLabel>
                <FLabel label="Max. equipa">
                  <input type="number" min="0" step="1" value={newPlanDraft.maxTeamMembers} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, maxTeamMembers: event.target.value })} style={FIELD_STYLE} />
                </FLabel>
              </div>

              <FLabel label="Descricao">
                <textarea value={newPlanDraft.description} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, description: event.target.value })} style={TEXTAREA_STYLE} placeholder="Descreve o público ideal, suporte e principais limites." />
              </FLabel>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--color-text-primary)" }}>
                  <input type="checkbox" checked={newPlanDraft.active} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, active: event.target.checked })} />
                  Plano disponível para atribuição
                </label>
                <button onClick={handleCreatePlan} disabled={busy} style={{ ...ACTION_BUTTON_STYLE, background: accent, color: "white" }}>
                  {busy ? "A guardar..." : "Criar pacote"}
                </button>
              </div>
                </>
              ) : (
                <div style={{ padding: "14px 16px", borderRadius: "16px", border: "0.5px dashed var(--color-border-tertiary)", color: "var(--color-text-secondary)", fontSize: "12px", lineHeight: 1.6 }}>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <PreviewLine label="Código" value={newPlanDraft.code || "Sem código"} />
                    <PreviewLine label="Nome" value={newPlanDraft.name || "Sem nome"} />
                    <PreviewLine
                      label="Preco do pacote"
                      value={newPlanDraft.priceMonthly ? formatMoney(newPlanDraft.priceMonthly, newPlanDraft.currencyCode || "AOA") : "Sem preco"}
                    />
                    <PreviewLine label="Estado" value={newPlanDraft.active ? "Disponivel para atribuicao" : "Arquivado"} />
                  </div>
                </div>
              )}
            </div>

            {/* Listagem de Planos Existentes */}
            <div style={{ marginTop: "12px", display: "grid", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "0 4px", flexWrap: "wrap" }}>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Pacotes Configurados ({plans.length})
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfiguredPlansOpen((current) => !current)}
                  style={{
                    border: "0.5px solid var(--color-border-tertiary)",
                    borderRadius: "999px",
                    padding: "9px 12px",
                    background: isConfiguredPlansOpen ? "var(--color-background-secondary)" : "var(--color-background-primary)",
                    color: "var(--color-text-primary)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "700",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isConfiguredPlansOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {isConfiguredPlansOpen ? "Esconder planos" : "Mostrar planos"}
                </button>
              </div>

              {isConfiguredPlansOpen ? (
                <>
              <PlanDistributionChart plans={plans} filteredClients={filteredClients} accent={accent} />

              {plans.map((plan) => {
              const draft = planDrafts[plan.id] || toPlanDraft(plan);
              const isPlanFormVisible = openPlanFormId === plan.id;
              return (
                <div key={plan.id} style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <div style={{ fontSize: "19px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{plan.name}</div>
                        <Badge bg={plan.active ? "#dcfce7" : "#f3f4f6"} color={plan.active ? "#166534" : "#475569"}>
                          <Wallet size={12} /> {plan.active ? "Disponivel" : "Arquivado"}
                        </Badge>
                      </div>
                      <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                        Preco atual: <span style={{ fontWeight: "700", color: "var(--color-text-primary)" }}>{formatMoney(plan.priceMonthly, plan.currencyCode)}</span> / 30 dias
                      </div>
                    </div>

                    <div style={{ minWidth: "220px", display: "grid", gap: "10px" }}>
                      <div style={{ padding: "14px", borderRadius: "20px", background: "var(--color-background-secondary)" }}>
                        <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Distribuicao atual</div>
                        <div style={{ marginTop: "6px", fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{plan.storeCount} lojas</div>
                        <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>Ligadas a este plano hoje.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePlanForm(plan.id)}
                        style={{
                          border: "0.5px solid var(--color-border-tertiary)",
                          borderRadius: "999px",
                          padding: "9px 12px",
                          background: isPlanFormVisible ? "var(--color-background-secondary)" : "var(--color-background-primary)",
                          color: "var(--color-text-primary)",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "700",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isPlanFormVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isPlanFormVisible ? "Esconder formulario" : "Mostrar formulario"}
                      </button>
                    </div>
                  </div>

                  {isPlanFormVisible ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                        <FLabel label="Codigo">
                          <input value={draft.code} onChange={(event) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, code: event.target.value } }))} style={FIELD_STYLE} />
                        </FLabel>
                        <FLabel label="Nome">
                          <input value={draft.name} onChange={(event) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, name: event.target.value } }))} style={FIELD_STYLE} />
                        </FLabel>
                        <FLabel label="Preco do pacote / 30 dias" hint="O cliente pode ativar 30, 60, 90 dias ou mais na aba de clientes.">
                          <input type="number" min="0" step="0.01" value={draft.priceMonthly} onChange={(event) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, priceMonthly: event.target.value } }))} style={FIELD_STYLE} />
                        </FLabel>
                        <FLabel label="Moeda">
                          <select value={draft.currencyCode} onChange={(event) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, currencyCode: event.target.value } }))} style={FIELD_STYLE}>
                            {STORE_CURRENCY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.value}
                              </option>
                            ))}
                          </select>
                        </FLabel>
                        <FLabel label="Max. produtos">
                          <input type="number" min="0" step="1" value={draft.maxProducts} onChange={(event) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, maxProducts: event.target.value } }))} style={FIELD_STYLE} />
                        </FLabel>
                        <FLabel label="Max. equipa">
                          <input type="number" min="0" step="1" value={draft.maxTeamMembers} onChange={(event) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, maxTeamMembers: event.target.value } }))} style={FIELD_STYLE} />
                        </FLabel>
                        <FLabel label="Ordenacao">
                          <input type="number" step="1" value={draft.sortOrder} onChange={(event) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, sortOrder: event.target.value } }))} style={FIELD_STYLE} />
                        </FLabel>
                        <FLabel label="Disponibilidade">
                          <label style={{ ...FIELD_STYLE, display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                            <input type="checkbox" checked={draft.active} onChange={(event) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, active: event.target.checked } }))} />
                            {draft.active ? "Plano ativo para venda" : "Plano arquivado"}
                          </label>
                        </FLabel>
                      </div>

                      <FLabel label="Descricao" hint="Usa este campo para registar o posicionamento comercial e o tipo de suporte.">
                        <textarea value={draft.description} onChange={(event) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, description: event.target.value } }))} style={TEXTAREA_STYLE} />
                      </FLabel>

                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <Badge bg="#f3f4f6" color="#475569">
                            <Package size={12} /> Limite {draft.maxProducts || "livre"} produtos
                          </Badge>
                          <Badge bg="#f3f4f6" color="#475569">
                            <Users size={12} /> Equipa {draft.maxTeamMembers || "livre"}
                          </Badge>
                        </div>
                        <button onClick={() => handlePlanSave(plan.id)} disabled={busy} style={{ ...ACTION_BUTTON_STYLE, background: accent, color: "white" }}>
                          {busy ? "A guardar..." : "Guardar pacote"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: "14px 16px", borderRadius: "16px", border: "0.5px dashed var(--color-border-tertiary)", color: "var(--color-text-secondary)", fontSize: "12px", lineHeight: 1.6 }}>
                      <div style={{ display: "grid", gap: "10px" }}>
                        <PreviewLine label="Código" value={draft.code || "Sem código"} />
                        <PreviewLine label="Nome" value={draft.name || "Sem nome"} />
                        <PreviewLine
                          label="Preco do pacote"
                          value={draft.priceMonthly ? formatMoney(draft.priceMonthly, draft.currencyCode || "AOA") : "Sem preco"}
                        />
                        <PreviewLine label="Estado" value={draft.active ? "Disponivel" : "Arquivado"} />
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        O formulario deste plano esta oculto. Clica em "Mostrar formulario" para editar este pacote.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
                </>
              ) : (
                <div style={{ padding: "14px 16px", borderRadius: "16px", border: "0.5px dashed var(--color-border-tertiary)", color: "var(--color-text-secondary)", fontSize: "12px", lineHeight: 1.6 }}>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <PreviewLine label="Total" value={`${plans.length} plano(s)`} />
                    <PreviewLine label="Disponiveis" value={String(plans.filter((plan) => plan.active).length)} />
                    <PreviewLine label="Arquivados" value={String(plans.filter((plan) => !plan.active).length)} />
                  </div>
                  <div style={{ marginTop: "10px" }}>
                    Esta lista esta oculta. Clica em "Mostrar planos" para abrir os formularios configurados.
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}

        {tab === "configuracoes" ? (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "14px" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: "800", marginBottom: "6px" }}>Trial gratuito para novas contas</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  Liga ou desliga o acesso automático aos 7 dias grátis quando um novo lojista cria conta.
                </div>
              </div>
              <ToggleTile
                label={parseBooleanSettingDraft("trial_enabled", settingsDrafts.trial_enabled) ? "Trial ativo" : "Trial desativado"}
                description={
                  parseBooleanSettingDraft("trial_enabled", settingsDrafts.trial_enabled)
                    ? "Novas contas recebem os 7 dias grátis automaticamente."
                    : "Novas contas entram sem trial e precisam assinar um plano pago para desbloquear a operacao."
                }
                checked={parseBooleanSettingDraft("trial_enabled", settingsDrafts.trial_enabled)}
                onChange={(checked) => {
                  const nextValue = checked ? "true" : "false";
                  setSettingsDrafts((current) => ({ ...current, trial_enabled: nextValue }));
                  commitSettingValue("trial_enabled", nextValue, String(data?.settings?.trial_enabled?.value ?? "true")).catch(() => {});
                }}
              />
            </div>
            <div style={{ ...SURFACE_STYLE, padding: "20px", display: "grid", gap: "14px" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: "800", marginBottom: "6px" }}>Cadastro público de lojistas</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  Controla se qualquer lojista pode criar conta sozinho na tela de autenticacao.
                </div>
              </div>
              <ToggleTile
                label={parseBooleanSettingDraft("merchant_registration_enabled", settingsDrafts.merchant_registration_enabled) ? "Cadastro aberto" : "Cadastro fechado"}
                description={
                  parseBooleanSettingDraft("merchant_registration_enabled", settingsDrafts.merchant_registration_enabled)
                    ? "Novos lojistas conseguem pedir acesso, mas a loja continua dependente da criacao ou ativacao no super admin."
                    : "Novos lojistas deixam de criar conta sozinhos e passam a depender do super admin."
                }
                checked={parseBooleanSettingDraft("merchant_registration_enabled", settingsDrafts.merchant_registration_enabled)}
                onChange={(checked) => {
                  const nextValue = checked ? "true" : "false";
                  setSettingsDrafts((current) => ({ ...current, merchant_registration_enabled: nextValue }));
                  commitSettingValue("merchant_registration_enabled", nextValue, String(data?.settings?.merchant_registration_enabled?.value ?? "true")).catch(() => {});
                }}
              />
            </div>
            <div style={{ ...SURFACE_STYLE, padding: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", marginBottom: "16px" }}>Variáveis Globais do Sistema</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  {!isSystemSettingsOpen
                    ? `${configuredSettings.length} de ${settingsEntries.length} variÃ¡veis com valor guardado.`
                    : "Ajusta os limites e valores partilhados por todas as lojas."}
                </div>
                {settingsEntries.length ? (
                  <button
                    type="button"
                    onClick={() => setIsSystemSettingsOpen((current) => !current)}
                    style={{
                      ...ACTION_BUTTON_STYLE,
                      background: isSystemSettingsOpen ? "var(--color-background-secondary)" : accent,
                      color: isSystemSettingsOpen ? "var(--color-text-primary)" : "white",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Settings size={14} /> {isSystemSettingsOpen ? "Fechar ediÃ§Ã£o" : "Editar variÃ¡veis"}
                  </button>
                ) : null}
              </div>
              {isSystemSettingsOpen ? (
                <div style={{ display: "grid", gap: "20px" }}>
                {settingsEntries.map(([key, info]) => (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", paddingBottom: "16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "700", fontSize: "14px" }}>{formatSettingLabel(key)}</div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{info.description}</div>
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      {savedKeys.has(key) && (
                        <div style={{ color: "#166534", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: "700", animation: "fade-in 0.3s ease" }}>
                          <Check size={16} /> Gravado
                        </div>
                      )}
                      <input 
                        style={{ 
                          ...FIELD_STYLE, 
                          width: "200px", 
                          borderColor: savedKeys.has(key) ? "#166534" : "var(--color-border-tertiary)",
                          transition: "border-color 0.3s ease"
                        }} 
                        defaultValue={info.value}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setSettingsDrafts((current) => ({ ...current, [key]: nextValue }));
                        }}
                        onBlur={async (e) => {
                          const nextValue = e.target.value;
                          if (nextValue === info.value) return;
                          if (onSaveSetting) {
                            try {
                              await onSaveSetting({ key, value: nextValue });
                              setSavedKeys(prev => new Set(prev).add(key));
                              setSettingsDrafts((current) => ({ ...current, [key]: nextValue }));
                              setIsSystemSettingsOpen(false);
                              if (toast) toast(`✅ Configuração ${formatSettingLabel(key)} atualizada.`);
                              
                              // Remove o feedback visual após 3 segundos
                              setTimeout(() => {
                                setSavedKeys(prev => {
                                  const next = new Set(prev);
                                  next.delete(key);
                                  return next;
                                });
                              }, 3000);
                            } catch (err) {
                              if (toast) toast(`❌ Erro ao atualizar ${formatSettingLabel(key)}`);
                              setSettingsDrafts((current) => ({ ...current, [key]: String(info.value || "") }));
                              e.target.value = info.value; // Reverte o valor em caso de erro
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
                </div>
              ) : (
                settingsSummary.length ? (
                  <div style={{ display: "grid", gap: "10px" }}>
                    {settingsSummary.map((entry) => (
                      <div
                        key={entry.key}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 14px",
                          borderRadius: "16px",
                          background: "var(--color-background-secondary)",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-text-secondary)" }}>
                          {entry.label}
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-text-primary)", textAlign: "right", wordBreak: "break-word" }}>
                          {entry.value}
                        </div>
                      </div>
                    ))}
                    {configuredSettings.length > settingsSummary.length ? (
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                        E mais {configuredSettings.length - settingsSummary.length} variÃ¡veis guardadas.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ padding: "16px", borderRadius: "16px", background: "var(--color-background-secondary)", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    Ainda nÃ£o existem variÃ¡veis globais preenchidas. Usa o botÃ£o acima para editar.
                  </div>
                )
              )}
            </div>
          </div>
        ) : null}
      </div>

      {toast && toastNode}

      {isProfileModalOpen && (
        <ProfileModal 
          user={session?.user} 
          onSave={handleProfileSaveWithFeedback} 
          onClose={() => setIsProfileModalOpen(false)} 
          accent={accent}
          busy={busy}
        />
      )}
    </div>
  );
}
