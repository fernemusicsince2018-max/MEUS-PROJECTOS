import { cleanText, mapOrder, mapOrderItem, mapOrderStore } from "./_orders.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const token = cleanText(event.queryStringParameters?.token);
    if (!token) {
      return jsonResponse(400, { error: "O token de acompanhamento e obrigatorio." });
    }

    const pool = getPool();
    const orderResult = await pool.query(
      `select
         orders.*,
         stores.id as store_public_id,
         stores.name,
         stores.logo,
         stores.color,
         stores.whatsapp,
         stores.pickup_note,
         stores.city,
         stores.country
       from catalog_orders orders
       join catalog_stores stores on stores.id = orders.store_id
       where orders.tracking_token = $1
       limit 1`,
      [token],
    );

    const orderRow = orderResult.rows[0];
    if (!orderRow) {
      return jsonResponse(404, { error: "Encomenda nao encontrada." });
    }

    const itemsResult = await pool.query(
      `select
         id,
         order_id,
         product_id,
         product_name,
         product_image,
         unit_price,
         quantity,
         line_total,
         created_at
       from catalog_order_items
       where order_id = $1
       order by created_at asc`,
      [orderRow.id],
    );

    return jsonResponse(200, {
      ok: true,
      order: mapOrder(orderRow, {
        items: itemsResult.rows.map(mapOrderItem),
        store: mapOrderStore(orderRow),
      }),
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["GET"] });
