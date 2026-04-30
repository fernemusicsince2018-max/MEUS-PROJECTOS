import { randomUUID } from "node:crypto";
import { ensureStoreForUser, getEffectiveUserRole, getSuperAdminSession, normalizeAccountStatus, requireSuperAdminAccess, sessionPayload } from "./_auth.js";
import { invalidatePublicCatalogCache } from "./_catalog-cache.js";
import { getPool, jsonResponse, withCors } from "./_postgres.js";
import { isEmailDeliveryConfigured, sendPlanActivationEmail } from "./_email.js";
import { getCatalogIdentityConflictMessage } from "./_identity-errors.js";
import { normalizeEmail } from "./_security.js";
import { sendPlanActivationWhatsAppNotification } from "./_whatsapp.js";

const PLAN_STATUS_VALUES = new Set(["trial", "active", "past_due", "canceled"]);
const PLAN_DURATION_MIN_DAYS = 30;
const PLAN_DURATION_STEP_DAYS = 30;
const PROFILE_PHOTO_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i;
const PROFILE_PHOTO_MAX_LENGTH = 400000;
const PROFILE_PHOTO_URL_MAX_LENGTH = 2048;

function normalizePlanStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return PLAN_STATUS_VALUES.has(normalized) ? normalized : "trial";
}

function normalizeProfilePhoto(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    let parsed;

    try {
      parsed = new URL(raw);
    } catch (error) {
      parsed = null;
    }

    if (!parsed || !["http:", "https:"].includes(parsed.protocol)) {
      const failure = new Error("A foto do perfil deve usar um link valido (http ou https).");
      failure.status = 400;
      throw failure;
    }

    if (raw.length > PROFILE_PHOTO_URL_MAX_LENGTH) {
      const failure = new Error("O link da foto do perfil e demasiado longo.");
      failure.status = 400;
      throw failure;
    }

    return raw;
  }

  if (PROFILE_PHOTO_DATA_URL_PATTERN.test(raw)) {
    if (raw.length > PROFILE_PHOTO_MAX_LENGTH) {
      const failure = new Error("A foto do perfil ficou grande demais. Usa uma imagem menor.");
      failure.status = 400;
      throw failure;
    }

    return raw;
  }

  const failure = new Error("A foto do perfil deve ser um link publico ou uma imagem carregada pelo browser.");
  failure.status = 400;
  throw failure;
}

function parseDateOrNull(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00.000Z`) : new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error("Indica uma data valida para o plano.");
    error.status = 400;
    throw error;
  }

  return parsed.toISOString();
}

function parsePlanDurationDays(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || (parsed !== 7 && (parsed < PLAN_DURATION_MIN_DAYS || parsed % PLAN_DURATION_STEP_DAYS !== 0))) {
    const error = new Error("A duracao do plano deve ser em blocos de 30 dias.");
    error.status = 400;
    throw error;
  }

  return parsed;
}

function addDaysToIsoDate(isoDate, days) {
  if (!isoDate || !days) return null;

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString();
}

function sameIsoInstant(left, right) {
  return String(left || "") === String(right || "");
}

function shouldSendPlanActivationNotification(previousPlan, nextPlan) {
  if (nextPlan.planStatus !== "active" || !nextPlan.planId) {
    return false;
  }

  return (
    previousPlan.planStatus !== "active"
    || previousPlan.planId !== nextPlan.planId
    || !sameIsoInstant(previousPlan.planStartedAt, nextPlan.planStartedAt)
    || !sameIsoInstant(previousPlan.planExpiresAt, nextPlan.planExpiresAt)
    || Number(previousPlan.planDurationDays || 0) !== Number(nextPlan.planDurationDays || 0)
    || Number(previousPlan.planTotalPrice || 0) !== Number(nextPlan.planTotalPrice || 0)
  );
}

function buildPlanActivationNotificationSummary(report) {
  if (!report?.attempted) return "";

  const deliveredChannels = [];
  if (report.email?.sent) deliveredChannels.push("email");
  if (report.whatsapp?.delivered) deliveredChannels.push("WhatsApp");

  const failures = [];
  if (report.email?.attempted && !report.email?.sent && report.email?.error) {
    failures.push(`Email: ${report.email.error}`);
  }
  if ((report.whatsapp?.attempted || report.whatsapp?.error) && !report.whatsapp?.delivered && report.whatsapp?.error) {
    failures.push(`WhatsApp: ${report.whatsapp.error}`);
  }

  if (deliveredChannels.length > 0 && failures.length === 0) {
    return `Notificacao de ativacao enviada por ${deliveredChannels.join(" e ")}.`;
  }

  if (deliveredChannels.length > 0) {
    return `Notificacao de ativacao enviada por ${deliveredChannels.join(" e ")}. ${failures.join(" ")}`.trim();
  }

  if (failures.length > 0) {
    return `Plano ativado, mas a notificacao nao foi entregue. ${failures.join(" ")}`.trim();
  }

  return "Plano ativado, mas nenhum canal de notificacao esta configurado.";
}

function getPlanActivationEventType(previousPlan, nextPlan) {
  if (previousPlan.planStatus !== "active") {
    return "activation";
  }

  if (previousPlan.planId && previousPlan.planId !== nextPlan.planId) {
    return "plan_change";
  }

  return "renewal";
}

async function insertPlanActivationEvent(connection, payload) {
  await connection.query(
    `insert into catalog_plan_activation_events (
       id,
       store_id,
       user_id,
       recorded_by_user_id,
       plan_id,
       event_type,
       plan_code,
       plan_name,
       store_name,
       merchant_email,
       reference_id,
       plan_status,
       duration_days,
       total_price,
       currency_code,
       plan_started_at,
       plan_expires_at,
       recorded_at
     ) values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
     )
     on conflict on constraint catalog_plan_activation_events_period_unique do nothing`,
    [
      randomUUID(),
      payload.storeId,
      payload.userId,
      payload.recordedByUserId || null,
      payload.planId,
      payload.eventType,
      payload.planCode,
      payload.planName,
      payload.storeName,
      payload.merchantEmail,
      payload.referenceId,
      payload.planStatus,
      payload.durationDays,
      payload.totalPrice,
      payload.currencyCode,
      payload.planStartedAt,
      payload.planExpiresAt,
      payload.recordedAt || payload.planStartedAt || new Date().toISOString(),
    ],
  );
}

async function resolvePendingPlanActivationRequests(connection, storeId, resolvedByUserId) {
  if (!storeId) return;

  await connection.query(
    `update catalog_plan_activation_requests
        set status = 'activated',
            payment_proof_status = 'accepted',
            resolved_at = now(),
            resolved_by_user_id = $2,
            activated_at = coalesce(activated_at, now()),
            activated_by_user_id = $2
      where store_id = $1
        and status in ('pending_payment', 'proof_submitted', 'under_review', 'needs_correction')`,
    [storeId, resolvedByUserId || null],
  );
}

async function handle(event) {
  try {
    const session = await getSuperAdminSession(event);
    requireSuperAdminAccess(session, "clientes", "Nao tens permissao para gerir clientes.");
    const payload = JSON.parse(event.body || "{}");
    const userId = String(payload.userId || "").trim();
    const fullName = String(payload.fullName || "").trim().slice(0, 160);
    const email = normalizeEmail(payload.email);
    const avatarUrl = normalizeProfilePhoto(payload.avatarUrl);

    if (!userId) {
      return jsonResponse(400, { error: "O cliente a atualizar e obrigatorio." });
    }

    const accountStatus = normalizeAccountStatus(payload.accountStatus);
    const planStatus = normalizePlanStatus(payload.planStatus);
    const planId = String(payload.planId || "").trim();
    const referenceId = String(payload.referenceId || "").trim().slice(0, 20);
    const internalNotes = String(payload.internalNotes || "").trim().slice(0, 4000);
    const publicEnabled = Boolean(payload.publicEnabled);
    const incomingPlanStartedAt = parseDateOrNull(payload.planStartedAt);
    const planDurationDays = parsePlanDurationDays(payload.planDurationDays);

    const pool = getPool();
    const connection = await pool.connect();
    let transactionStarted = false;

    try {
      await connection.query("begin");
      transactionStarted = true;

      const userResult = await connection.query(
        `select
           users.id,
           users.email,
           users.full_name,
           users.role,
           users.deleted_at as user_deleted_at,
           stores.id as store_id,
           stores.name as store_name,
           stores.whatsapp as store_whatsapp,
           stores.reference_id as store_reference_id,
           stores.plan_id as store_plan_id,
           stores.plan_status as store_plan_status,
           stores.plan_started_at as store_plan_started_at,
           stores.plan_expires_at as store_plan_expires_at,
           stores.plan_duration_days as store_plan_duration_days,
           stores.plan_total_price as store_plan_total_price,
           stores.deleted_at as store_deleted_at
          from catalog_users users
         left join catalog_stores stores on stores.owner_user_id = users.id
         where users.id = $1
         limit 1`,
        [userId],
      );

      const user = userResult.rows[0];
      if (!user) {
        await connection.query("rollback");
        return jsonResponse(404, { error: "Cliente nao encontrado." });
      }

      if (user.user_deleted_at || user.store_deleted_at) {
        await connection.query("rollback");
        return jsonResponse(400, { error: "Esta empresa esta no lixo. Recupera-a primeiro antes de alterar os dados." });
      }

      if (getEffectiveUserRole(user) === "super_admin") {
        if (session.userId !== userId) {
          await connection.query("rollback");
          return jsonResponse(400, { error: "Contas de super admin so podem editar o proprio perfil." });
        }

        if (!email || !email.includes("@")) {
          await connection.query("rollback");
          return jsonResponse(400, { error: "Indica um email valido." });
        }

        const duplicateEmail = await connection.query(
          `select id
           from catalog_users
           where lower(email) = $1
             and id <> $2
           limit 1`,
          [email, userId],
        );

        if (duplicateEmail.rows.length) {
          await connection.query("rollback");
          return jsonResponse(409, { error: "Ja existe uma conta com este email." });
        }

        const updatedUserResult = await connection.query(
          `update catalog_users
           set email = $2,
               full_name = $3,
               avatar_url = $4,
               role = 'super_admin',
               updated_at = now()
           where id = $1
           returning id, email, full_name, avatar_url, role, account_status`,
          [userId, email, fullName, avatarUrl],
        );

        await connection.query("commit");
        transactionStarted = false;

        const updatedUser = updatedUserResult.rows[0];
        return jsonResponse(200, {
          ok: true,
          session: sessionPayload({
            ...session,
            userId: updatedUser.id,
            email: updatedUser.email,
            fullName: updatedUser.full_name || "",
            avatarUrl: updatedUser.avatar_url || "",
            role: getEffectiveUserRole(updatedUser),
            accountStatus: normalizeAccountStatus(updatedUser.account_status),
          }),
        });
      }

      if (session.userId === userId && accountStatus !== "active") {
        await connection.query("rollback");
        return jsonResponse(400, { error: "Nao podes suspender a tua propria conta." });
      }

      if (planId) {
        const planResult = await connection.query(
          `select id, code, name, price_monthly, currency_code
           from catalog_plan_definitions
           where id = $1
           limit 1`,
          [planId],
        );

        const plan = planResult.rows[0];
        if (!plan) {
          await connection.query("rollback");
          return jsonResponse(400, { error: "O plano selecionado nao existe." });
        }

        const planStartedAt = incomingPlanStartedAt || new Date().toISOString();
        const effectiveDurationDays = planDurationDays || PLAN_DURATION_MIN_DAYS;
        const planExpiresAt = addDaysToIsoDate(planStartedAt, effectiveDurationDays);
        const planTotalPrice = Number(plan.price_monthly || 0) * (effectiveDurationDays / PLAN_DURATION_STEP_DAYS);
        const previousPlanState = {
          planId: user.store_plan_id || "",
          planStatus: user.store_plan_status || "",
          planStartedAt: user.store_plan_started_at || null,
          planExpiresAt: user.store_plan_expires_at || null,
          planDurationDays: user.store_plan_duration_days == null ? null : Number(user.store_plan_duration_days),
          planTotalPrice: user.store_plan_total_price == null ? null : Number(user.store_plan_total_price),
        };
        const nextPlanState = {
          planId,
          planStatus,
          planStartedAt,
          planExpiresAt,
          planDurationDays: effectiveDurationDays,
          planTotalPrice,
        };

        await connection.query(
          `update catalog_users
           set account_status = $2
           where id = $1`,
          [userId, accountStatus],
        );

        const store = user.store_id
          ? {
              id: user.store_id,
              name: user.store_name || user.full_name || user.email || "",
              whatsapp: user.store_whatsapp || "",
            }
          : await ensureStoreForUser(connection, userId, user.full_name || user.email || "");

        await connection.query(
          `update catalog_stores
           set plan_id = $2,
               plan_status = $3,
               plan_started_at = $4,
               plan_expires_at = $5,
               plan_duration_days = $6,
               plan_total_price = $7,
               internal_notes = $8,
               public_enabled = $9,
               reference_id = $10
           where id = $1`,
          [store.id, planId, planStatus, planStartedAt, planExpiresAt, effectiveDurationDays, planTotalPrice, internalNotes, publicEnabled, referenceId],
        );

        if (planId && planStatus === "active") {
          await resolvePendingPlanActivationRequests(connection, store.id, session.userId);
        }

        const shouldNotifyPlanActivation = shouldSendPlanActivationNotification(previousPlanState, nextPlanState);
        if (shouldNotifyPlanActivation) {
          await insertPlanActivationEvent(connection, {
            storeId: store.id,
            userId,
            recordedByUserId: session.userId,
            planId,
            eventType: getPlanActivationEventType(previousPlanState, nextPlanState),
            planCode: plan.code || "",
            planName: plan.name || "",
            storeName: store.name || user.store_name || user.full_name || user.email || "",
            merchantEmail: user.email || "",
            referenceId: referenceId || user.store_reference_id || "",
            planStatus,
            durationDays: effectiveDurationDays,
            totalPrice: planTotalPrice,
            currencyCode: plan.currency_code || "AOA",
            planStartedAt,
            planExpiresAt,
            recordedAt: planStartedAt,
          });
        }

        await connection.query("commit");
        transactionStarted = false;
        invalidatePublicCatalogCache(store.id);

        if (!shouldNotifyPlanActivation) {
          return jsonResponse(200, { ok: true, planActivationNotification: null });
        }

        const planActivationNotification = {
          attempted: true,
          email: {
            attempted: false,
            sent: false,
            error: "",
          },
          whatsapp: {
            channel: "none",
            attempted: false,
            delivered: false,
            usedTemplate: false,
            mode: "none",
            messageCount: 0,
            error: "",
          },
          summary: "",
        };

        if (isEmailDeliveryConfigured() && user.email) {
          planActivationNotification.email.attempted = true;
          try {
            await sendPlanActivationEmail({
              toEmail: user.email,
              storeName: store.name,
              planName: plan.name,
              expiryDate: planExpiresAt,
              totalPrice: planTotalPrice,
              currencyCode: plan.currency_code,
            });
            planActivationNotification.email.sent = true;
          } catch (error) {
            planActivationNotification.email.error = error.message || "Falha ao enviar o email de ativacao.";
          }
        }

        planActivationNotification.whatsapp = await sendPlanActivationWhatsAppNotification({
          event,
          store: {
            name: store.name,
            whatsapp: store.whatsapp || "",
          },
          planName: plan.name,
          expiryDate: planExpiresAt,
          totalPrice: planTotalPrice,
          currencyCode: plan.currency_code,
        });
        planActivationNotification.summary = buildPlanActivationNotificationSummary(planActivationNotification);

        return jsonResponse(200, { ok: true, planActivationNotification });
      }

      await connection.query(
        `update catalog_users
         set account_status = $2
         where id = $1`,
        [userId, accountStatus],
      );

      if (user.store_id) {
        await connection.query(
          `update catalog_stores
           set plan_id = $2,
               plan_status = $3,
               plan_started_at = $4,
               plan_expires_at = $5,
               plan_duration_days = $6,
               plan_total_price = $7,
               internal_notes = $8,
               public_enabled = $9,
               reference_id = $10
           where id = $1`,
          [user.store_id, null, planStatus, null, null, null, null, internalNotes, publicEnabled, referenceId],
        );
      }

      await connection.query("commit");
      transactionStarted = false;
      if (user.store_id) {
        invalidatePublicCatalogCache(user.store_id);
      }
      return jsonResponse(200, { ok: true, planActivationNotification: null });
    } catch (error) {
      if (transactionStarted) {
        await connection.query("rollback");
      }
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    const identityConflictMessage = getCatalogIdentityConflictMessage(error);
    if (identityConflictMessage) {
      return jsonResponse(409, {
        error: identityConflictMessage,
      });
    }
    return jsonResponse(error.status || 500, {
      error: error.message || "Nao foi possivel atualizar o cliente.",
    });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
