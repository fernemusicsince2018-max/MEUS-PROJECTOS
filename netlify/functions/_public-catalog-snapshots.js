import { createPublicCatalogEtag } from "./_catalog-cache.js";

function cleanText(value) {
  return String(value ?? "").trim();
}

function toMoney(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function toNumberOrNull(value) {
  if (value === "" || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function compareText(left, right) {
  return cleanText(left).localeCompare(cleanText(right), "pt", { sensitivity: "base" });
}

function serializePublicStoreReview(entry = {}) {
  return {
    id: cleanText(entry?.id),
    orderId: cleanText(entry?.orderId),
    rating: Math.max(0, Math.min(5, Number(entry?.rating || 0))),
    comment: cleanText(entry?.comment),
    customerLabel: cleanText(entry?.customerLabel),
    createdAt: entry?.createdAt || null,
    updatedAt: entry?.updatedAt || null,
    isFeatured: entry?.isFeatured === true,
    featuredAt: entry?.featuredAt || null,
  };
}

function buildPublicCatalogStoreSnapshot(store = {}) {
  const snapshot = {
    name: cleanText(store.name),
    description: cleanText(store.description),
    whatsapp: cleanText(store.whatsapp),
    logo: cleanText(store.logo),
    color: cleanText(store.color) || "#16a34a",
    currencyCode: cleanText(store.currencyCode) || "AOA",
    pickupNote: cleanText(store.pickupNote),
    whatsappOrderFormat: cleanText(store.whatsappOrderFormat) || "text_only",
    publicEnabled: Boolean(store.publicEnabled),
    publicSlug: cleanText(store.publicSlug),
    customDomain: cleanText(store.customDomain),
  };

  if (store.reviewSummary && typeof store.reviewSummary === "object") {
    snapshot.reviewSummary = {
      averageRating: toMoney(store.reviewSummary.averageRating),
      totalReviews: Math.max(0, Number(store.reviewSummary.totalReviews || 0)),
      testimonialCount: Math.max(0, Number(store.reviewSummary.testimonialCount || 0)),
      featuredCount: Math.max(0, Number(store.reviewSummary.featuredCount || 0)),
      distribution: {
        1: Math.max(0, Number(store.reviewSummary.distribution?.[1] || 0)),
        2: Math.max(0, Number(store.reviewSummary.distribution?.[2] || 0)),
        3: Math.max(0, Number(store.reviewSummary.distribution?.[3] || 0)),
        4: Math.max(0, Number(store.reviewSummary.distribution?.[4] || 0)),
        5: Math.max(0, Number(store.reviewSummary.distribution?.[5] || 0)),
      },
    };
  }

  if (Array.isArray(store.testimonials)) {
    snapshot.testimonials = store.testimonials
      .map(serializePublicStoreReview)
      .filter((entry) => entry.id && entry.rating > 0 && entry.comment);
  }

  if (Array.isArray(store.featuredTestimonials)) {
    snapshot.featuredTestimonials = store.featuredTestimonials
      .map(serializePublicStoreReview)
      .filter((entry) => entry.id && entry.rating > 0 && entry.comment);
  }

  if (Array.isArray(store.recentTestimonials)) {
    snapshot.recentTestimonials = store.recentTestimonials
      .map(serializePublicStoreReview)
      .filter((entry) => entry.id && entry.rating > 0 && entry.comment);
  }

  return snapshot;
}

function buildPublicCatalogProductSnapshot(product = {}) {
  const images = Array.isArray(product.images)
    ? product.images.map((entry) => cleanText(entry)).filter(Boolean).slice(0, 4)
    : [];

  return {
    id: cleanText(product.id),
    name: cleanText(product.name),
    description: cleanText(product.description),
    price: toMoney(product.price),
    compareAt: toMoney(product.compareAt),
    image: cleanText(product.image) || images[0] || "",
    images,
    category: cleanText(product.category),
    stock: toNumberOrNull(product.stock),
    featured: Boolean(product.featured),
    onPromotion: Boolean(product.onPromotion),
    available: product.available === false ? false : true,
  };
}

function sortPublicCatalogProducts(products = []) {
  return [...products].sort((left, right) => {
    const categoryComparison = compareText(left?.category, right?.category);
    if (categoryComparison !== 0) return categoryComparison;

    const nameComparison = compareText(left?.name, right?.name);
    if (nameComparison !== 0) return nameComparison;

    return compareText(left?.id, right?.id);
  });
}

function buildPublicCatalogSnapshotPayload({ id = "", store = {}, products = [] } = {}) {
  return {
    id: cleanText(id),
    store: buildPublicCatalogStoreSnapshot(store),
    products: sortPublicCatalogProducts(products).map(buildPublicCatalogProductSnapshot),
  };
}

function createPublicCatalogSnapshotBody(input = {}) {
  return JSON.stringify(buildPublicCatalogSnapshotPayload(input));
}

function hydratePublicCatalogSnapshotBody(snapshotBody, supportWhatsApp = "") {
  const parsed = JSON.parse(String(snapshotBody || "{}"));
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  return {
    id: cleanText(parsed.id),
    store: {
      ...(parsed.store && typeof parsed.store === "object" ? parsed.store : {}),
      supportWhatsApp: cleanText(supportWhatsApp),
    },
    products: Array.isArray(parsed.products) ? parsed.products : [],
  };
}

async function upsertPublicCatalogSnapshot(queryable, input = {}) {
  const storeId = cleanText(input.storeId || input.id);
  if (!storeId) return { body: "", etag: "" };

  const body = createPublicCatalogSnapshotBody({
    id: storeId,
    store: input.store,
    products: input.products,
  });
  const etag = createPublicCatalogEtag(body);

  await queryable.query(
    `insert into catalog_public_snapshots (
       store_id,
       response_body
     ) values ($1, $2)
     on conflict (store_id) do update set
       response_body = excluded.response_body,
       updated_at = now()`,
    [storeId, body],
  );

  return { body, etag };
}

export {
  buildPublicCatalogProductSnapshot,
  buildPublicCatalogSnapshotPayload,
  buildPublicCatalogStoreSnapshot,
  createPublicCatalogSnapshotBody,
  hydratePublicCatalogSnapshotBody,
  sortPublicCatalogProducts,
  upsertPublicCatalogSnapshot,
};
