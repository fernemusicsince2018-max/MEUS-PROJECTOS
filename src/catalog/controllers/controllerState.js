import { STORE_DEFAULTS } from "../constants.js";

export const EMPTY_ORDER_META = {
  customerName: "",
  customerPhone: "",
  fulfillmentType: "",
  province: "",
  area: "",
  pickupTime: "",
  deliveryTime: "",
  notes: "",
};

export const DEFAULT_SUPER_ADMIN_ACCESS = {
  clientes: true,
  equipa: false,
  financeiro: false,
  lixo: false,
  planos: false,
  configuracoes: false,
};

export const SUPER_ADMIN_CLIENT_PAGE_SIZE = 24;
export const SUPER_ADMIN_FINANCIAL_EVENTS_PAGE_SIZE = 50;

export const EMPTY_SUPER_ADMIN_PAGE_INFO = {
  total: 0,
  limit: SUPER_ADMIN_CLIENT_PAGE_SIZE,
  hasMore: false,
  endCursor: "",
};

export const EMPTY_SUPER_ADMIN_FINANCIAL_PAGE_INFO = {
  total: 0,
  limit: SUPER_ADMIN_FINANCIAL_EVENTS_PAGE_SIZE,
  hasMore: false,
  endCursor: "",
};

export const EMPTY_SUPER_ADMIN_DATA = {
  summary: {
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
  },
  clients: [],
  clientPageInfo: EMPTY_SUPER_ADMIN_PAGE_INFO,
  trashedClients: [],
  trashedClientPageInfo: EMPTY_SUPER_ADMIN_PAGE_INFO,
  recentClients: [],
  urgentClients: [],
  urgentClientsTotal: 0,
  pendingAccessRequests: [],
  adminUsers: [],
  plans: [],
  settings: {},
  financialEvents: [],
  financialEventPageInfo: EMPTY_SUPER_ADMIN_FINANCIAL_PAGE_INFO,
  planActivationRequests: [],
  permissions: {
    canManageAdminUsers: false,
    access: DEFAULT_SUPER_ADMIN_ACCESS,
  },
};

export const EMPTY_MERCHANT_PLAN_CATALOG = {
  store: {
    id: "",
    name: "",
    referenceId: "",
    productCount: 0,
    currentPlanId: "",
    currentPlanStatus: "",
    currentPlanExpiresAt: null,
    currentPlanDurationDays: "",
    currentPlanTotalPrice: 0,
    currentPlanCurrencyCode: "AOA",
    supportWhatsApp: "",
    trialDays: 0,
    maxFreeProducts: 0,
  },
  activeRequest: null,
  plans: [],
};

export const EMPTY_BLOCKED_CATALOG = {
  message: "",
  store: STORE_DEFAULTS,
  planStatus: "",
  planExpiresAt: "",
};

export const INITIAL_SUPER_ADMIN_LIST_QUERY = {
  search: "",
  dateFrom: "",
  dateTo: "",
};
