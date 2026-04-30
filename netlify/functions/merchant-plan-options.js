import { getSessionContext } from "./_auth.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import { getPlanPaymentFlowSchemaStatus, mapPlanRequestsWithProofs } from "./_plan-requests.js";
import { getSystemSettings } from "./_settings.js";

const OPEN_PLAN_REQUEST_STATUSES = ["pending_payment", "proof_submitted", "under_review", "needs_correction"];

function mapPlanDefinition(row) {
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
  };
}

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const session = await getSessionContext(event);
    if (!session?.storeId || !session?.userId) {
      return jsonResponse(401, { error: "Precisas de iniciar sessao para consultar os planos." });
    }

    const pool = getPool();
    const systemSettings = await getSystemSettings(pool);
    const planPaymentFlowSchema = await getPlanPaymentFlowSchemaStatus(pool);
    const [storeResult, plansResult, requestsResult] = await Promise.all([
      pool.query(
        `select
           stores.id,
           stores.name,
           stores.reference_id,
           stores.plan_id,
           stores.plan_status,
           stores.plan_expires_at,
           stores.plan_duration_days,
           stores.plan_total_price,
           coalesce(plans.currency_code, stores.currency_code, 'AOA') as current_plan_currency_code,
           coalesce(products.product_count, 0)::int as product_count
         from catalog_stores stores
         left join catalog_plan_definitions plans on plans.id = stores.plan_id
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
      pool.query(
        `select
           id,
           code,
           name,
           description,
           price_monthly,
           currency_code,
           max_products,
           max_team_members,
           active,
           sort_order
         from catalog_plan_definitions
         where active = true
           and coalesce(price_monthly, 0) > 0
         order by sort_order asc, name asc`,
      ),
      planPaymentFlowSchema.ready
        ? pool.query(
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
           from public.catalog_plan_activation_requests requests
           where requests.store_id = $1
             and requests.status = any($2::text[])
           order by requests.requested_at desc, requests.id desc
           limit 1`,
          [session.storeId, OPEN_PLAN_REQUEST_STATUSES],
        )
        : Promise.resolve({ rows: [] }),
    ]);

    const store = storeResult.rows[0];
    if (!store) {
      return jsonResponse(404, { error: "Loja nao encontrada." });
    }

    const activeRequest = requestsResult.rows.length
      ? (await mapPlanRequestsWithProofs(pool, requestsResult.rows))[0] || null
      : null;

    return jsonResponse(200, {
      ok: true,
      store: {
        id: store.id,
        name: store.name || "",
        referenceId: store.reference_id || "",
        productCount: Number(store.product_count || 0),
        currentPlanId: store.plan_id || "",
        currentPlanStatus: store.plan_status || "trial",
        currentPlanExpiresAt: store.plan_expires_at || null,
        currentPlanDurationDays: store.plan_duration_days == null ? "" : Number(store.plan_duration_days),
        currentPlanTotalPrice: store.plan_total_price == null ? 0 : Number(store.plan_total_price),
        currentPlanCurrencyCode: store.current_plan_currency_code || "AOA",
        supportWhatsApp: systemSettings.supportWhatsApp,
        trialDays: systemSettings.trialDays,
        maxFreeProducts: systemSettings.maxFreeProducts,
      },
      activeRequest,
      plans: plansResult.rows.map(mapPlanDefinition),
    });
  } catch (error) {
    return jsonResponse(error.status || 500, {
      error: error.message || "Nao foi possivel carregar os planos disponiveis.",
    });
  }
}

export const handler = withCors(handle, { allowMethods: ["GET"] });
