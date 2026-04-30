import { getSessionContext } from "./_auth.js";
import {
  createCustomerProfileId,
  mapCustomerProfileRow,
  normalizeCustomerDiscountPercent,
  normalizeCustomerPhone,
} from "./_orders.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";

function cleanText(value, maxLength = null) {
  const text = String(value ?? "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

async function handle(event) {
  try {
    const session = await getSessionContext(event);
    if (!session?.storeId || !session?.userId) {
      return jsonResponse(401, { error: "Precisas de iniciar sessao para atualizar o desconto do cliente." });
    }

    await ensureDatabaseReady();
    const payload = JSON.parse(event.body || "{}");
    const orderId = cleanText(payload.orderId);
    if (!orderId) {
      return jsonResponse(400, { error: "A encomenda do cliente e obrigatoria." });
    }

    const rawDiscount = payload.discountPercent;
    if (rawDiscount !== "" && rawDiscount != null && !Number.isFinite(Number(rawDiscount))) {
      return jsonResponse(400, { error: "O desconto do cliente e invalido." });
    }

    const numericDiscount = Number(rawDiscount || 0);
    if (numericDiscount < 0 || numericDiscount > 100) {
      return jsonResponse(400, { error: "O desconto do cliente deve ficar entre 0% e 100%." });
    }

    const discountPercent = normalizeCustomerDiscountPercent(rawDiscount);
    const pool = getPool();
    const orderResult = await pool.query(
      `select
         id,
         store_id,
         customer_key,
         customer_name,
         customer_phone,
         created_at
       from catalog_orders
       where id = $1
         and store_id = $2
       limit 1`,
      [orderId, session.storeId],
    );
    const order = orderResult.rows[0];
    if (!order) {
      return jsonResponse(404, { error: "Encomenda nao encontrada." });
    }

    const customerPhone = normalizeCustomerPhone(order.customer_phone);
    const customerKey = cleanText(order.customer_key) || customerPhone;
    if (!customerKey) {
      return jsonResponse(400, { error: "Este pedido ainda nao tem um cliente identificavel para fidelizacao." });
    }

    const orderCountResult = await pool.query(
      `select count(*)::int as total
       from catalog_orders
       where store_id = $1
         and customer_key = $2`,
      [session.storeId, customerKey],
    );
    const orderCount = Number(orderCountResult.rows[0]?.total || 0);
    const customerResult = await pool.query(
      `insert into catalog_order_customers (
         id,
         store_id,
         customer_key,
         customer_name,
         customer_phone,
         loyalty_discount_percent,
         order_count,
         last_order_id,
         last_order_at
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, now()
       )
       on conflict (store_id, customer_key) do update
       set customer_name = excluded.customer_name,
           customer_phone = excluded.customer_phone,
           loyalty_discount_percent = excluded.loyalty_discount_percent,
           order_count = greatest(catalog_order_customers.order_count, excluded.order_count),
           last_order_id = excluded.last_order_id,
           last_order_at = excluded.last_order_at
       returning
         id as customer_profile_id,
         customer_key,
         customer_name,
         customer_phone,
         loyalty_discount_percent,
         order_count,
         last_order_id,
         last_order_at,
         created_at as customer_created_at,
         updated_at as customer_updated_at`,
      [
        createCustomerProfileId(),
        session.storeId,
        customerKey,
        cleanText(order.customer_name, 160),
        customerPhone,
        discountPercent,
        orderCount,
        order.id,
      ],
    );

    return jsonResponse(200, {
      ok: true,
      customer: mapCustomerProfileRow(customerResult.rows[0] || null),
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
