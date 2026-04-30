import { getPlanAccessState } from "./_auth.js";
import {
  calculateOrderDiscountAmount,
  createCustomerProfileId,
  createInitialOrderStatusTimeline,
  createOrderId,
  createOrderItemId,
  createTrackingCode,
  createTrackingToken,
  mapOrder,
  mapCustomerProfileRow,
  mapOrderItem,
  mapOrderStore,
  normalizeOrderCreateInput,
} from "./_orders.js";
import {
  createQueuedMerchantNotificationResult,
  enqueueNotificationJob,
} from "./_notification-jobs.js";
import { registerNewOrderStats } from "./_order-stats.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import {
  buildTrackingUrl,
  getAppBaseUrl,
  getMerchantOrderWhatsAppCapability,
} from "./_whatsapp.js";

const MERCHANT_ORDER_WHATSAPP_JOB = "merchant_order_whatsapp";

function toMoney(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function buildMerchantNotificationFallback(capability, trackingUrl = "") {
  return {
    channel: capability?.config?.enabled ? "whatsapp_cloud_api" : "none",
    attempted: false,
    delivered: false,
    queued: false,
    usedTemplate: Boolean(
      capability?.config?.summaryTemplateName || capability?.config?.itemTemplateName,
    ),
    mode: "none",
    messageCount: 0,
    trackingUrl,
    warnings: [],
    error: capability?.error || "",
  };
}

function buildMerchantNotificationPayload(appBaseUrl, store, order, items) {
  return {
    appBaseUrl,
    store: {
      name: store?.name || "",
      whatsapp: store?.whatsapp || "",
      pickup_note: store?.pickup_note || "",
      currency_code: store?.currency_code || order?.currencyCode || "AOA",
    },
    order: {
      trackingToken: order?.trackingToken || "",
      trackingCode: order?.trackingCode || "",
      customerName: order?.customerName || "",
      customerPhone: order?.customerPhone || "",
      fulfillmentType: order?.fulfillmentType || "delivery",
      region: order?.region || "",
      area: order?.area || "",
      pickupTime: order?.pickupTime || "",
      deliveryTime: order?.deliveryTime || "",
      notes: order?.notes || "",
      subtotalAmount: Number(order?.subtotalAmount || 0),
      discountPercent: Number(order?.discountPercent || 0),
      discountAmount: Number(order?.discountAmount || 0),
      totalAmount: Number(order?.totalAmount || 0),
      currencyCode: order?.currencyCode || store?.currency_code || "AOA",
    },
    items: Array.isArray(items)
      ? items.map((item) => ({
          productName: item?.productName || "",
          productImage: item?.productImage || "",
          unitPrice: Number(item?.unitPrice || 0),
          quantity: Number(item?.quantity || 0),
          lineTotal: Number(item?.lineTotal || 0),
        }))
      : [],
  };
}

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const payload = JSON.parse(event.body || "{}");
    const normalizedOrderResult = normalizeOrderCreateInput(payload);
    if (normalizedOrderResult.error) {
      return jsonResponse(400, { error: normalizedOrderResult.error });
    }

    const normalizedOrder = normalizedOrderResult.value;
    const pool = getPool();
    const connection = await pool.connect();
    const appBaseUrl = getAppBaseUrl(event);

    try {
      await connection.query("begin");

      const storeResult = await connection.query(
        `select
           id,
           name,
           logo,
           color,
           whatsapp,
           pickup_note,
           city,
           country,
           currency_code,
           public_enabled,
           plan_status,
           plan_expires_at,
           deleted_at
         from catalog_stores
         where id = $1
         limit 1`,
        [normalizedOrder.storeId],
      );

      const store = storeResult.rows[0];
      if (!store || store.deleted_at) {
        await connection.query("rollback");
        return jsonResponse(404, { error: "Loja nao encontrada." });
      }

      if (!store.public_enabled) {
        await connection.query("rollback");
        return jsonResponse(404, { error: "Esta loja nao esta disponivel para novos pedidos." });
      }

      const planAccess = getPlanAccessState(store.plan_status, store.plan_expires_at);
      if (!planAccess.allowed) {
        await connection.query("rollback");
        return jsonResponse(403, {
          error: planAccess.message || "Esta loja nao esta disponivel para novos pedidos.",
        });
      }

      const requestedProductIds = normalizedOrder.items.map((item) => item.productId);
      const productResult = await connection.query(
        `select id, name, image, price, stock, available
         from catalog_products
         where catalog_id = $1
           and id = any($2::text[])`,
        [normalizedOrder.storeId, requestedProductIds],
      );

      if (productResult.rows.length !== requestedProductIds.length) {
        await connection.query("rollback");
        return jsonResponse(400, { error: "Um ou mais produtos do pedido ja nao estao disponiveis." });
      }

      const customerKey = normalizedOrder.customerPhone;
      const existingCustomerResult = await connection.query(
        `select
           id as customer_profile_id,
           customer_key,
           customer_name,
           customer_phone,
           loyalty_discount_percent,
           order_count,
           last_order_id,
           last_order_at,
           created_at as customer_created_at,
           updated_at as customer_updated_at
         from catalog_order_customers
         where store_id = $1
           and customer_key = $2
         limit 1`,
        [normalizedOrder.storeId, customerKey],
      );
      const existingCustomer = mapCustomerProfileRow(existingCustomerResult.rows[0] || null);
      const customerName = normalizedOrder.customerName || existingCustomer?.customerName || "";
      const discountPercent = existingCustomer?.loyaltyDiscountPercent || 0;
      const productMap = new Map(productResult.rows.map((product) => [product.id, product]));
      const itemRows = [];
      let subtotalAmount = 0;
      let itemCount = 0;

      for (const item of normalizedOrder.items) {
        const product = productMap.get(item.productId);
        if (!product || product.available === false) {
          await connection.query("rollback");
          return jsonResponse(400, { error: `O produto selecionado ja nao esta disponivel: ${product?.name || item.productId}.` });
        }

        const stock = product.stock == null ? null : Number(product.stock);
        if (stock != null && item.quantity > stock) {
          await connection.query("rollback");
          return jsonResponse(400, {
            error: `O produto ${product.name} tem apenas ${stock} unidade(s) disponivel(is).`,
          });
        }

        const unitPrice = toMoney(product.price);
        const lineTotal = toMoney(unitPrice * item.quantity);
        subtotalAmount += lineTotal;
        itemCount += item.quantity;

        itemRows.push({
          id: createOrderItemId(),
          orderId: "",
          productId: product.id,
          productName: product.name || "",
          productImage: product.image || "",
          unitPrice,
          quantity: item.quantity,
          lineTotal,
        });
      }

      subtotalAmount = toMoney(subtotalAmount);
      const discountAmount = calculateOrderDiscountAmount(subtotalAmount, discountPercent);
      const totalAmount = toMoney(Math.max(0, subtotalAmount - discountAmount));

      let insertedOrder = null;
      let mappedCustomer = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const orderId = createOrderId();
          const trackingCode = createTrackingCode();
          const trackingToken = createTrackingToken();
          const initialTimeline = createInitialOrderStatusTimeline();
          const insertResult = await connection.query(
            `insert into catalog_orders (
               id,
               store_id,
               tracking_code,
               tracking_token,
               customer_name,
               customer_phone,
               customer_key,
               fulfillment_type,
               region,
               area,
               pickup_time,
               delivery_time,
               notes,
               status,
               subtotal_amount,
               discount_percent,
               discount_amount,
               total_amount,
               currency_code,
               item_count,
               status_updated_at,
               status_timeline
              ) values (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, $15, $16, $17, $18, $19, now(), $20::jsonb
               )
                returning *`,
            [
              orderId,
              normalizedOrder.storeId,
              trackingCode,
              trackingToken,
              customerName,
              normalizedOrder.customerPhone,
              customerKey,
              normalizedOrder.fulfillmentType,
              normalizedOrder.region,
              normalizedOrder.area,
              normalizedOrder.pickupTime,
              normalizedOrder.deliveryTime,
              normalizedOrder.notes,
              subtotalAmount,
              discountPercent,
              discountAmount,
              totalAmount,
              store.currency_code || "AOA",
              itemCount,
              JSON.stringify(initialTimeline),
            ],
          );

          insertedOrder = insertResult.rows[0];
          for (const itemRow of itemRows) {
            itemRow.orderId = insertedOrder.id;
          }

          if (itemRows.length) {
            await connection.query(
              `insert into catalog_order_items (
                 id,
                 order_id,
                 product_id,
                 product_name,
                 product_image,
                 unit_price,
                 quantity,
                 line_total
               )
               select
                 item.id::text,
                 item.order_id::text,
                 item.product_id::text,
                 item.product_name::text,
                 item.product_image::text,
                 item.unit_price::numeric(10, 2),
                 item.quantity::integer,
                 item.line_total::numeric(10, 2)
               from jsonb_to_recordset($1::jsonb) as item(
                 id text,
                 order_id text,
                 product_id text,
                 product_name text,
                 product_image text,
                 unit_price numeric,
                 quantity integer,
                 line_total numeric
               )`,
              [JSON.stringify(itemRows.map((itemRow) => ({
                id: itemRow.id,
                order_id: itemRow.orderId,
                product_id: itemRow.productId,
                product_name: itemRow.productName,
                product_image: itemRow.productImage,
                unit_price: itemRow.unitPrice,
                quantity: itemRow.quantity,
                line_total: itemRow.lineTotal,
              })))],
            );
          }

          const customerUpsertResult = await connection.query(
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
               $1, $2, $3, $4, $5, $6, 1, $7, $8::timestamptz
             )
             on conflict (store_id, customer_key) do update
             set customer_name = excluded.customer_name,
                 customer_phone = excluded.customer_phone,
                 order_count = catalog_order_customers.order_count + 1,
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
              existingCustomer?.id || createCustomerProfileId(),
              normalizedOrder.storeId,
              customerKey,
              customerName,
              normalizedOrder.customerPhone,
              discountPercent,
              insertedOrder.id,
              insertedOrder.created_at,
            ],
          );
          mappedCustomer = mapCustomerProfileRow(customerUpsertResult.rows[0] || null);
          break;
        } catch (error) {
          if (error.code === "23505" && attempt < 4) {
            continue;
          }
          throw error;
        }
      }

      if (!insertedOrder) {
        throw new Error("Nao foi possivel gerar um codigo unico para a encomenda.");
      }

      const mappedItems = itemRows.map((item) =>
        mapOrderItem({
          id: item.id,
          order_id: insertedOrder.id,
          product_id: item.productId,
          product_name: item.productName,
          product_image: item.productImage,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          line_total: item.lineTotal,
          created_at: insertedOrder.created_at,
        }),
      );

      const mappedOrder = mapOrder(insertedOrder, {
        items: mappedItems,
        store: mapOrderStore(store),
        customer: mappedCustomer,
      });

      await registerNewOrderStats(connection, normalizedOrder.storeId, "pending");

      const trackingUrl = buildTrackingUrl(event, mappedOrder.trackingToken, appBaseUrl);
      const notificationCapability = getMerchantOrderWhatsAppCapability(store);
      let merchantNotification = buildMerchantNotificationFallback(
        notificationCapability,
        trackingUrl,
      );

      if (notificationCapability.enabled) {
        await enqueueNotificationJob(connection, {
          type: MERCHANT_ORDER_WHATSAPP_JOB,
          payload: buildMerchantNotificationPayload(appBaseUrl, store, mappedOrder, mappedItems),
        });
        merchantNotification = createQueuedMerchantNotificationResult({ trackingUrl });
      }

      await connection.query("commit");

      return jsonResponse(200, {
        ok: true,
        order: mappedOrder,
        merchantNotification,
      });
    } catch (error) {
      await connection.query("rollback");
      return jsonResponse(500, { error: error.message || "Nao foi possivel gravar a encomenda." });
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
