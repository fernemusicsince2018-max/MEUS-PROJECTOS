import { randomBytes, randomUUID, randomInt, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { ensureDatabaseReady, getPool, hasColumn } from "./_postgres.js";
import { getSystemSettings } from "./_settings.js";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "catalog_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const SUPER_ADMIN_ACCESS_KEYS = Object.freeze(["clientes", "equipa", "financeiro", "lixo", "planos", "configuracoes"]);
const SUPER_ADMIN_ACCESS_KEY_SET = new Set(SUPER_ADMIN_ACCESS_KEYS);
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

function normalizeUserRole(value) {
  return String(value || "").trim().toLowerCase() === "super_admin" ? "super_admin" : "merchant";
}

function normalizeAccountStatus(value) {
  return String(value || "").trim().toLowerCase() === "suspended" ? "suspended" : "active";
}

function isPlanDateExpired(value) {
  if (!value) return false;

  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) return false;

  const expiryDay = new Date(expiresAt.getFullYear(), expiresAt.getMonth(), expiresAt.getDate()).getTime();
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return expiryDay < todayDay;
}

function getPlanAccessState(planStatus, planExpiresAt) {
  const normalizedStatus = String(planStatus || "").trim().toLowerCase();
  const expired = isPlanDateExpired(planExpiresAt);

  if (normalizedStatus === "active") {
    if (!expired) {
      return { allowed: true, message: "" };
    }

    return {
      allowed: false,
      message: "O teu plano terminou. Ativa um plano para voltar a receber clientes e gerir produtos.",
    };
  }

  if (normalizedStatus === "trial") {
    if (!expired) {
      return { allowed: true, message: "" };
    }

    return {
      allowed: false,
      message: "O teu periodo de teste terminou. Ativa um plano para voltar a receber clientes e adicionar produtos.",
    };
  }

  if (normalizedStatus === "past_due") {
    return {
      allowed: false,
      message: "O teu plano esta em atraso. Regulariza ou ativa um plano para voltar a receber clientes e gerir produtos.",
    };
  }

  if (normalizedStatus === "canceled") {
    return {
      allowed: false,
      message: "O teu plano foi cancelado. Ativa um plano para voltar a receber clientes e gerir produtos.",
    };
  }

  return {
    allowed: false,
    message: "Ativa um plano para deixar a tua loja ativa ao cliente e voltar a gerir produtos.",
  };
}

function getSuperAdminAllowlist() {
  return String(process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isPrimarySuperAdminEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const allowlist = getSuperAdminAllowlist();
  if (!allowlist.length) {
    return false;
  }

  return allowlist.includes(normalizedEmail);
}

function canManageSuperAdminUsers(sessionLike) {
  const allowlist = getSuperAdminAllowlist();
  if (!allowlist.length) {
    return true;
  }

  return allowlist.includes(String(sessionLike?.email || "").trim().toLowerCase());
}

function getEmptySuperAdminAccess() {
  return SUPER_ADMIN_ACCESS_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
}

function getDefaultSuperAdminAccess() {
  return { ...DEFAULT_SUPER_ADMIN_ACCESS };
}

function getFullSuperAdminAccess() {
  return { ...FULL_SUPER_ADMIN_ACCESS };
}

function normalizeSuperAdminAccess(value, options = {}) {
  if (options.forceFullAccess) {
    return getFullSuperAdminAccess();
  }

  let rawValue = value;
  if (typeof rawValue === "string") {
    try {
      rawValue = JSON.parse(rawValue);
    } catch (error) {
      rawValue = null;
    }
  }

  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    rawValue = {};
  }

  const next = getDefaultSuperAdminAccess();
  for (const key of SUPER_ADMIN_ACCESS_KEYS) {
    if (key === "clientes") {
      next[key] = true;
      continue;
    }

    next[key] = Boolean(rawValue[key]);
  }

  return next;
}

function getEffectiveUserRole(row) {
  const normalizedRole = normalizeUserRole(row?.role);
  const normalizedEmail = String(row?.email || "").trim().toLowerCase();
  if (normalizedRole === "super_admin" || getSuperAdminAllowlist().includes(normalizedEmail)) {
    return "super_admin";
  }

  return "merchant";
}

function getResolvedSuperAdminAccess(row) {
  if (getEffectiveUserRole(row) !== "super_admin") {
    return getEmptySuperAdminAccess();
  }

  if (isPrimarySuperAdminEmail(row?.email)) {
    return getFullSuperAdminAccess();
  }

  return normalizeSuperAdminAccess(row?.superAdminAccess ?? row?.super_admin_access);
}

function hasSuperAdminAccess(sessionLike, accessKey) {
  const normalizedKey = String(accessKey || "").trim().toLowerCase();
  if (!SUPER_ADMIN_ACCESS_KEY_SET.has(normalizedKey)) {
    return false;
  }

  return Boolean(getResolvedSuperAdminAccess(sessionLike)[normalizedKey]);
}

function requireSuperAdminAccess(sessionLike, accessKey, message) {
  if (hasSuperAdminAccess(sessionLike, accessKey)) {
    return;
  }

  const error = new Error(message || "Nao tens permissao para abrir esta area do super admin.");
  error.status = 403;
  throw error;
}

function parseCookies(event) {
  const raw = event.headers?.cookie || event.headers?.Cookie || "";

  return raw.split(";").reduce((cookies, entry) => {
    const [key, ...parts] = entry.trim().split("=");
    if (!key) return cookies;
    cookies[key] = decodeURIComponent(parts.join("="));
    return cookies;
  }, {});
}

function getSessionCookieSameSite() {
  const normalized = String(process.env.SESSION_COOKIE_SAME_SITE || "Lax").trim().toLowerCase();
  if (normalized === "none") return "None";
  if (normalized === "strict") return "Strict";
  return "Lax";
}

function shouldUseSecureSessionCookie() {
  const normalized = String(process.env.SESSION_COOKIE_SECURE || "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return process.env.NODE_ENV === "production" || getSessionCookieSameSite() === "None";
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function buildSessionCookie(token, maxAge = SESSION_MAX_AGE_SECONDS) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${getSessionCookieSameSite()}`,
    `Max-Age=${maxAge}`,
  ];

  if (shouldUseSecureSessionCookie()) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function buildExpiredSessionCookie() {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    `SameSite=${getSessionCookieSameSite()}`,
    "Max-Age=0",
  ];

  if (shouldUseSecureSessionCookie()) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, originalKey] = String(storedHash || "").split(":");
  if (!salt || !originalKey) return false;

  const derivedKey = await scrypt(password, salt, 64);
  const originalBuffer = Buffer.from(originalKey, "hex");

  if (originalBuffer.length !== derivedKey.length) return false;
  return timingSafeEqual(originalBuffer, derivedKey);
}

async function createSession(connection, userId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const sessionId = randomUUID();

  await connection.query(
    `insert into catalog_sessions (id, user_id, token_hash, expires_at)
     values ($1, $2, $3, now() + ($4 * interval '1 second'))`,
    [sessionId, userId, tokenHash, SESSION_MAX_AGE_SECONDS],
  );

  return {
    token,
    cookie: buildSessionCookie(token),
  };
}

function generateReferenceId() {
  return randomInt(100000, 999999).toString();
}

async function ensureStoreForUser(connection, userId, preferredName = "") {
  const existing = await connection.query(
    `select id, name, deleted_at
     from catalog_stores
     where owner_user_id = $1
     limit 1`,
    [userId],
  );

  if (existing.rows.length) {
    const store = existing.rows[0];
    if (store.deleted_at) {
      const error = new Error("A empresa desta conta esta no lixo e precisa de ser recuperada no super admin.");
      error.status = 403;
      throw error;
    }

    return store;
  }

  const storeId = randomUUID();
  const { trialDays, trialEnabled } = await getSystemSettings(connection);
  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(now.getDate() + trialDays);
  const initialPlanStatus = trialEnabled ? "trial" : "canceled";
  const initialPlanStartedAt = trialEnabled ? now.toISOString() : null;
  const initialPlanExpiresAt = trialEnabled ? expiresAt.toISOString() : null;
  const initialPlanDurationDays = trialEnabled ? trialDays : null;

  // Tenta inserir até 5 vezes caso ocorra uma colisão de reference_id
  for (let i = 0; i < 5; i++) {
    const referenceId = generateReferenceId();
    try {
      const created = await connection.query(
        `insert into catalog_stores (
           id, owner_user_id, name, color, 
           plan_id, plan_status, plan_started_at, plan_expires_at, plan_duration_days, plan_total_price,
           reference_id
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         returning id, name`,
        [
          storeId, userId, preferredName || "", "#16a34a", 
          null, initialPlanStatus,
          initialPlanStartedAt, initialPlanExpiresAt,
          initialPlanDurationDays, 0,
          referenceId
        ],
      );
      return created.rows[0];
    } catch (error) {
      // Erro 23505 é Unique Violation no PostgreSQL
      if (error.code === "23505") {
        continue; 
      }
      throw error;
    }
  }

  throw new Error("Não foi possível gerar um identificador único para a loja. Tente novamente.");
}

async function getSessionContext(event) {
  const token = parseCookies(event)[SESSION_COOKIE];
  if (!token) return null;

  await ensureDatabaseReady();
  const pool = getPool();
  const tokenHash = hashSessionToken(token);
  const hasSuperAdminAccessColumn = await hasColumn(pool, "catalog_users", "super_admin_access");
  const superAdminAccessSelectSql = hasSuperAdminAccessColumn
    ? "users.super_admin_access,"
    : "null::jsonb as super_admin_access,";
  const result = await pool.query(
     `select
        sessions.id as session_id,
        sessions.user_id,
        users.email,
        users.full_name,
        users.avatar_url,
        users.role,
        ${superAdminAccessSelectSql}
        users.account_status,
        users.deleted_at as user_deleted_at,
        stores.id as store_id,
        stores.name as store_name,
       stores.deleted_at as store_deleted_at,
       stores.plan_status,
       stores.plan_expires_at,
       stores.reference_id
      from catalog_sessions sessions
     join catalog_users users on users.id = sessions.user_id
     left join catalog_stores stores on stores.owner_user_id = users.id
     where sessions.token_hash = $1
       and sessions.expires_at > now()
     limit 1`,
    [tokenHash],
  );

  const session = result.rows[0];
  if (!session) return null;

  if (session.user_deleted_at || session.store_deleted_at) {
    await pool.query(
      `delete from catalog_sessions
       where id = $1`,
      [session.session_id],
    );
    return null;
  }

  const accountStatus = normalizeAccountStatus(session.account_status);
  if (accountStatus !== "active") {
    await pool.query(
      `delete from catalog_sessions
       where id = $1`,
      [session.session_id],
    );
    return null;
  }

  await pool.query(
    `update catalog_sessions
     set last_used_at = now()
     where id = $1`,
    [session.session_id],
  );

  return {
    sessionId: session.session_id,
    userId: session.user_id,
    email: session.email,
    fullName: session.full_name || "",
    avatarUrl: session.avatar_url || "",
    role: getEffectiveUserRole(session),
    superAdminAccess: getResolvedSuperAdminAccess(session),
    accountStatus,
    storeId: session.store_id || "",
    storeName: session.store_name || "",
    planStatus: session.plan_status,
    planExpiresAt: session.plan_expires_at,
    referenceId: session.reference_id || "",
    tokenHash,
  };
}

async function deleteSessionByEvent(event) {
  const token = parseCookies(event)[SESSION_COOKIE];
  if (!token) return;

  await ensureDatabaseReady();
  const pool = getPool();
  await pool.query(
    `delete from catalog_sessions
     where token_hash = $1`,
    [hashSessionToken(token)],
  );
}

async function deleteSessionsByUser(queryable, userId) {
  await ensureDatabaseReady();
  await queryable.query(
    `delete from catalog_sessions
     where user_id = $1`,
    [userId],
  );
}

function sanitizeUser(row) {
  const role = getEffectiveUserRole(row);
  return {
    id: row.userId,
    email: row.email,
    fullName: row.fullName || "",
    avatarUrl: row.avatarUrl || row.avatar_url || "",
    role,
    ...(role === "super_admin" ? { superAdminAccess: getResolvedSuperAdminAccess(row) } : {}),
    accountStatus: normalizeAccountStatus(row.accountStatus),
  };
}

function sessionPayload(context) {
  return {
    authenticated: true,
    user: sanitizeUser(context),
    storeId: context.storeId || "",
    storeName: context.storeName || "",
    // O Super Admin é soberano: status sempre ativo e sem expiração, independentemente da DB
    planStatus: context.role === "super_admin" ? "active" : (context.planStatus || "trial"),
    planExpiresAt: context.role === "super_admin" ? null : context.planExpiresAt,
    referenceId: context.referenceId || "",
  };
}

async function getSuperAdminSession(event) {
  const session = await getSessionContext(event);
  if (!session) {
    const error = new Error("Precisas de iniciar sessao para aceder ao super admin.");
    error.status = 401;
    throw error;
  }

  if (session.role !== "super_admin") {
    const error = new Error("Nao tens permissao para gerir clientes e planos.");
    error.status = 403;
    throw error;
  }

  return session;
}

export {
  SESSION_COOKIE,
  buildExpiredSessionCookie,
  createSession,
  deleteSessionByEvent,
  deleteSessionsByUser,
  ensureStoreForUser,
  canManageSuperAdminUsers,
  DEFAULT_SUPER_ADMIN_ACCESS,
  FULL_SUPER_ADMIN_ACCESS,
  getEffectiveUserRole,
  getPlanAccessState,
  getResolvedSuperAdminAccess,
  getSessionContext,
  getSuperAdminAllowlist,
  getSuperAdminSession,
  hasSuperAdminAccess,
  hashPassword,
  isPrimarySuperAdminEmail,
  normalizeSuperAdminAccess,
  normalizeAccountStatus,
  normalizeUserRole,
  requireSuperAdminAccess,
  sessionPayload,
  verifyPassword,
};
