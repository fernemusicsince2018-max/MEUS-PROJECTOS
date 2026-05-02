import { validateBusinessEmail } from "./_store-validation.js";

const PENDING_STORE_REGISTRATION_TABLE = "catalog_pending_store_registrations";
const REGISTRATION_APPROVAL_LINK_TTL_HOURS = 24;

async function ensurePendingStoreRegistrationSchema(queryable) {
  await queryable.query(
    `create table if not exists public.${PENDING_STORE_REGISTRATION_TABLE} (
       id text primary key,
       email varchar(255) not null,
       phone varchar(32) not null,
       full_name varchar(160) not null default '',
       store_name varchar(160) not null default '',
       password_hash text not null,
       code_hash text not null,
       requested_ip varchar(120),
       expires_at timestamptz not null,
       used_at timestamptz,
       created_at timestamptz not null default now()
     )`,
  );

  await queryable.query(
    `create index if not exists idx_catalog_pending_store_registrations_email
       on public.${PENDING_STORE_REGISTRATION_TABLE} (email, expires_at)`,
  );

  await queryable.query(
    `create index if not exists idx_catalog_pending_store_registrations_phone
       on public.${PENDING_STORE_REGISTRATION_TABLE} (phone, expires_at)`,
  );

  await queryable.query(
    `create index if not exists idx_catalog_pending_store_registrations_lookup
       on public.${PENDING_STORE_REGISTRATION_TABLE} (email, code_hash)`,
  );
}

function cleanText(value, maxLength = null) {
  const text = String(value ?? "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function buildAvailabilityState(state, message, available = false) {
  return {
    state,
    available,
    message,
  };
}

function buildStoreNameFromEmail(email) {
  const localPart = String(email || "").split("@")[0] || "";
  const compact = localPart.replace(/[._-]+/g, " ").trim();
  return cleanText(compact, 160);
}

function normalizeRegistrationStoreName(value, email = "") {
  const requestedName = cleanText(value, 160);
  if (requestedName) {
    return requestedName;
  }

  const fallbackName = buildStoreNameFromEmail(email);
  return fallbackName ? `Loja ${fallbackName}`.slice(0, 160) : "Nova loja";
}

function validateRegistrationPhone(value, fieldLabel = "Numero de telemovel") {
  const digits = digitsOnly(value);
  if (!digits) {
    return { error: `${fieldLabel} e obrigatorio.` };
  }

  if (digits.length < 10 || digits.length > 15) {
    return {
      error: `${fieldLabel} invalido. Indica o numero com codigo do pais. Ex: 244923000000.`,
    };
  }

  return { normalized: digits };
}

function buildEmailConflictMessage(conflict = null) {
  if (!conflict) {
    return "Email disponivel.";
  }

  if (conflict.source === "user" && conflict.deletedAt) {
    return "Ja existe uma empresa no lixo com este email.";
  }

  if (conflict.source === "pending") {
    return "Ja existe um pedido pendente para este email.";
  }

  if (conflict.source === "store") {
    return "Este email ja esta associado a outra empresa no sistema.";
  }

  return "Ja existe uma conta com este email.";
}

function buildPhoneConflictMessage(conflict = null) {
  if (!conflict) {
    return "Numero de telemovel disponivel.";
  }

  if (conflict.source === "pending") {
    return "Ja existe um pedido pendente para este numero de telemovel.";
  }

  return "Este numero de telemovel ja esta associado a outra loja.";
}

async function findExistingUserByEmail(queryable, email) {
  if (!email) return null;

  const result = await queryable.query(
    `select id, deleted_at
     from catalog_users
     where lower(email) = lower($1)
     limit 1`,
    [email],
  );

  return result.rows[0] || null;
}

async function findExistingStoreByBusinessEmail(queryable, email) {
  if (!email) return null;

  const result = await queryable.query(
    `select id
     from catalog_stores
     where deleted_at is null
       and lower(business_email) = lower($1)
     limit 1`,
    [email],
  );

  return result.rows[0] || null;
}

async function findPendingRegistrationByEmail(queryable, email, excludePendingId = "") {
  if (!email) return null;

  const result = await queryable.query(
    `select id
     from ${PENDING_STORE_REGISTRATION_TABLE}
     where lower(email) = lower($1)
       and used_at is null
       and expires_at > now()
       and ($2 = '' or id <> $2)
     order by created_at desc
     limit 1`,
    [email, excludePendingId],
  );

  return result.rows[0] || null;
}

async function findStoreByPhone(queryable, phone, excludeStoreId = "") {
  if (!phone) return null;

  const result = await queryable.query(
    `select
       id,
       case
         when business_phone = $1 then 'business_phone'
         when whatsapp = $1 then 'whatsapp'
         else 'phone'
       end as conflict_field
     from catalog_stores
     where deleted_at is null
       and ($2 = '' or id <> $2)
       and (business_phone = $1 or whatsapp = $1)
     limit 1`,
    [phone, excludeStoreId],
  );

  return result.rows[0] || null;
}

async function findPendingRegistrationByPhone(queryable, phone, excludePendingId = "") {
  if (!phone) return null;

  const result = await queryable.query(
    `select id
     from ${PENDING_STORE_REGISTRATION_TABLE}
     where phone = $1
       and used_at is null
       and expires_at > now()
       and ($2 = '' or id <> $2)
     order by created_at desc
     limit 1`,
    [phone, excludePendingId],
  );

  return result.rows[0] || null;
}

async function findRegistrationIdentityConflicts(
  queryable,
  { email = "", phone = "", excludePendingId = "", excludeStoreId = "" } = {},
) {
  const normalizedEmail = cleanText(email, 255).toLowerCase();
  const normalizedPhone = digitsOnly(phone);
  const conflicts = {
    email: null,
    phone: null,
  };

  if (normalizedEmail) {
    const existingUser = await findExistingUserByEmail(queryable, normalizedEmail);
    if (existingUser) {
      conflicts.email = {
        source: "user",
        id: existingUser.id,
        deletedAt: existingUser.deleted_at,
      };
      return conflicts;
    }

    const existingStore = await findExistingStoreByBusinessEmail(queryable, normalizedEmail);
    if (existingStore) {
      conflicts.email = {
        source: "store",
        id: existingStore.id,
      };
      return conflicts;
    }

    const pendingRegistration = await findPendingRegistrationByEmail(
      queryable,
      normalizedEmail,
      excludePendingId,
    );
    if (pendingRegistration) {
      conflicts.email = {
        source: "pending",
        id: pendingRegistration.id,
      };
      return conflicts;
    }
  }

  if (normalizedPhone) {
    const phoneStore = await findStoreByPhone(queryable, normalizedPhone, excludeStoreId);
    if (phoneStore) {
      conflicts.phone = {
        source: "store",
        id: phoneStore.id,
        field: phoneStore.conflict_field || "",
      };
      return conflicts;
    }

    const pendingRegistration = await findPendingRegistrationByPhone(
      queryable,
      normalizedPhone,
      excludePendingId,
    );
    if (pendingRegistration) {
      conflicts.phone = {
        source: "pending",
        id: pendingRegistration.id,
      };
      return conflicts;
    }
  }

  return conflicts;
}

function buildRegisterAvailability({ email = "", phone = "", emailError = "", phoneError = "", conflicts = {} }) {
  const response = {
    email: buildAvailabilityState("idle", "", false),
    phone: buildAvailabilityState("idle", "", false),
  };

  if (emailError) {
    response.email = buildAvailabilityState("invalid", emailError, false);
  } else if (email) {
    response.email = conflicts?.email
      ? buildAvailabilityState("taken", buildEmailConflictMessage(conflicts.email), false)
      : buildAvailabilityState("available", "Email disponivel.", true);
  }

  if (phoneError) {
    response.phone = buildAvailabilityState("invalid", phoneError, false);
  } else if (phone) {
    response.phone = conflicts?.phone
      ? buildAvailabilityState("taken", buildPhoneConflictMessage(conflicts.phone), false)
      : buildAvailabilityState("available", "Numero de telemovel disponivel.", true);
  }

  return response;
}

function validateRegistrationEmail(value, fieldLabel = "Email") {
  const result = validateBusinessEmail(cleanText(value, 255), fieldLabel);
  if (result.error) {
    return { error: result.error };
  }

  return { normalized: result.normalized };
}

export {
  PENDING_STORE_REGISTRATION_TABLE,
  REGISTRATION_APPROVAL_LINK_TTL_HOURS,
  buildEmailConflictMessage,
  buildPhoneConflictMessage,
  buildRegisterAvailability,
  ensurePendingStoreRegistrationSchema,
  findRegistrationIdentityConflicts,
  normalizeRegistrationStoreName,
  validateRegistrationEmail,
  validateRegistrationPhone,
};
