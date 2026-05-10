import { randomUUID } from "node:crypto";
import { getSuperAdminSession, requireSuperAdminAccess } from "./_auth.js";
import { invalidatePublicCatalogCache } from "./_catalog-cache.js";
import { isEmailDeliveryConfigured, sendPlanActivationEmail } from "./_email.js";
import { getPool, jsonResponse, withCors } from "./_postgres.js";
import { PLAN_REQUEST_SELECT_SQL, assertPlanPaymentFlowSchema, mapPlanRequestsWithProofs } from "./_plan-requests.js";
import { sendPlanActivationWhatsAppNotification } from "./_whatsapp.js";

const PLAN_REQUEST_REVIEW_ACTIONS = new Set(["under_review", "needs_correction", "rejected", "activated"]);
const REQUEST_FINAL_STATUSES = new Set(["activated", "rejected", "expired"]);

function cleanText(value, maxLength = null) {
  const text = String(value || "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
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

async function handle(event) {
  try {
    const session = await getSuperAdminSession(event);
    requireSuperAdminAccess(session, "clientes", "Nao tens permissao para rever pedidos de plano.");

    const payload = JSON.parse(event.body || "{}");
    const requestId = cleanText(payload.requestId, 120);
    const action = cleanText(payload.action, 40).toLowerCase();
    const reviewNote = cleanText(payload.reviewNote, 4000);

    if (!requestId) {
      return jsonResponse(400, { error: "O pedido de plano e obrigatorio." });
    }

    if (!PLAN_REQUEST_REVIEW_ACTIONS.has(action)) {
      return jsonResponse(400, { error: "A acao de revisao nao e valida." });
    }

    if ((action === "needs_correction" || action === "rejected") && !reviewNote) {
      return jsonResponse(400, { error: "Escreve a observacao que o lojista precisa de ver." });
    }

    const pool = getPool();
    const connection = await pool.connect();
    let transactionStarted = false;
    let publicStoreId = "";
    let notificationContext = null;

    try {
      await assertPlanPaymentFlowSchema(connection);
      await connection.query("begin");
      transactionStarted = true;

      const requestResult = await connection.query(
        `select
           ${PLAN_REQUEST_SELECT_SQL},
           stores.name as live_store_name,
           stores.reference_id as live_reference_id,
           stores.whatsapp as live_store_whatsapp,
           stores.plan_id as store_plan_id,
           stores.plan_status as store_plan_status,
           stores.plan_started_at as store_plan_started_at,
           stores.plan_expires_at as store_plan_expires_at,
           stores.plan_duration_days as store_plan_duration_days,
           stores.plan_total_price as store_plan_total_price,
           users.email as live_merchant_email
         from public.catalog_plan_activation_requests requests
         join public.catalog_stores stores on stores.id = requests.store_id and stores.deleted_at is null
         join public.catalog_users users on users.id = requests.user_id and users.deleted_at is null
         where requests.id = $1
         limit 1`,
        [requestId],
      );

      const requestRow = requestResult.rows[0];
      if (!requestRow) {
        await connection.query("rollback");
        transactionStarted = false;
        return jsonResponse(404, { error: "Pedido de plano nao encontrado." });
      }

      const currentStatus = String(requestRow.status || "").trim().toLowerCase();
      if (REQUEST_FINAL_STATUSES.has(currentStatus)) {
        await connection.query("rollback");
        transactionStarted = false;
        return jsonResponse(400, { error: "Este pedido ja foi fechado e nao aceita nova revisao." });
      }

      const latestProofResult = await connection.query(
        `select id
         from public.catalog_plan_payment_proofs
         where request_id = $1
         order by submitted_at desc, id desc
         limit 1`,
        [requestId],
      );

      const latestProofId = latestProofResult.rows[0]?.id || "";
      if ((action === "under_review" || action === "needs_correction" || action === "activated") && !latestProofId) {
        await connection.query("rollback");
        transactionStarted = false;
        return jsonResponse(400, { error: "Este pedido ainda nao tem comprovativo anexado." });
      }

      if (action === "under_review") {
        await connection.query(
          `update public.catalog_plan_activation_requests
              set status = 'under_review',
                  payment_proof_status = 'reviewing',
                  review_note = $2,
                  resolved_at = null,
                  resolved_by_user_id = null
            where id = $1`,
          [requestId, reviewNote],
        );

        if (latestProofId) {
          await connection.query(
            `update public.catalog_plan_payment_proofs
                set review_status = 'reviewing',
                    review_note = $2,
                    reviewed_by_user_id = $3,
                    reviewed_at = now()
              where id = $1`,
            [latestProofId, reviewNote, session.userId],
          );
        }
      }

      if (action === "needs_correction") {
        await connection.query(
          `update public.catalog_plan_activation_requests
              set status = 'needs_correction',
                  payment_proof_status = 'rejected',
                  review_note = $2,
                  resolved_at = null,
                  resolved_by_user_id = null
            where id = $1`,
          [requestId, reviewNote],
        );

        await connection.query(
          `update public.catalog_plan_payment_proofs
              set review_status = 'rejected',
                  review_note = $2,
                  reviewed_by_user_id = $3,
                  reviewed_at = now()
            where id = $1`,
          [latestProofId, reviewNote, session.userId],
        );
      }

      if (action === "rejected") {
        await connection.query(
          `update public.catalog_plan_activation_requests
              set status = 'rejected',
                  payment_proof_status = case when $3 then 'rejected' else payment_proof_status end,
                  review_note = $2,
                  resolved_at = now(),
                  resolved_by_user_id = $4
            where id = $1`,
          [requestId, reviewNote, Boolean(latestProofId), session.userId],
        );

        if (latestProofId) {
          await connection.query(
            `update public.catalog_plan_payment_proofs
                set review_status = 'rejected',
                    review_note = $2,
                    reviewed_by_user_id = $3,
                    reviewed_at = now()
              where id = $1`,
            [latestProofId, reviewNote, session.userId],
          );
        }
      }

      if (action === "activated") {
        const planStartedAt = new Date().toISOString();
        const durationDays = Number(requestRow.duration_days || 30);
        const planExpiresAt = addDaysToIsoDate(planStartedAt, durationDays);
        const planTotalPrice = Number(requestRow.paid_amount ?? requestRow.total_price ?? 0);
        const previousPlanState = {
          planId: requestRow.store_plan_id || "",
          planStatus: requestRow.store_plan_status || "",
          planStartedAt: requestRow.store_plan_started_at || null,
          planExpiresAt: requestRow.store_plan_expires_at || null,
          planDurationDays: requestRow.store_plan_duration_days == null ? null : Number(requestRow.store_plan_duration_days),
          planTotalPrice: requestRow.store_plan_total_price == null ? null : Number(requestRow.store_plan_total_price),
        };
        const nextPlanState = {
          planId: requestRow.plan_id || "",
          planStatus: "active",
          planStartedAt,
          planExpiresAt,
          planDurationDays: durationDays,
          planTotalPrice,
        };

        await connection.query(
          `update public.catalog_users
              set account_status = 'active'
            where id = $1`,
          [requestRow.user_id],
        );

        await connection.query(
          `update public.catalog_stores
              set plan_id = $2,
                  plan_status = 'active',
                  plan_started_at = $3,
                  plan_expires_at = $4,
                  plan_duration_days = $5,
                  plan_total_price = $6
            where id = $1`,
          [
            requestRow.store_id,
            requestRow.plan_id,
            planStartedAt,
            planExpiresAt,
            durationDays,
            planTotalPrice,
          ],
        );

        await connection.query(
          `update public.catalog_plan_activation_requests
              set status = 'activated',
                  payment_proof_status = 'accepted',
                  review_note = $2,
                  resolved_at = now(),
                  resolved_by_user_id = $3,
                  activated_at = now(),
                  activated_by_user_id = $3
            where id = $1`,
          [requestId, reviewNote, session.userId],
        );

        await connection.query(
          `update public.catalog_plan_payment_proofs
              set review_status = 'accepted',
                  review_note = $2,
                  reviewed_by_user_id = $3,
                  reviewed_at = now()
            where id = $1`,
          [latestProofId, reviewNote, session.userId],
        );

        const shouldNotifyPlanActivation = shouldSendPlanActivationNotification(previousPlanState, nextPlanState);
        if (shouldNotifyPlanActivation) {
          await insertPlanActivationEvent(connection, {
            storeId: requestRow.store_id,
            userId: requestRow.user_id,
            recordedByUserId: session.userId,
            planId: requestRow.plan_id,
            eventType: getPlanActivationEventType(previousPlanState, nextPlanState),
            planCode: requestRow.plan_code || "",
            planName: requestRow.plan_name || "",
            storeName: requestRow.live_store_name || requestRow.store_name || "",
            merchantEmail: requestRow.live_merchant_email || requestRow.merchant_email || "",
            referenceId: requestRow.live_reference_id || requestRow.reference_id || "",
            planStatus: "active",
            durationDays,
            totalPrice: planTotalPrice,
            currencyCode: requestRow.currency_code || "AOA",
            planStartedAt,
            planExpiresAt,
            recordedAt: planStartedAt,
          });

          notificationContext = {
            event,
            storeId: requestRow.store_id,
            storeName: requestRow.live_store_name || requestRow.store_name || "",
            storeWhatsApp: requestRow.live_store_whatsapp || requestRow.store_whatsapp || "",
            merchantEmail: requestRow.live_merchant_email || requestRow.merchant_email || "",
            planName: requestRow.plan_name || "",
            planExpiresAt,
            totalPrice: planTotalPrice,
            currencyCode: requestRow.currency_code || "AOA",
          };
        }

        publicStoreId = requestRow.store_id || "";
      }

      const updatedRequestResult = await connection.query(
        `select
           ${PLAN_REQUEST_SELECT_SQL}
         from public.catalog_plan_activation_requests requests
         where requests.id = $1
         limit 1`,
        [requestId],
      );

      await connection.query("commit");
      transactionStarted = false;

      if (publicStoreId) {
        invalidatePublicCatalogCache(publicStoreId);
      }

      const mappedRequests = await mapPlanRequestsWithProofs(connection, updatedRequestResult.rows);
      const updatedRequest = mappedRequests[0] || null;

      let planActivationNotification = null;
      if (notificationContext) {
        planActivationNotification = {
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

        if (isEmailDeliveryConfigured() && notificationContext.merchantEmail) {
          planActivationNotification.email.attempted = true;
          try {
            await sendPlanActivationEmail({
              toEmail: notificationContext.merchantEmail,
              storeName: notificationContext.storeName,
              planName: notificationContext.planName,
              expiryDate: notificationContext.planExpiresAt,
              totalPrice: notificationContext.totalPrice,
              currencyCode: notificationContext.currencyCode,
            });
            planActivationNotification.email.sent = true;
          } catch (error) {
            planActivationNotification.email.error = error.message || "Falha ao enviar o email de ativacao.";
          }
        }

        planActivationNotification.whatsapp = await sendPlanActivationWhatsAppNotification({
          event,
          store: {
            name: notificationContext.storeName,
            whatsapp: notificationContext.storeWhatsApp,
          },
          planName: notificationContext.planName,
          expiryDate: notificationContext.planExpiresAt,
          totalPrice: notificationContext.totalPrice,
          currencyCode: notificationContext.currencyCode,
        });
        planActivationNotification.summary = buildPlanActivationNotificationSummary(planActivationNotification);
      }

      return jsonResponse(200, {
        ok: true,
        request: updatedRequest,
        planActivationNotification,
      });
    } catch (error) {
      if (transactionStarted) {
        await connection.query("rollback").catch(() => {});
      }
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(error.status || 500, {
      error: error.message || "Nao foi possivel rever o pedido do plano.",
    });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
