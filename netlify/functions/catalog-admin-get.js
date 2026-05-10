import { getSessionContext } from "./_auth.js";
import { ensureDatabaseReady, getPool, jsonResponse, mapProduct, mapStore, withCors } from "./_postgres.js";
import { getSystemSettings } from "./_settings.js";
import { getCatalogStorePaymentColumnAvailability, getCatalogStorePaymentSelectFragments } from "./_store-payment-columns.js";

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const session = await getSessionContext(event);
    if (!session?.storeId || !session?.userId) {
      return jsonResponse(401, { error: "Precisas de iniciar sessao para consultar os dados da empresa." });
    }

    const requestedId = event.queryStringParameters?.id;
    if (requestedId && requestedId !== session.storeId) {
      return jsonResponse(403, { error: "Nao tens permissao para consultar esta loja." });
    }

    const pool = getPool();
    const systemSettings = await getSystemSettings(pool);
    const paymentColumns = await getCatalogStorePaymentColumnAvailability(pool);
    const paymentSelectSql = getCatalogStorePaymentSelectFragments(paymentColumns).join(",\n         ");
    const stores = await pool.query(
      `select
         id,
         owner_user_id,
         name,
         description,
         whatsapp,
         logo,
         color,
         currency_code,
         pickup_note,
         public_enabled,
         whatsapp_order_format,
         legal_name,
         tax_id,
         business_email,
         business_phone,
         address_line,
         city,
         country,
         ${paymentSelectSql},
         public_slug,
         custom_domain
        from catalog_stores
       where id = $1
         and owner_user_id = $2
         and deleted_at is null
       limit 1`,
      [session.storeId, session.userId],
    );

    if (!stores.rows.length) {
      return jsonResponse(404, { error: "Loja nao encontrada." });
    }

    const products = await pool.query(
      `select id, catalog_id, name, description, price, compare_at, image, images, category, stock, featured, on_promotion, available
       from catalog_products
       where catalog_id = $1
       order by category asc, name asc`,
      [session.storeId],
    );

    return jsonResponse(200, {
      id: session.storeId,
      store: {
        ...mapStore(stores.rows[0], { includeBusinessData: true }),
        supportWhatsApp: systemSettings.supportWhatsApp,
        trialDays: systemSettings.trialDays,
        maxFreeProducts: systemSettings.maxFreeProducts,
      },
      products: products.rows.map(mapProduct),
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["GET"] });
