import { randomUUID } from "node:crypto";
import { getSessionContext } from "./_auth.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import {
  buildPlanActivationRequestMessage,
  buildPlanActivationWhatsAppLink,
  calculatePlanTotalPrice,
  normalizeRequestedDuration,
} from "./_plan-notifications.js";
import {
  PLAN_REQUEST_RETURNING_SQL,
  PLAN_REQUEST_SELECT_SQL,
  assertPlanPaymentFlowSchema,
  buildPaymentSnapshot,
  mapPlanRequestsWithProofs,
  resolvePlanActivationRequestAction,
  toPlanActivationRequestPayload,
} from "./_plan-requests.js";
import { getSystemSettings } from "./_settings.js";

const OPEN_PLAN_REQUEST_STATUSES = ["pending_payment", "proof_submitted", "under_review", "needs_correction"];

async function findLatestOpenRequest(connection, storeId) {
  const result = await connection.query(
    `select
       ${PLAN_REQUEST_SELECT_SQL}
     from public.catalog_plan_activation_requests requests
     where requests.store_id = $1
       and requests.status = any($2::text[])
     order by requests.requested_at desc, requests.id desc
     limit 1`,
    [storeId, OPEN_PLAN_REQUEST_STATUSES],
  );

  return result.rows[0] || null;
}

async function expireOpenRequest(connection, requestId) {
  await connection.query(
    `update public.catalog_plan_activation_requests
        set status = 'expired',
            resolved_at = now(),
            resolved_by_user_id = null
      where id = $1`,
    [requestId],
  );
}

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const session = await getSessionContext(event);
    if (!session) {
      return jsonResponse(401, { error: "Precisas de iniciar sessao para pedir a ativacao do plano." });
    }

    if (session.role === "super_admin") {
      return jsonResponse(403, { error: "Este pedido so pode ser feito por contas lojistas." });
    }

    const payload = JSON.parse(event.body || "{}");
    const planId = String(payload.planId || "").trim();
    if (!planId) {
      return jsonResponse(400, { error: "Escolhe um plano antes de enviar o pedido." });
    }

    const pool = getPool();
    const connection = await pool.connect();

    try {
      await assertPlanPaymentFlowSchema(connection);

      const [systemSettings, storeResult, planResult] = await Promise.all([
        getSystemSettings(connection),
        connection.query(
          `select
             stores.id,
             stores.name,
             stores.reference_id,
             stores.whatsapp,
             stores.plan_status,
             current_plan.name as current_plan_name,
             coalesce(products.product_count, 0)::int as product_count
           from catalog_stores stores
           left join catalog_plan_definitions current_plan on current_plan.id = stores.plan_id
           left join lateral (
             select count(*)::int as product_count
             from catalog_products
             where catalog_id = stores.id
           ) products on true
           where stores.id = $1
             and stores.owner_user_id = $2
             and stores.deleted_at is null
           limit 1`,
          [session.storeId, session.userId],
        ),
        connection.query(
          `select
             id,
             code,
             name,
             price_monthly,
             currency_code,
             active
           from catalog_plan_definitions
           where id = $1
           limit 1`,
          [planId],
        ),
      ]);

      const store = storeResult.rows[0];
      if (!store) {
        return jsonResponse(404, { error: "Nao foi possivel encontrar a tua loja para este pedido." });
      }

      const plan = planResult.rows[0];
      if (!plan || !plan.active || Number(plan.price_monthly || 0) <= 0) {
        return jsonResponse(404, { error: "Este plano nao esta disponivel para pedido neste momento." });
      }

      const durationDays = normalizeRequestedDuration(plan, payload.durationDays);
      const totalPrice = calculatePlanTotalPrice(plan.price_monthly, durationDays);
      const existingOpenRequest = await findLatestOpenRequest(connection, store.id);
      const existingRequestAction = resolvePlanActivationRequestAction(existingOpenRequest, {
        planId: plan.id,
        durationDays,
        totalPrice,
      });

      if (existingOpenRequest && (existingRequestAction.action === "reuse" || existingRequestAction.action === "blocked")) {
        const existingRequestWithProofs = (await mapPlanRequestsWithProofs(connection, [existingOpenRequest]))[0]
          || toPlanActivationRequestPayload(existingOpenRequest);

        return jsonResponse(200, {
          ok: true,
          duplicate: true,
          replacedExisting: false,
          blockedPlanSelection: existingRequestAction.action === "blocked",
          locked: existingRequestAction.locked,
          request: existingRequestWithProofs,
        });
      }

      const referenceId = store.reference_id || session.referenceId || "";
      const paymentSnapshot = buildPaymentSnapshot(systemSettings, {
        referenceId,
      });
      const requestInput = {
        supportWhatsApp: systemSettings.supportWhatsApp,
        storeName: store.name || session.storeName || "Minha Loja",
        referenceId,
        storeId: store.id,
        planName: plan.name || "",
        durationDays,
        totalPrice,
        currencyCode: plan.currency_code || "AOA",
        merchantEmail: session.email || "",
        paymentReference: paymentSnapshot.paymentReference,
      };
      const messageText = buildPlanActivationRequestMessage(requestInput);
      const whatsappLink = buildPlanActivationWhatsAppLink(requestInput);

      let transactionStarted = false;

      try {
        await connection.query("begin");
        transactionStarted = true;

        if (existingOpenRequest && existingRequestAction.action === "replace") {
          await expireOpenRequest(connection, existingOpenRequest.id);
        }

        const insertResult = await connection.query(
          `insert into public.catalog_plan_activation_requests (
             id,
             store_id,
             user_id,
             plan_id,
             plan_code,
             plan_name,
             store_name,
             merchant_email,
             reference_id,
             store_whatsapp,
             product_count,
             current_plan_status,
             current_plan_name,
             duration_days,
             total_price,
             currency_code,
             message_text,
             whatsapp_link,
             payment_reference,
             payment_method,
             payment_instructions,
             payment_bank_name,
             payment_account_name,
             payment_account_number,
             payment_iban,
             payment_proof_status,
             status,
             payment_due_at
           ) values (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 'not_submitted', 'pending_payment', $26
            )
            returning
              ${PLAN_REQUEST_RETURNING_SQL}`,
           [
            randomUUID(),
            store.id,
            session.userId,
            plan.id,
            plan.code || "",
            plan.name || "",
            store.name || session.storeName || session.email || "",
            session.email || "",
            referenceId,
            store.whatsapp || "",
            Number(store.product_count || 0),
            store.plan_status || "trial",
            store.current_plan_name || "",
            durationDays,
            totalPrice,
            plan.currency_code || "AOA",
            messageText,
            whatsappLink,
            paymentSnapshot.paymentReference,
            paymentSnapshot.paymentMethod,
            paymentSnapshot.paymentInstructions,
            paymentSnapshot.paymentBankName,
            paymentSnapshot.paymentAccountName,
            paymentSnapshot.paymentAccountNumber,
            paymentSnapshot.paymentIban,
            paymentSnapshot.paymentDueAt,
          ],
        );

        await connection.query("commit");
        transactionStarted = false;

        return jsonResponse(200, {
          ok: true,
          duplicate: false,
          replacedExisting: existingOpenRequest && existingRequestAction.action === "replace",
          blockedPlanSelection: false,
          locked: false,
          request: toPlanActivationRequestPayload(insertResult.rows[0]),
        });
      } catch (error) {
        if (transactionStarted) {
          await connection.query("rollback").catch(() => {});
        }
        throw error;
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(error.status || 500, {
      error: error.message || "Nao foi possivel registar o pedido de ativacao.",
    });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
