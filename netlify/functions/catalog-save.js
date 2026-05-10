import { randomUUID } from "node:crypto";
import { getPlanAccessState, getSessionContext } from "./_auth.js";
import { invalidatePublicCatalogCache } from "./_catalog-cache.js";
import { getCatalogIdentityConflictMessage } from "./_identity-errors.js";
import { lockCatalogIdentities } from "./_identity-locks.js";
import { sortPublicCatalogProducts, upsertPublicCatalogSnapshot } from "./_public-catalog-snapshots.js";
import { ensureDatabaseReady, getPool, jsonResponse, mapProduct, withCors } from "./_postgres.js";
import { getSystemSettings } from "./_settings.js";
import { buildCatalogStorePaymentUpsertFragments, getCatalogStorePaymentColumnAvailability } from "./_store-payment-columns.js";
import { materializePublicImageAsset } from "./_storage.js";
import { attachPublicStoreReviews } from "./_store-reviews.js";
import { normalizeProductImageCollection, normalizeStoreLogo } from "./_security.js";
import { getStoreFieldMeta, normalizeIdentityForLookup, validateBusinessEmail, validatePhoneForCountry, validateTaxIdForCountry, validateWhatsAppForCountry } from "./_store-validation.js";
import { normalizeHostname, normalizeStorefrontSlug, validateCustomDomain, validateStorefrontSlug } from "../../shared/storefront.js";

const DEFAULT_STORE_COLOR = "#16a34a";
const DEFAULT_CURRENCY_CODE = "AOA";
const DEFAULT_WHATSAPP_ORDER_FORMAT = "text_only";
const ALLOWED_CURRENCY_CODES = new Set(["AOA", "BRL", "USD", "EUR"]);
const ALLOWED_WHATSAPP_ORDER_FORMATS = new Set(["text_only", "with_image_links"]);
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function cleanText(value, maxLength = null) {
  const text = String(value ?? "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function normalizeColor(value) {
  const text = cleanText(value, 16);
  return HEX_COLOR_RE.test(text) ? text : DEFAULT_STORE_COLOR;
}

function normalizeMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Number.NaN;
  return Number(numeric.toFixed(2));
}

function normalizeStock(value) {
  if (value === "" || value == null) return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return Number.NaN;

  return Math.floor(numeric);
}

function normalizeCurrencyCode(value) {
  const currencyCode = cleanText(value, 3).toUpperCase();
  return currencyCode || DEFAULT_CURRENCY_CODE;
}

function normalizeWhatsAppOrderFormat(value) {
  const format = cleanText(value, 32).toLowerCase();
  return ALLOWED_WHATSAPP_ORDER_FORMATS.has(format) ? format : DEFAULT_WHATSAPP_ORDER_FORMAT;
}

function normalizeStoreInput(store = {}) {
  const logoResult = normalizeStoreLogo(store.logo, "O logo da loja");
  if (logoResult.error) {
    return { error: logoResult.error };
  }

  const country = cleanText(store.country, 120);
  const phoneResult = validateWhatsAppForCountry(country, store.whatsapp, "O WhatsApp");
  if (phoneResult.error) {
    return { error: phoneResult.error };
  }

  const businessPhoneResult = validatePhoneForCountry(country, store.businessPhone, "O telefone da empresa");
  if (businessPhoneResult.error) {
    return { error: businessPhoneResult.error };
  }

  const businessEmailResult = validateBusinessEmail(cleanText(store.businessEmail, 255), "O email comercial");
  if (businessEmailResult.error) {
    return { error: businessEmailResult.error };
  }

  const fieldMeta = getStoreFieldMeta(country);
  const taxIdResult = validateTaxIdForCountry(country, cleanText(store.taxId, 64), fieldMeta.taxLabel);
  if (taxIdResult.error) {
    return { error: taxIdResult.error };
  }

  const normalized = {
    name: cleanText(store.name, 160),
    description: cleanText(store.description),
    whatsapp: phoneResult.normalized,
    logo: logoResult.value,
    color: normalizeColor(store.color),
    currencyCode: normalizeCurrencyCode(store.currencyCode),
    pickupNote: cleanText(store.pickupNote, 255),
    whatsappOrderFormat: normalizeWhatsAppOrderFormat(store.whatsappOrderFormat),
    legalName: cleanText(store.legalName, 180),
    taxId: taxIdResult.normalized,
    businessEmail: businessEmailResult.normalized,
    businessPhone: businessPhoneResult.normalized,
    addressLine: cleanText(store.addressLine, 255),
    city: cleanText(store.city, 120),
    country,
    paymentMethod: cleanText(store.paymentMethod, 80),
    paymentBankName: cleanText(store.paymentBankName, 160),
    paymentAccountName: cleanText(store.paymentAccountName, 160),
    paymentAccountNumber: cleanText(store.paymentAccountNumber, 80),
    paymentIban: cleanText(store.paymentIban, 80),
    publicSlug: normalizeStorefrontSlug(store.publicSlug),
    customDomain: normalizeHostname(store.customDomain),
    publicEnabled: Boolean(store.publicEnabled),
  };

  if (!normalized.name) {
    return { error: "Indica o nome da loja." };
  }

  if (!ALLOWED_CURRENCY_CODES.has(normalized.currencyCode)) {
    return { error: "Escolhe uma moeda valida." };
  }

  const storefrontSlugResult = validateStorefrontSlug(normalized.publicSlug);
  if (storefrontSlugResult.error) {
    return { error: storefrontSlugResult.error };
  }

  const customDomainResult = validateCustomDomain(normalized.customDomain);
  if (customDomainResult.error) {
    return { error: customDomainResult.error };
  }

  normalized.publicSlug = storefrontSlugResult.normalized;
  normalized.customDomain = customDomainResult.normalized;

  return { value: normalized };
}

function normalizeProductsInput(products = []) {
  if (!Array.isArray(products)) {
    return { error: "A lista de produtos deve ser um array." };
  }

  const seenIds = new Set();
  const normalized = [];

  for (const [index, product] of products.entries()) {
    const requestedId = cleanText(product?.id);
    if (requestedId) {
      if (seenIds.has(requestedId)) {
        return { error: "Existem produtos repetidos no pedido." };
      }
      seenIds.add(requestedId);
    }

    const name = cleanText(product?.name, 180);
    if (!name) {
      return { error: `O produto ${index + 1} precisa de um nome.` };
    }

    const price = normalizeMoney(product?.price);
    if (!Number.isFinite(price) || price <= 0) {
      return { error: `O produto ${index + 1} precisa de um preco valido.` };
    }

    const compareAt =
      product?.compareAt === "" || product?.compareAt == null ? 0 : normalizeMoney(product.compareAt);
    if (!Number.isFinite(compareAt) || compareAt < 0) {
      return { error: `O produto ${index + 1} tem um preco antigo invalido.` };
    }

    if (compareAt > 0 && compareAt <= price) {
      return { error: `O produto ${index + 1} tem um preco antigo que deve ser maior do que o atual.` };
    }

    const requestedImages = [
      ...((Array.isArray(product?.images) ? product.images : []).filter(Boolean)),
      ...(product?.image ? [product.image] : []),
    ];
    const imageResult = normalizeProductImageCollection(requestedImages, `O produto ${index + 1}`);
    if (imageResult.error) {
      return { error: imageResult.error };
    }

    const stock = normalizeStock(product?.stock);
    if (Number.isNaN(stock)) {
      return { error: `O produto ${index + 1} tem um stock invalido.` };
    }

    const images = imageResult.value;
    const onPromotion = product?.onPromotion === true || product?.onPromotion === "true" || compareAt > price;

    normalized.push({
      id: requestedId,
      name,
      description: cleanText(product?.description),
      price,
      compareAt,
      image: images[0] || "",
      images,
      category: cleanText(product?.category, 120),
      stock,
      featured: Boolean(product?.featured),
      onPromotion,
      available: product?.available === false ? false : true,
    });
  }

  return { value: normalized };
}

function serializeComparableProduct(product = {}) {
  return JSON.stringify({
    id: cleanText(product.id),
    name: cleanText(product.name, 180),
    description: cleanText(product.description),
    price: Number(product.price || 0),
    compareAt: Number(product.compareAt || 0),
    image: cleanText(product.image),
    images: Array.isArray(product.images)
      ? product.images.map((entry) => cleanText(entry)).filter(Boolean).slice(0, 4)
      : [],
    category: cleanText(product.category, 120),
    stock: product.stock === "" || product.stock == null ? null : Math.floor(Number(product.stock) || 0),
    featured: Boolean(product.featured),
    onPromotion: Boolean(product.onPromotion),
    available: product.available === false ? false : true,
  });
}

function haveEquivalentProducts(currentProducts = [], incomingProducts = []) {
  if (currentProducts.length !== incomingProducts.length) {
    return false;
  }

  const left = currentProducts.map(serializeComparableProduct).sort();
  const right = incomingProducts.map(serializeComparableProduct).sort();
  return left.every((entry, index) => entry === right[index]);
}

async function persistStoreAssets(store, catalogId) {
  return {
    ...store,
    logo: await materializePublicImageAsset({
      value: store.logo,
      scope: "store-logos",
      ownerId: catalogId,
      fileName: `${store.name || catalogId}-logo`,
      fieldLabel: "O logo da loja",
    }),
  };
}

async function persistProductAssets(products, catalogId) {
  const nextProducts = [];

  for (const product of products) {
    const persistedImages = [];

    for (const [index, image] of (product.images || []).entries()) {
      const publicImageUrl = await materializePublicImageAsset({
        value: image,
        scope: "product-images",
        ownerId: catalogId,
        fileName: `${product.name || product.id || "produto"}-${index + 1}`,
        fieldLabel: `A imagem ${index + 1} do produto ${product.name || ""}`.trim(),
      });

      if (publicImageUrl && !persistedImages.includes(publicImageUrl)) {
        persistedImages.push(publicImageUrl);
      }
    }

    nextProducts.push({
      ...product,
      image: persistedImages[0] || "",
      images: persistedImages,
    });
  }

  return nextProducts;
}

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const session = await getSessionContext(event);
    if (!session?.storeId || !session?.userId) {
      return jsonResponse(401, { error: "Precisas de iniciar sessao para gerir a loja." });
    }

    const payload = JSON.parse(event.body || "{}");
    const { store = {}, products = [] } = payload;
    const catalogId = session.storeId;
    const normalizedStoreResult = normalizeStoreInput(store);
    if (normalizedStoreResult.error) {
      return jsonResponse(400, { error: normalizedStoreResult.error });
    }

    const normalizedProductsResult = normalizeProductsInput(products);
    if (normalizedProductsResult.error) {
      return jsonResponse(400, { error: normalizedProductsResult.error });
    }

    const normalizedStore = normalizedStoreResult.value;
    const normalizedProducts = normalizedProductsResult.value;
    const persistedStore = await persistStoreAssets(normalizedStore, catalogId);
    const persistedProducts = await persistProductAssets(normalizedProducts, catalogId);
    const normalizedTaxIdLookup = persistedStore.taxId
      ? normalizeIdentityForLookup(persistedStore.taxId)
      : "";
    const phoneIdentityValues = [...new Set([persistedStore.businessPhone, persistedStore.whatsapp].filter(Boolean))];

    const pool = getPool();
    const connection = await pool.connect();

    try {
      await connection.query("begin");
      const paymentColumns = await getCatalogStorePaymentColumnAvailability(connection);
      const systemSettings = await getSystemSettings(connection);
      const planAccess =
        session.role === "super_admin"
          ? { allowed: true, message: "" }
          : getPlanAccessState(session.planStatus, session.planExpiresAt);

      if (!planAccess.allowed) {
        const currentProductsResult = await connection.query(
          `select id, catalog_id, name, description, price, compare_at, image, images, category, stock, featured, on_promotion, available
           from catalog_products
           where catalog_id = $1`,
          [catalogId],
        );

        if (!haveEquivalentProducts(currentProductsResult.rows.map(mapProduct), normalizedProducts)) {
          await connection.query("rollback");
          return jsonResponse(403, { error: planAccess.message });
        }
      }

      if (
        session.role !== "super_admin" &&
        planAccess.allowed &&
        session.planStatus === "trial" &&
        persistedProducts.length > systemSettings.maxFreeProducts
      ) {
        await connection.query("rollback");
        return jsonResponse(403, {
          error: `O plano Trial permite ate ${systemSettings.maxFreeProducts} produtos. Remove alguns itens ou ativa um plano pago.`,
        });
      }

      const identityLocks = [];
      if (persistedStore.businessEmail) {
        identityLocks.push({ scope: "email", value: persistedStore.businessEmail });
      }
      if (normalizedTaxIdLookup) {
        identityLocks.push({ scope: "tax-id", value: normalizedTaxIdLookup });
      }
      for (const phoneValue of phoneIdentityValues) {
        identityLocks.push({ scope: "phone", value: phoneValue });
      }
      if (identityLocks.length) {
        await lockCatalogIdentities(connection, identityLocks);
      }

      if (persistedStore.businessEmail) {
        const emailConflictUser = await connection.query(
          `select id
           from catalog_users
           where deleted_at is null
             and id <> $1
             and lower(email) = lower($2)
           limit 1`,
          [session.userId, persistedStore.businessEmail],
        );

        if (emailConflictUser.rows.length) {
          await connection.query("rollback");
          return jsonResponse(409, {
            error: "Este email ja esta associado a outra conta no sistema.",
          });
        }

        const emailConflictStore = await connection.query(
          `select id
           from catalog_stores
           where deleted_at is null
             and id <> $1
             and lower(business_email) = lower($2)
           limit 1`,
          [catalogId, persistedStore.businessEmail],
        );

        if (emailConflictStore.rows.length) {
          await connection.query("rollback");
          return jsonResponse(409, {
            error: "Este email comercial ja esta a ser usado noutra empresa.",
          });
        }
      }

      if (persistedStore.businessPhone) {
        const businessPhoneConflictStore = await connection.query(
          `select id
           from catalog_stores
           where deleted_at is null
             and id <> $1
             and (business_phone = $2 or whatsapp = $2)
           limit 1`,
          [catalogId, persistedStore.businessPhone],
        );

        if (businessPhoneConflictStore.rows.length) {
          await connection.query("rollback");
          return jsonResponse(409, {
            error: "Este numero de telemovel ja esta a ser usado noutra empresa.",
          });
        }
      }

      if (persistedStore.whatsapp && persistedStore.whatsapp !== persistedStore.businessPhone) {
        const whatsappConflictStore = await connection.query(
          `select id
           from catalog_stores
           where deleted_at is null
             and id <> $1
             and (business_phone = $2 or whatsapp = $2)
           limit 1`,
          [catalogId, persistedStore.whatsapp],
        );

        if (whatsappConflictStore.rows.length) {
          await connection.query("rollback");
          return jsonResponse(409, {
            error: "Este numero de WhatsApp ja esta a ser usado noutra empresa.",
          });
        }
      }

      if (persistedStore.taxId) {
        const taxIdConflictStore = await connection.query(
          `select id
           from catalog_stores
           where deleted_at is null
             and id <> $1
             and lower(regexp_replace(coalesce(tax_id, ''), '[^a-zA-Z0-9]+', '', 'g')) = $2
           limit 1`,
          [catalogId, normalizedTaxIdLookup],
        );

        if (taxIdConflictStore.rows.length) {
          await connection.query("rollback");
          return jsonResponse(409, {
            error: "Este numero fiscal ou documento ja esta registado noutra empresa.",
          });
        }
      }

      if (persistedStore.publicSlug) {
        const storefrontSlugConflict = await connection.query(
          `select id
           from catalog_stores
           where deleted_at is null
             and id <> $1
             and lower(public_slug) = lower($2)
           limit 1`,
          [catalogId, persistedStore.publicSlug],
        );

        if (storefrontSlugConflict.rows.length) {
          await connection.query("rollback");
          return jsonResponse(409, {
            error: "Este subdominio publico ja esta a ser usado noutra loja.",
          });
        }
      }

      if (persistedStore.customDomain) {
        const customDomainConflict = await connection.query(
          `select id
           from catalog_stores
           where deleted_at is null
             and id <> $1
             and lower(custom_domain) = lower($2)
           limit 1`,
          [catalogId, persistedStore.customDomain],
        );

        if (customDomainConflict.rows.length) {
          await connection.query("rollback");
          return jsonResponse(409, {
            error: "Este dominio publico ja esta ligado a outra loja.",
          });
        }
      }

      const baseStoreValues = [
        catalogId,
        session.userId,
        persistedStore.name,
        persistedStore.description,
        persistedStore.whatsapp,
        persistedStore.logo,
        persistedStore.color,
        persistedStore.currencyCode,
        persistedStore.pickupNote,
        persistedStore.publicEnabled,
        persistedStore.whatsappOrderFormat,
        persistedStore.legalName,
        persistedStore.taxId,
        persistedStore.businessEmail,
        persistedStore.businessPhone,
        persistedStore.addressLine,
        persistedStore.city,
        persistedStore.country,
      ];
      const paymentUpsert = buildCatalogStorePaymentUpsertFragments(
        persistedStore,
        paymentColumns,
        baseStoreValues.length + 1,
      );
      const finalStoreValues = [
        ...baseStoreValues,
        ...paymentUpsert.values,
        persistedStore.publicSlug,
        persistedStore.customDomain,
      ];
      const publicSlugPlaceholder = `$${paymentUpsert.nextIndex}`;
      const customDomainPlaceholder = `$${paymentUpsert.nextIndex + 1}`;
      const paymentInsertColumnsSql = paymentUpsert.insertColumns.length
        ? `\n          ${paymentUpsert.insertColumns.join(", ")},`
        : "";
      const paymentValuesSegment = paymentUpsert.valuePlaceholders.length
        ? `, ${paymentUpsert.valuePlaceholders.join(", ")}`
        : "";
      const paymentUpdateAssignmentsSql = paymentUpsert.updateAssignments.length
        ? `,\n          ${paymentUpsert.updateAssignments.join(",\n          ")}`
        : "";

      await connection.query(
        `insert into catalog_stores (
          id, owner_user_id, name, description, whatsapp, logo, color, currency_code, pickup_note, public_enabled,
          whatsapp_order_format, legal_name, tax_id, business_email, business_phone, address_line, city, country,
${paymentInsertColumnsSql}
          public_slug, custom_domain
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18${paymentValuesSegment}, ${publicSlugPlaceholder}, ${customDomainPlaceholder})
        on conflict (id) do update set
          owner_user_id = excluded.owner_user_id,
          name = excluded.name,
          description = excluded.description,
          whatsapp = excluded.whatsapp,
          logo = excluded.logo,
          color = excluded.color,
          currency_code = excluded.currency_code,
          pickup_note = excluded.pickup_note,
          public_enabled = excluded.public_enabled,
          whatsapp_order_format = excluded.whatsapp_order_format,
          legal_name = excluded.legal_name,
          tax_id = excluded.tax_id,
          business_email = excluded.business_email,
          business_phone = excluded.business_phone,
          address_line = excluded.address_line,
          city = excluded.city,
          country = excluded.country,
${paymentUpdateAssignmentsSql}
          public_slug = excluded.public_slug,
          custom_domain = excluded.custom_domain`,
        finalStoreValues,
      );

      const productRows = persistedProducts.map((product) => ({
        id: product.id || randomUUID(),
        name: product.name,
        description: product.description,
        price: product.price,
        compare_at: product.compareAt,
        image: product.image,
        images: product.images || [],
        category: product.category,
        stock: product.stock,
        featured: product.featured,
        on_promotion: product.onPromotion,
        available: product.available,
      }));
      const persistedProductsWithIds = persistedProducts.map((product, index) => ({
        ...product,
        id: productRows[index]?.id || product.id || "",
      }));
      const productIds = productRows.map((product) => product.id);

      if (productRows.length) {
        const upsertResult = await connection.query(
          `with source as (
             select
               item.id::text as id,
               $1::text as catalog_id,
               item.name::varchar(180) as name,
               item.description::text as description,
               item.price::numeric(10, 2) as price,
               item.compare_at::numeric(10, 2) as compare_at,
               item.image::text as image,
               coalesce(item.images, '[]'::jsonb) as images,
               item.category::varchar(120) as category,
               item.stock::integer as stock,
               coalesce(item.featured, false) as featured,
               coalesce(item.on_promotion, false) as on_promotion,
               coalesce(item.available, true) as available
             from jsonb_to_recordset($2::jsonb) as item(
               id text,
               name text,
               description text,
               price numeric,
               compare_at numeric,
               image text,
               images jsonb,
               category text,
               stock integer,
               featured boolean,
               on_promotion boolean,
               available boolean
             )
           )
           insert into catalog_products (
             id,
             catalog_id,
             name,
             description,
             price,
             compare_at,
             image,
             images,
             category,
             stock,
             featured,
             on_promotion,
             available
           )
           select
             id,
             catalog_id,
             name,
             description,
             price,
             compare_at,
             image,
             images,
             category,
             stock,
             featured,
             on_promotion,
             available
           from source
           on conflict (id) do update set
             name = excluded.name,
             description = excluded.description,
             price = excluded.price,
             compare_at = excluded.compare_at,
             image = excluded.image,
             images = excluded.images,
             category = excluded.category,
             stock = excluded.stock,
             featured = excluded.featured,
             on_promotion = excluded.on_promotion,
             available = excluded.available
           where catalog_products.catalog_id = excluded.catalog_id
           returning id`,
          [catalogId, JSON.stringify(productRows)],
        );

        if (upsertResult.rowCount !== productRows.length) {
          throw new Error("Foi detetado um conflito com um produto que pertence a outra loja.");
        }
      }

      if (productIds.length) {
        await connection.query(
          `delete from catalog_products
           where catalog_id = $1
           and not (id = any($2::text[]))`,
          [catalogId, productIds],
        );
      } else {
        await connection.query(`delete from catalog_products where catalog_id = $1`, [catalogId]);
      }

      const enrichedStore = await attachPublicStoreReviews(connection, persistedStore, catalogId);

      await upsertPublicCatalogSnapshot(connection, {
        storeId: catalogId,
        store: enrichedStore,
        products: persistedProductsWithIds,
      });

      await connection.query("commit");
      invalidatePublicCatalogCache(catalogId);
      const responseProducts = sortPublicCatalogProducts(persistedProductsWithIds);

      return jsonResponse(200, {
        ok: true,
        id: catalogId,
        store: {
          ...enrichedStore,
          supportWhatsApp: systemSettings.supportWhatsApp,
          trialDays: systemSettings.trialDays,
          maxFreeProducts: systemSettings.maxFreeProducts,
        },
        products: responseProducts,
      });
    } catch (error) {
      await connection.query("rollback");
      const identityConflictMessage = getCatalogIdentityConflictMessage(error);
      if (identityConflictMessage) {
        return jsonResponse(409, { error: identityConflictMessage });
      }
      return jsonResponse(error.status || 500, { error: error.message || "Falha ao guardar catalogo." });
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
