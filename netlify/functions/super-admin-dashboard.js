import {
  canManageSuperAdminUsers,
  getEffectiveUserRole,
  getResolvedSuperAdminAccess,
  getSuperAdminAllowlist,
  getSuperAdminSession,
  isPrimarySuperAdminEmail,
} from "./_auth.js";
import { mapPlanRequestsWithProofs } from "./_plan-requests.js";
import { getPool, hasColumn, jsonResponse, withCors } from "./_postgres.js";
import { buildSystemSettingsCatalog } from "./_settings.js";

const DEFAULT_CLIENTS_PAGE_SIZE = 24;
const MAX_CLIENTS_PAGE_SIZE = 100;
const DEFAULT_FINANCIAL_EVENTS_PAGE_SIZE = 50;
const MAX_FINANCIAL_EVENTS_PAGE_SIZE = 200;
const PENDING_ACCESS_REQUESTS_PREVIEW_LIMIT = 6;

function toClientPayload(row) {
  return {
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name || "",
    role: getEffectiveUserRole(row),
    accountStatus: row.account_status || "active",
    storeId: row.store_id || "",
    storeName: row.store_name || "",
    referenceId: row.reference_id || "",
    publicEnabled: Boolean(row.public_enabled),
    productCount: Number(row.product_count || 0),
    lastActivityAt: row.last_activity_at || null,
    createdAt: row.created_at || null,
    planId: row.plan_id || "",
    planCode: row.plan_code || "",
    planName: row.plan_name || "",
    planStatus: row.plan_status || "trial",
    planStartedAt: row.plan_started_at || null,
    planExpiresAt: row.plan_expires_at || null,
    planDurationDays: row.plan_duration_days == null ? "" : Number(row.plan_duration_days),
    planTotalPrice: row.plan_total_price == null ? 0 : Number(row.plan_total_price),
    planCurrencyCode: row.plan_currency_code || "AOA",
    internalNotes: row.internal_notes || "",
    deletedAt: row.deleted_at || null,
    deletedByUserId: row.deleted_by_user_id || "",
  };
}

function toAdminUserPayload(row) {
  return {
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name || "",
    avatarUrl: row.avatar_url || "",
    superAdminAccess: getResolvedSuperAdminAccess(row),
    role: getEffectiveUserRole(row),
    accountStatus: row.account_status || "active",
    createdAt: row.created_at || null,
    lastActivityAt: row.last_activity_at || null,
    isProtected: isPrimarySuperAdminEmail(row.email),
  };
}

function toPlanPayload(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || "",
    priceMonthly: Number(row.price_monthly || 0),
    currencyCode: row.currency_code || "AOA",
    maxProducts: row.max_products == null ? "" : Number(row.max_products),
    maxTeamMembers: row.max_team_members == null ? "" : Number(row.max_team_members),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order || 0),
    storeCount: Number(row.store_count || 0),
  };
}

function toFinancialEventPayload(row) {
  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id,
    recordedByUserId: row.recorded_by_user_id || "",
    planId: row.plan_id,
    eventType: row.event_type || "activation",
    planCode: row.plan_code || "",
    planName: row.plan_name || "",
    storeName: row.store_name || "",
    merchantEmail: row.merchant_email || "",
    referenceId: row.reference_id || "",
    planStatus: row.plan_status || "active",
    durationDays: row.duration_days == null ? 0 : Number(row.duration_days),
    totalPrice: row.total_price == null ? 0 : Number(row.total_price),
    currencyCode: row.currency_code || "AOA",
    planStartedAt: row.plan_started_at || null,
    planExpiresAt: row.plan_expires_at || null,
    recordedAt: row.recorded_at || null,
  };
}

function parsePositiveInt(value, fallbackValue = DEFAULT_CLIENTS_PAGE_SIZE, maxValue = MAX_CLIENTS_PAGE_SIZE) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallbackValue;
  }

  return Math.min(maxValue, Math.floor(numeric));
}

function normalizeScope(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "clients" || normalized === "trashedclients" || normalized === "financialevents") {
    return normalized;
  }

  return "full";
}

function normalizeDateInput(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function addParam(values, value) {
  values.push(value);
  return `$${values.length}`;
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(rawCursor) {
  const normalized = String(rawCursor || "").trim();
  if (!normalized) return null;

  try {
    const parsed = JSON.parse(Buffer.from(normalized, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

function buildPageInfo(rows, limit, total, cursorBuilder) {
  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = visibleRows[visibleRows.length - 1] || null;

  return {
    rows: visibleRows,
    pageInfo: {
      total: Number(total || 0),
      limit,
      hasMore,
      endCursor: hasMore && lastRow ? cursorBuilder(lastRow) : "",
    },
  };
}

function buildMerchantExclusionSql(values, allowlistedEmails) {
  const conditions = ["users.role <> 'super_admin'"];

  if (allowlistedEmails.length) {
    const placeholder = addParam(values, allowlistedEmails);
    conditions.push(`not (lower(users.email) = any(${placeholder}::text[]))`);
  }

  return conditions.join(" and ");
}

function appendClientSearchFilter(values, search) {
  const query = String(search || "").trim().toLowerCase();
  if (!query) {
    return "";
  }

  const exactPlaceholder = addParam(values, query);
  const partialPlaceholder = addParam(values, `%${query}%`);

  return `and (
    lower(coalesce(users.email, '')) like ${partialPlaceholder}
    or lower(coalesce(users.full_name, '')) like ${partialPlaceholder}
    or lower(coalesce(stores.name, '')) like ${partialPlaceholder}
    or lower(coalesce(stores.reference_id, '')) like ${partialPlaceholder}
    or lower(coalesce(plans.name, '')) like ${partialPlaceholder}
    or lower(coalesce(plans.code, '')) like ${partialPlaceholder}
    or lower(coalesce(users.id, '')) = ${exactPlaceholder}
    or lower(coalesce(stores.id, '')) = ${exactPlaceholder}
    or lower(coalesce(stores.reference_id, '')) = ${exactPlaceholder}
  )`;
}

function appendActiveClientDateFilters(values, dateFrom, dateTo) {
  const clauses = [];
  const normalizedFrom = normalizeDateInput(dateFrom);
  const normalizedTo = normalizeDateInput(dateTo);

  if (normalizedFrom) {
    const placeholder = addParam(values, normalizedFrom);
    clauses.push(`and stores.plan_started_at is not null and stores.plan_started_at::date >= ${placeholder}::date`);
  }

  if (normalizedTo) {
    const placeholder = addParam(values, normalizedTo);
    clauses.push(`and stores.plan_started_at is not null and stores.plan_started_at::date <= ${placeholder}::date`);
  }

  return clauses.join("\n");
}

function appendActiveCursorFilter(values, cursor) {
  const parsed = decodeCursor(cursor);
  if (!parsed?.createdAt || !parsed?.userId) {
    return "";
  }

  const createdAtPlaceholder = addParam(values, parsed.createdAt);
  const userIdPlaceholder = addParam(values, parsed.userId);
  return `and (
    users.created_at < ${createdAtPlaceholder}::timestamptz
    or (
      users.created_at = ${createdAtPlaceholder}::timestamptz
      and users.id < ${userIdPlaceholder}
    )
  )`;
}

function appendTrashedCursorFilter(values, cursor) {
  const parsed = decodeCursor(cursor);
  if (!parsed?.deletedAt || !parsed?.userId) {
    return "";
  }

  const deletedAtPlaceholder = addParam(values, parsed.deletedAt);
  const userIdPlaceholder = addParam(values, parsed.userId);
  return `and (
    coalesce(users.deleted_at, stores.deleted_at) < ${deletedAtPlaceholder}::timestamptz
    or (
      coalesce(users.deleted_at, stores.deleted_at) = ${deletedAtPlaceholder}::timestamptz
      and users.id < ${userIdPlaceholder}
    )
  )`;
}

function appendFinancialEventsCursorFilter(values, cursor) {
  const parsed = decodeCursor(cursor);
  if (!parsed?.sortAt || !parsed?.id) {
    return "";
  }

  const sortAtPlaceholder = addParam(values, parsed.sortAt);
  const idPlaceholder = addParam(values, parsed.id);
  return `and (
    coalesce(events.plan_started_at, events.recorded_at) < ${sortAtPlaceholder}::timestamptz
    or (
      coalesce(events.plan_started_at, events.recorded_at) = ${sortAtPlaceholder}::timestamptz
      and events.id < ${idPlaceholder}
    )
  )`;
}

async function hasSettingsCategoryColumn(pool) {
  const result = await pool.query(
    `select 1
       from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_settings'
        and column_name = 'category'
      limit 1`,
  );

  return result.rowCount > 0;
}

function createEmptyClientPage(limit = DEFAULT_CLIENTS_PAGE_SIZE) {
  return {
    rows: [],
    pageInfo: {
      total: 0,
      limit,
      hasMore: false,
      endCursor: "",
    },
  };
}

function createEmptyFinancialEventsPage(limit = DEFAULT_FINANCIAL_EVENTS_PAGE_SIZE) {
  return {
    rows: [],
    pageInfo: {
      total: 0,
      limit,
      hasMore: false,
      endCursor: "",
    },
  };
}

function buildActiveClientCursor(row) {
  return encodeCursor({
    createdAt: row.created_at,
    userId: row.user_id,
  });
}

function buildTrashedClientCursor(row) {
  return encodeCursor({
    deletedAt: row.deleted_at,
    userId: row.user_id,
  });
}

function buildFinancialEventCursor(row) {
  return encodeCursor({
    sortAt: row.sort_at,
    id: row.id,
  });
}

async function fetchActiveClientsPage(pool, allowlistedEmails, options = {}) {
  const limit = parsePositiveInt(options.limit, DEFAULT_CLIENTS_PAGE_SIZE);
  const listValues = [];
  const baseConditions = [
    buildMerchantExclusionSql(listValues, allowlistedEmails),
    "coalesce(users.deleted_at, stores.deleted_at) is null",
  ];

  const searchFilter = appendClientSearchFilter(listValues, options.search);
  if (searchFilter) {
    baseConditions.push(searchFilter.replace(/^and\s+/i, ""));
  }

  const dateFilters = appendActiveClientDateFilters(listValues, options.dateFrom, options.dateTo)
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^and\s+/i, ""));
  baseConditions.push(...dateFilters);

  const cursorFilter = appendActiveCursorFilter(listValues, options.cursor);
  if (cursorFilter) {
    baseConditions.push(cursorFilter.replace(/^and\s+/i, ""));
  }

  const limitPlaceholder = addParam(listValues, limit + 1);
  const whereSql = baseConditions.join("\n           and ");

  const listResult = await pool.query(
    `select
       users.id as user_id,
       users.email,
       users.full_name,
       users.avatar_url,
       users.role,
       users.account_status,
       users.created_at,
       stores.id as store_id,
       stores.name as store_name,
       stores.reference_id,
       stores.public_enabled,
       stores.plan_id,
       stores.plan_status,
       stores.plan_started_at,
       stores.plan_expires_at,
       stores.plan_duration_days,
       stores.plan_total_price,
       plans.currency_code as plan_currency_code,
       stores.internal_notes,
       coalesce(products.product_count, 0)::int as product_count,
       sessions.last_activity_at,
       null::timestamptz as deleted_at,
       ''::text as deleted_by_user_id,
       plans.code as plan_code,
       plans.name as plan_name
     from catalog_users users
     left join catalog_stores stores on stores.owner_user_id = users.id
     left join catalog_plan_definitions plans on plans.id = stores.plan_id
     left join lateral (
       select count(*)::int as product_count
       from catalog_products
       where catalog_id = stores.id
     ) products on true
     left join lateral (
       select max(last_used_at) as last_activity_at
       from catalog_sessions
       where user_id = users.id
     ) sessions on true
     where ${whereSql}
     order by users.created_at desc, users.id desc
     limit ${limitPlaceholder}`,
    listValues,
  );

  const countValues = [];
  const countConditions = [
    buildMerchantExclusionSql(countValues, allowlistedEmails),
    "coalesce(users.deleted_at, stores.deleted_at) is null",
  ];
  const countSearchFilter = appendClientSearchFilter(countValues, options.search);
  if (countSearchFilter) {
    countConditions.push(countSearchFilter.replace(/^and\s+/i, ""));
  }
  const countDateFilters = appendActiveClientDateFilters(countValues, options.dateFrom, options.dateTo)
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^and\s+/i, ""));
  countConditions.push(...countDateFilters);

  const countResult = await pool.query(
    `select count(*)::int as total
     from catalog_users users
     left join catalog_stores stores on stores.owner_user_id = users.id
     left join catalog_plan_definitions plans on plans.id = stores.plan_id
     where ${countConditions.join("\n       and ")}`,
    countValues,
  );

  return buildPageInfo(
    listResult.rows,
    limit,
    countResult.rows[0]?.total || 0,
    buildActiveClientCursor,
  );
}

async function fetchTrashedClientsPage(pool, allowlistedEmails, options = {}) {
  const limit = parsePositiveInt(options.limit, DEFAULT_CLIENTS_PAGE_SIZE);
  const listValues = [];
  const baseConditions = [
    buildMerchantExclusionSql(listValues, allowlistedEmails),
    "coalesce(users.deleted_at, stores.deleted_at) is not null",
  ];

  const searchFilter = appendClientSearchFilter(listValues, options.search);
  if (searchFilter) {
    baseConditions.push(searchFilter.replace(/^and\s+/i, ""));
  }

  const cursorFilter = appendTrashedCursorFilter(listValues, options.cursor);
  if (cursorFilter) {
    baseConditions.push(cursorFilter.replace(/^and\s+/i, ""));
  }

  const limitPlaceholder = addParam(listValues, limit + 1);
  const whereSql = baseConditions.join("\n           and ");

  const listResult = await pool.query(
    `select
       users.id as user_id,
       users.email,
       users.full_name,
       users.avatar_url,
       users.role,
       users.account_status,
       users.created_at,
       stores.id as store_id,
       stores.name as store_name,
       stores.reference_id,
       stores.public_enabled,
       stores.plan_id,
       stores.plan_status,
       stores.plan_started_at,
       stores.plan_expires_at,
       stores.plan_duration_days,
       stores.plan_total_price,
       plans.currency_code as plan_currency_code,
       stores.internal_notes,
       0::int as product_count,
       null::timestamptz as last_activity_at,
       coalesce(users.deleted_at, stores.deleted_at) as deleted_at,
       coalesce(users.deleted_by_user_id, stores.deleted_by_user_id, '') as deleted_by_user_id,
       plans.code as plan_code,
       plans.name as plan_name
     from catalog_users users
     left join catalog_stores stores on stores.owner_user_id = users.id
     left join catalog_plan_definitions plans on plans.id = stores.plan_id
     where ${whereSql}
     order by coalesce(users.deleted_at, stores.deleted_at) desc, users.id desc
     limit ${limitPlaceholder}`,
    listValues,
  );

  const countValues = [];
  const countConditions = [
    buildMerchantExclusionSql(countValues, allowlistedEmails),
    "coalesce(users.deleted_at, stores.deleted_at) is not null",
  ];
  const countSearchFilter = appendClientSearchFilter(countValues, options.search);
  if (countSearchFilter) {
    countConditions.push(countSearchFilter.replace(/^and\s+/i, ""));
  }

  const countResult = await pool.query(
    `select count(*)::int as total
     from catalog_users users
     left join catalog_stores stores on stores.owner_user_id = users.id
     left join catalog_plan_definitions plans on plans.id = stores.plan_id
     where ${countConditions.join("\n       and ")}`,
    countValues,
  );

  return buildPageInfo(
    listResult.rows,
    limit,
    countResult.rows[0]?.total || 0,
    buildTrashedClientCursor,
  );
}

async function fetchFinancialEventsPage(pool, options = {}) {
  const limit = parsePositiveInt(
    options.limit,
    DEFAULT_FINANCIAL_EVENTS_PAGE_SIZE,
    MAX_FINANCIAL_EVENTS_PAGE_SIZE,
  );
  const listValues = [];
  const conditions = [];

  const cursorFilter = appendFinancialEventsCursorFilter(listValues, options.cursor);
  if (cursorFilter) {
    conditions.push(cursorFilter.replace(/^and\s+/i, ""));
  }

  const limitPlaceholder = addParam(listValues, limit + 1);
  const whereSql = conditions.length ? `where ${conditions.join("\n       and ")}` : "";

  const listResult = await pool.query(
    `select
       events.id,
       events.store_id,
       events.user_id,
       events.recorded_by_user_id,
       events.plan_id,
       events.event_type,
       events.plan_code,
       events.plan_name,
       events.store_name,
       events.merchant_email,
       events.reference_id,
       events.plan_status,
       events.duration_days,
       events.total_price,
       events.currency_code,
       events.plan_started_at,
       events.plan_expires_at,
       events.recorded_at,
       coalesce(events.plan_started_at, events.recorded_at) as sort_at
     from catalog_plan_activation_events events
     ${whereSql}
     order by coalesce(events.plan_started_at, events.recorded_at) desc, events.id desc
     limit ${limitPlaceholder}`,
    listValues,
  );

  const countResult = await pool.query(
    `select count(*)::int as total
     from catalog_plan_activation_events`,
  );

  return buildPageInfo(
    listResult.rows,
    limit,
    countResult.rows[0]?.total || 0,
    buildFinancialEventCursor,
  );
}

async function fetchRecentClients(pool, allowlistedEmails) {
  const values = [];
  const conditions = [
    buildMerchantExclusionSql(values, allowlistedEmails),
    "coalesce(users.deleted_at, stores.deleted_at) is null",
  ];

  const result = await pool.query(
    `select
       users.id as user_id,
       users.email,
       users.full_name,
       users.role,
       users.account_status,
       users.created_at,
       stores.id as store_id,
       stores.name as store_name,
       stores.reference_id,
       stores.public_enabled,
       stores.plan_id,
       stores.plan_status,
       stores.plan_started_at,
       stores.plan_expires_at,
       stores.plan_duration_days,
       stores.plan_total_price,
       plans.currency_code as plan_currency_code,
       stores.internal_notes,
       0::int as product_count,
       null::timestamptz as last_activity_at,
       null::timestamptz as deleted_at,
       ''::text as deleted_by_user_id,
       plans.code as plan_code,
       plans.name as plan_name
     from catalog_users users
     left join catalog_stores stores on stores.owner_user_id = users.id
     left join catalog_plan_definitions plans on plans.id = stores.plan_id
     where ${conditions.join("\n       and ")}
     order by users.created_at desc, users.id desc
     limit 3`,
    values,
  );

  return result.rows.map(toClientPayload);
}

async function fetchUrgentClients(pool, allowlistedEmails) {
  const values = [];
  const conditions = [
    buildMerchantExclusionSql(values, allowlistedEmails),
    "coalesce(users.deleted_at, stores.deleted_at) is null",
    "stores.plan_status in ('active', 'trial')",
    "stores.plan_expires_at is not null",
    "stores.plan_expires_at::date >= current_date",
    "stores.plan_expires_at::date <= current_date + 3",
  ];

  const [countResult, listResult] = await Promise.all([
    pool.query(
      `select count(*)::int as total
       from catalog_users users
       left join catalog_stores stores on stores.owner_user_id = users.id
       where ${conditions.join("\n         and ")}`,
      values,
    ),
    pool.query(
      `select
         users.id as user_id,
         users.email,
         users.full_name,
         users.role,
         users.account_status,
         users.created_at,
         stores.id as store_id,
         stores.name as store_name,
         stores.reference_id,
         stores.public_enabled,
         stores.plan_id,
         stores.plan_status,
         stores.plan_started_at,
         stores.plan_expires_at,
         stores.plan_duration_days,
         stores.plan_total_price,
         plans.currency_code as plan_currency_code,
         stores.internal_notes,
         0::int as product_count,
         null::timestamptz as last_activity_at,
         null::timestamptz as deleted_at,
         ''::text as deleted_by_user_id,
         plans.code as plan_code,
         plans.name as plan_name
       from catalog_users users
       left join catalog_stores stores on stores.owner_user_id = users.id
       left join catalog_plan_definitions plans on plans.id = stores.plan_id
       where ${conditions.join("\n         and ")}
       order by stores.plan_expires_at asc, users.id desc
       limit 6`,
      values,
    ),
  ]);

  return {
    total: Number(countResult.rows[0]?.total || 0),
    items: listResult.rows.map(toClientPayload),
  };
}

async function fetchPendingAccessRequests(pool, allowlistedEmails, options = {}) {
  const limit = parsePositiveInt(
    options.limit,
    PENDING_ACCESS_REQUESTS_PREVIEW_LIMIT,
    PENDING_ACCESS_REQUESTS_PREVIEW_LIMIT,
  );
  const values = [];
  const conditions = [
    buildMerchantExclusionSql(values, allowlistedEmails),
    "coalesce(users.deleted_at, stores.deleted_at) is null",
    "stores.id is null",
  ];
  const limitPlaceholder = addParam(values, limit);

  const [countResult, listResult] = await Promise.all([
    pool.query(
      `select count(*)::int as total
       from catalog_users users
       left join catalog_stores stores on stores.owner_user_id = users.id
       where ${conditions.join("\n         and ")}`,
      values.slice(0, values.length - 1),
    ),
    pool.query(
      `select
         users.id as user_id,
         users.email,
         users.full_name,
         users.role,
         users.account_status,
         users.created_at,
         stores.id as store_id,
         stores.name as store_name,
         stores.reference_id,
         stores.public_enabled,
         stores.plan_id,
         stores.plan_status,
         stores.plan_started_at,
         stores.plan_expires_at,
         stores.plan_duration_days,
         stores.plan_total_price,
         plans.currency_code as plan_currency_code,
         stores.internal_notes,
         0::int as product_count,
         null::timestamptz as last_activity_at,
         null::timestamptz as deleted_at,
         ''::text as deleted_by_user_id,
         plans.code as plan_code,
         plans.name as plan_name
       from catalog_users users
       left join catalog_stores stores on stores.owner_user_id = users.id
       left join catalog_plan_definitions plans on plans.id = stores.plan_id
       where ${conditions.join("\n         and ")}
       order by users.created_at desc, users.id desc
       limit ${limitPlaceholder}`,
      values,
    ),
  ]);

  return {
    total: Number(countResult.rows[0]?.total || 0),
    items: listResult.rows.map(toClientPayload),
  };
}

async function fetchSummary(pool, allowlistedEmails) {
  const values = [];
  const conditions = [buildMerchantExclusionSql(values, allowlistedEmails)];

  const result = await pool.query(
    `select
       count(*) filter (where coalesce(users.deleted_at, stores.deleted_at) is null)::int as total_clients,
       count(*) filter (
         where coalesce(users.deleted_at, stores.deleted_at) is null
           and coalesce(users.account_status, 'active') = 'active'
       )::int as active_clients,
       count(*) filter (
         where coalesce(users.deleted_at, stores.deleted_at) is null
           and coalesce(users.account_status, 'active') = 'suspended'
       )::int as suspended_clients,
       count(*) filter (
         where coalesce(users.deleted_at, stores.deleted_at) is null
           and coalesce(stores.public_enabled, false)
       )::int as public_stores,
       count(*) filter (
         where coalesce(users.deleted_at, stores.deleted_at) is null
           and stores.id is null
       )::int as pending_access_requests,
       count(*) filter (where coalesce(users.deleted_at, stores.deleted_at) is not null)::int as trashed_clients
     from catalog_users users
     left join catalog_stores stores on stores.owner_user_id = users.id
     where ${conditions.join("\n       and ")}`,
    values,
  );

  const row = result.rows[0] || {};
  return {
    totalClients: Number(row.total_clients || 0),
    activeClients: Number(row.active_clients || 0),
    suspendedClients: Number(row.suspended_clients || 0),
    publicStores: Number(row.public_stores || 0),
    pendingAccessRequests: Number(row.pending_access_requests || 0),
    trashedClients: Number(row.trashed_clients || 0),
  };
}

async function handle(event) {
  try {
    const session = await getSuperAdminSession(event);
    const superAdminAccess = getResolvedSuperAdminAccess(session);
    const scope = normalizeScope(event.queryStringParameters?.scope);
    const pool = getPool();
    const allowlistedEmails = getSuperAdminAllowlist();
    const hasSuperAdminAccessColumn = await hasColumn(pool, "catalog_users", "super_admin_access");
    const settingsHasCategory = await hasSettingsCategoryColumn(pool);
    const superAdminAccessSelectSql = hasSuperAdminAccessColumn
      ? "users.super_admin_access,"
      : "null::jsonb as super_admin_access,";
    const settingsQuery = settingsHasCategory
      ? `select key, value, category, description from catalog_settings order by category, key`
      : `select key, value, 'general' as category, description from catalog_settings order by key`;

    const search = String(event.queryStringParameters?.search || "").trim();
    const dateFrom = normalizeDateInput(event.queryStringParameters?.dateFrom);
    const dateTo = normalizeDateInput(event.queryStringParameters?.dateTo);
    const clientsLimit = parsePositiveInt(event.queryStringParameters?.clientsLimit, DEFAULT_CLIENTS_PAGE_SIZE);
    const trashedClientsLimit = parsePositiveInt(event.queryStringParameters?.trashedClientsLimit, DEFAULT_CLIENTS_PAGE_SIZE);
    const financialEventsLimit = parsePositiveInt(
      event.queryStringParameters?.financialEventsLimit,
      DEFAULT_FINANCIAL_EVENTS_PAGE_SIZE,
      MAX_FINANCIAL_EVENTS_PAGE_SIZE,
    );
    const clientsCursor = String(event.queryStringParameters?.clientsCursor || "").trim();
    const trashedClientsCursor = String(event.queryStringParameters?.trashedClientsCursor || "").trim();
    const financialEventsCursor = String(event.queryStringParameters?.financialEventsCursor || "").trim();

    if (scope === "clients") {
      const [visibleClientPage, pendingAccessData] = superAdminAccess.clientes
        ? await Promise.all([
          fetchActiveClientsPage(pool, allowlistedEmails, {
            search,
            dateFrom,
            dateTo,
            limit: clientsLimit,
            cursor: clientsCursor,
          }),
          fetchPendingAccessRequests(pool, allowlistedEmails),
        ])
        : [createEmptyClientPage(clientsLimit), { total: 0, items: [] }];

      return jsonResponse(200, {
        ok: true,
        clients: visibleClientPage.rows.map(toClientPayload),
        clientPageInfo: visibleClientPage.pageInfo,
        pendingAccessRequests: pendingAccessData.items,
        pendingAccessRequestCount: pendingAccessData.total,
      });
    }

    if (scope === "trashedclients") {
      const visibleTrashedPage = superAdminAccess.lixo
        ? await fetchTrashedClientsPage(pool, allowlistedEmails, {
          search,
          limit: trashedClientsLimit,
          cursor: trashedClientsCursor,
        })
        : createEmptyClientPage(trashedClientsLimit);

      return jsonResponse(200, {
        ok: true,
        trashedClients: visibleTrashedPage.rows.map(toClientPayload),
        trashedClientPageInfo: visibleTrashedPage.pageInfo,
      });
    }

    if (scope === "financialevents") {
      const visibleFinancialEventsPage = superAdminAccess.financeiro
        ? await fetchFinancialEventsPage(pool, {
          limit: financialEventsLimit,
          cursor: financialEventsCursor,
        })
        : createEmptyFinancialEventsPage(financialEventsLimit);

      return jsonResponse(200, {
        ok: true,
        financialEvents: visibleFinancialEventsPage.rows.map(toFinancialEventPayload),
        financialEventPageInfo: visibleFinancialEventsPage.pageInfo,
      });
    }

    const [
      plansResult,
      summary,
      activeClientPage,
      trashedClientPage,
      recentClients,
      urgentClientsData,
      pendingAccessData,
      settingsResult,
      financialEventsPage,
      planActivationRequestsResult,
      adminUsersResult,
    ] = await Promise.all([
      pool.query(
        `select
           plans.id,
           plans.code,
           plans.name,
           plans.description,
           plans.price_monthly,
           plans.currency_code,
           plans.max_products,
           plans.max_team_members,
           plans.active,
           plans.sort_order,
           count(stores.id) filter (where stores.deleted_at is null)::int as store_count
         from catalog_plan_definitions plans
         left join catalog_stores stores on stores.plan_id = plans.id
         group by
           plans.id,
           plans.code,
           plans.name,
           plans.description,
           plans.price_monthly,
           plans.currency_code,
           plans.max_products,
           plans.max_team_members,
           plans.active,
           plans.sort_order
         order by plans.sort_order asc, plans.name asc`,
      ),
      fetchSummary(pool, allowlistedEmails),
      superAdminAccess.clientes
        ? fetchActiveClientsPage(pool, allowlistedEmails, {
          search,
          dateFrom,
          dateTo,
          limit: clientsLimit,
          cursor: clientsCursor,
        })
        : Promise.resolve(createEmptyClientPage(clientsLimit)),
      superAdminAccess.lixo
        ? fetchTrashedClientsPage(pool, allowlistedEmails, {
          search,
          limit: trashedClientsLimit,
          cursor: trashedClientsCursor,
        })
        : Promise.resolve(createEmptyClientPage(trashedClientsLimit)),
      superAdminAccess.clientes
        ? fetchRecentClients(pool, allowlistedEmails)
        : Promise.resolve([]),
      superAdminAccess.clientes
        ? fetchUrgentClients(pool, allowlistedEmails)
        : Promise.resolve({ total: 0, items: [] }),
      superAdminAccess.clientes
        ? fetchPendingAccessRequests(pool, allowlistedEmails)
        : Promise.resolve({ total: 0, items: [] }),
      pool.query(settingsQuery),
      superAdminAccess.financeiro
        ? fetchFinancialEventsPage(pool, {
          limit: financialEventsLimit,
          cursor: financialEventsCursor,
        })
        : Promise.resolve(createEmptyFinancialEventsPage(financialEventsLimit)),
      pool.query(
        `select
           requests.id,
           requests.store_id,
           requests.user_id,
           requests.plan_id,
           requests.plan_code,
           requests.plan_name,
           requests.store_name,
           requests.merchant_email,
           requests.reference_id,
           requests.store_whatsapp,
           requests.product_count,
           requests.current_plan_status,
           requests.current_plan_name,
           requests.duration_days,
           requests.total_price,
           requests.currency_code,
           requests.message_text,
           requests.whatsapp_link,
           requests.payment_reference,
           requests.payment_method,
           requests.payment_instructions,
           requests.payment_bank_name,
           requests.payment_account_name,
           requests.payment_account_number,
           requests.payment_iban,
           requests.payment_proof_status,
           requests.merchant_note,
           requests.review_note,
           requests.paid_amount,
           requests.paid_currency_code,
           requests.paid_at,
           requests.payment_due_at,
           requests.last_proof_submitted_at,
           requests.status,
           requests.requested_at,
           requests.resolved_at,
           requests.resolved_by_user_id,
           requests.activated_at,
           requests.activated_by_user_id
         from catalog_plan_activation_requests requests
         where requests.status in ('pending_payment', 'proof_submitted', 'under_review', 'needs_correction')
         order by requests.requested_at desc, requests.id desc`,
      ),
      pool.query(
        `select
           users.id as user_id,
           users.email,
           users.full_name,
           users.avatar_url,
           ${superAdminAccessSelectSql}
           users.role,
           users.account_status,
           users.created_at,
           sessions.last_activity_at
         from catalog_users users
         left join lateral (
           select max(last_used_at) as last_activity_at
           from catalog_sessions
           where user_id = users.id
         ) sessions on true
         where users.deleted_at is null
           and (
             users.role = 'super_admin'
             ${allowlistedEmails.length ? `or lower(users.email) = any($1::text[])` : ""}
           )
         order by users.created_at desc, users.email asc`,
        allowlistedEmails.length ? [allowlistedEmails] : [],
      ),
    ]);

    const plans = plansResult.rows.map(toPlanPayload);
    const rawSettings = settingsResult.rows.reduce((accumulator, row) => {
      accumulator[row.key] = { value: row.value, category: row.category, description: row.description };
      return accumulator;
    }, {});
    const settings = buildSystemSettingsCatalog(rawSettings);
    const financialEvents = financialEventsPage.rows.map(toFinancialEventPayload);
    const planActivationRequests = await mapPlanRequestsWithProofs(pool, planActivationRequestsResult.rows);
    const adminUsers = adminUsersResult.rows.map(toAdminUserPayload);
    const visiblePlans = superAdminAccess.clientes || superAdminAccess.planos ? plans : [];
    const visibleSettings = superAdminAccess.configuracoes ? settings : {};
    const visibleFinancialEvents = superAdminAccess.financeiro ? financialEvents : [];
    const visibleFinancialEventPageInfo = superAdminAccess.financeiro
      ? financialEventsPage.pageInfo
      : createEmptyFinancialEventsPage(financialEventsLimit).pageInfo;
    const visiblePendingAccessRequests = superAdminAccess.clientes ? pendingAccessData.items : [];
    const visiblePlanActivationRequests = superAdminAccess.clientes ? planActivationRequests : [];
    const visibleAdminUsers = superAdminAccess.equipa ? adminUsers : [];
    const visibleActiveAdminUsers = visibleAdminUsers.filter((user) => user.accountStatus === "active");
    const visibleSuspendedAdminUsers = visibleAdminUsers.filter((user) => user.accountStatus !== "active");

    return jsonResponse(200, {
      ok: true,
      summary: {
        totalClients: superAdminAccess.clientes ? summary.totalClients : 0,
        activeClients: superAdminAccess.clientes ? summary.activeClients : 0,
        suspendedClients: superAdminAccess.clientes ? summary.suspendedClients : 0,
        publicStores: superAdminAccess.clientes ? summary.publicStores : 0,
        pendingAccessRequests: superAdminAccess.clientes ? summary.pendingAccessRequests : 0,
        activePlans: visiblePlans.filter((plan) => plan.active).length,
        trashedClients: superAdminAccess.lixo ? summary.trashedClients : 0,
        pendingPlanRequests: visiblePlanActivationRequests.length,
        totalAdminUsers: visibleAdminUsers.length,
        activeAdminUsers: visibleActiveAdminUsers.length,
        suspendedAdminUsers: visibleSuspendedAdminUsers.length,
      },
      clients: activeClientPage.rows.map(toClientPayload),
      clientPageInfo: activeClientPage.pageInfo,
      trashedClients: trashedClientPage.rows.map(toClientPayload),
      trashedClientPageInfo: trashedClientPage.pageInfo,
      recentClients,
      urgentClients: urgentClientsData.items,
      urgentClientsTotal: urgentClientsData.total,
      pendingAccessRequests: visiblePendingAccessRequests,
      adminUsers: visibleAdminUsers,
      plans: visiblePlans,
      settings: visibleSettings,
      financialEvents: visibleFinancialEvents,
      financialEventPageInfo: visibleFinancialEventPageInfo,
      planActivationRequests: visiblePlanActivationRequests,
      permissions: {
        access: superAdminAccess,
        canManageAdminUsers: canManageSuperAdminUsers(session),
      },
    });
  } catch (error) {
    return jsonResponse(error.status || 500, {
      error: error.message || "Nao foi possivel carregar o painel do super admin.",
    });
  }
}

export const handler = withCors(handle, { allowMethods: ["GET"] });
