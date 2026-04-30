import { PRODUCT_DEFAULTS, STORE_DEFAULTS } from "../constants.js";
import { getFulfillmentLabel } from "./orderOptions.js";
import { fmtMoney, parseMoney } from "./format.js";
import { normalizeHostname, normalizeStorefrontSlug } from "../../../shared/storefront.js";

function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}

function cleanImageValue(value) {
  return String(value || "").trim();
}

function normalizeWhatsAppOrderFormat(value) {
  return String(value || "").trim().toLowerCase() === "with_image_links"
    ? "with_image_links"
    : "text_only";
}

function getShareableImageUrl(value) {
  const image = cleanImageValue(value);
  if (/^https?:\/\//i.test(image)) return image;
  if (/^\//.test(image) && typeof window !== "undefined") {
    return `${window.location.origin}${image}`;
  }

  return "";
}

function normalizeProductGallery(product = {}) {
  const source = asRecord(product);
  const gallery = [];
  const rawImages = Array.isArray(source.images)
    ? source.images
    : typeof source.images === "string" && source.images.trim()
      ? [source.images]
      : [];

  for (const candidate of rawImages) {
    const image = cleanImageValue(candidate);
    if (image && !gallery.includes(image)) {
      gallery.push(image);
    }
  }

  const fallbackImage = cleanImageValue(source.image);
  if (fallbackImage && !gallery.includes(fallbackImage)) {
    gallery.unshift(fallbackImage);
  }

  return gallery.slice(0, 4);
}

export function normalizeStore(store = {}) {
  const normalized = { ...STORE_DEFAULTS, ...asRecord(store) };
  return {
    ...normalized,
    whatsappOrderFormat: normalizeWhatsAppOrderFormat(normalized.whatsappOrderFormat),
    publicEnabled: normalized.publicEnabled === true || normalized.publicEnabled === "true",
    publicSlug: normalizeStorefrontSlug(normalized.publicSlug),
    customDomain: normalizeHostname(normalized.customDomain),
  };
}

export function normalizeProduct(product = {}) {
  const source = asRecord(product);
  const price = parseMoney(source.price);
  const compareAt = parseMoney(source.compareAt);
  const stock =
    source.stock === "" || source.stock == null
      ? ""
      : Math.max(0, Math.floor(Number(source.stock) || 0));
  const images = normalizeProductGallery(source);

  return {
    ...PRODUCT_DEFAULTS,
    ...source,
    price,
    compareAt,
    image: images[0] || "",
    images,
    stock,
    featured: Boolean(source.featured),
    onPromotion: Boolean(source.onPromotion) || (compareAt > price && price > 0),
    available: source.available !== false,
  };
}

export function normalizeProducts(products = []) {
  return Array.isArray(products) ? products.map(normalizeProduct) : [];
}

export function getNameInitials(name = "", fallback = "FG") {
  const tokens = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!tokens.length) return fallback;

  return tokens
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() || "")
    .join("");
}

export function createDisplayBrand(brand, store) {
  const storeName = store?.name?.trim();
  const storeDescription = store?.description?.trim();

  return {
    ...brand,
    name: storeName || brand.name,
    tagline: storeDescription || brand.tagline,
    accent: store?.color || brand.accent,
    logoUrl: store?.logo || brand.logoUrl,
    initials: storeName ? getNameInitials(storeName, brand.initials || "FG") : brand.initials,
  };
}

function isPlanDateExpired(value) {
  if (!value) return false;

  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) return false;

  const expiryDay = new Date(expiresAt.getFullYear(), expiresAt.getMonth(), expiresAt.getDate()).getTime();
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return expiryDay < todayDay;
}

export function getPlanAccessState(planStatus, planExpiresAt) {
  const normalizedStatus = String(planStatus || "").trim().toLowerCase();
  const expired = isPlanDateExpired(planExpiresAt);

  if (normalizedStatus === "active") {
    if (!expired) {
      return { allowed: true, message: "" };
    }

    return {
      allowed: false,
      message: "O teu plano terminou. Ativa um plano para voltar a receber clientes e gerir produtos.",
    };
  }

  if (normalizedStatus === "trial") {
    if (!expired) {
      return { allowed: true, message: "" };
    }

    return {
      allowed: false,
      message: "O teu periodo de teste terminou. Ativa um plano para voltar a receber clientes e adicionar produtos.",
    };
  }

  if (normalizedStatus === "past_due") {
    return {
      allowed: false,
      message: "O teu plano esta em atraso. Regulariza ou ativa um plano para voltar a receber clientes e gerir produtos.",
    };
  }

  if (normalizedStatus === "canceled") {
    return {
      allowed: false,
      message: "O teu plano foi cancelado. Ativa um plano para voltar a receber clientes e gerir produtos.",
    };
  }

  return {
    allowed: false,
    message: "Ativa um plano para deixar a tua loja ativa ao cliente e voltar a gerir produtos.",
  };
}

export function calculatePlanTotalPrice(basePrice, durationDays) {
  const price = Number(basePrice);
  const safeDurationDays = Number(durationDays);
  if (!Number.isFinite(price) || price < 0) return 0;
  if (!Number.isFinite(safeDurationDays) || safeDurationDays < 30) return 0;
  return price * (safeDurationDays / 30);
}

function createDurationOption(value, label) {
  return {
    value: Number(value),
    label,
  };
}

export function isPaidMerchantPlan(plan = {}) {
  return Number(plan?.priceMonthly) > 0;
}

export function getMerchantPlanDurationOptions(plan = {}) {
  const code = String(plan?.code || "").trim().toLowerCase();
  const name = String(plan?.name || "").trim().toLowerCase();
  const combined = `${code} ${name}`.trim();

  if (code === "starter" || name.includes("starter")) {
    return [
      createDurationOption(30, "30 dias"),
      createDurationOption(60, "60 dias"),
    ];
  }

  if (code === "pro" || /\bpro\b/.test(combined)) {
    return [
      createDurationOption(90, "90 dias"),
      createDurationOption(120, "120 dias"),
      createDurationOption(150, "150 dias"),
    ];
  }

  if (code === "scale" || name.includes("scale")) {
    return [
      createDurationOption(180, "6 meses"),
      createDurationOption(360, "12 meses"),
    ];
  }

  return [
    createDurationOption(30, "30 dias"),
    createDurationOption(60, "60 dias"),
    createDurationOption(90, "90 dias"),
  ];
}

export function buildPlanActivationLink({
  supportWhatsApp,
  storeName,
  referenceId,
  storeId,
  planName,
  durationDays,
  totalPrice,
  currencyCode,
  merchantEmail,
}) {
  const supportNumber = String(supportWhatsApp || "").replace(/\D/g, "");
  if (!supportNumber) return "";

  const displayId = referenceId || String(storeId || "").slice(0, 8).toUpperCase();
  const details = [
    `Ola! Gostaria de ativar um plano para a minha loja: ${storeName || "Minha Loja"}. (ID: ${displayId})`,
  ];

  if (planName) {
    details.push(`Plano pretendido: ${planName}`);
  }

  if (Number.isFinite(Number(durationDays)) && Number(durationDays) >= 30) {
    details.push(`Duracao pretendida: ${Number(durationDays)} dias`);
  }

  if (Number.isFinite(Number(totalPrice)) && Number(totalPrice) > 0) {
    details.push(`Valor estimado: ${fmtMoney(totalPrice, currencyCode || "AOA")}`);
  }

  if (merchantEmail) {
    details.push(`Email da conta: ${String(merchantEmail).trim()}`);
  }

  const message = encodeURIComponent(details.join("\n"));
  return `https://wa.me/${supportNumber}?text=${message}`;
}

export function createProductDraft(product) {
  const normalized = normalizeProduct(product);
  return {
    ...PRODUCT_DEFAULTS,
    ...normalized,
    price: normalized.price ? String(normalized.price).replace(".", ",") : "",
    compareAt: normalized.compareAt ? String(normalized.compareAt).replace(".", ",") : "",
    stock: normalized.stock === "" ? "" : String(normalized.stock),
  };
}

export function getProductGallery(product) {
  return normalizeProductGallery(product);
}

export function isProductOnPromotion(product) {
  return Boolean(product?.onPromotion) || getDiscountPercent(product) > 0;
}

export function hasLimitedStock(product) {
  return product?.stock !== "" && Number.isFinite(Number(product?.stock));
}

export function getMaxQty(product) {
  if (!product || product.available === false) return 0;
  return hasLimitedStock(product) ? Math.max(0, Number(product.stock)) : Infinity;
}

export function isSoldOut(product) {
  return getMaxQty(product) < 1;
}

export function getDiscountPercent(product) {
  if (!product?.compareAt || product.compareAt <= product.price || product.price <= 0) return 0;
  return Math.round((1 - product.price / product.compareAt) * 100);
}

export function getProductBadge(product) {
  if (product.available === false) return { label: "Indisponivel", bg: "#fee2e2", color: "#b91c1c" };
  if (hasLimitedStock(product) && Number(product.stock) === 0) return { label: "Sem stock", bg: "#fee2e2", color: "#b91c1c" };
  if (hasLimitedStock(product) && Number(product.stock) <= 3) return { label: `Ultimas ${product.stock}`, bg: "#fff7ed", color: "#c2410c" };
  if (product.featured) return { label: "Destaque", bg: "#fef3c7", color: "#b45309" };
  return { label: "Disponivel", bg: "#dcfce7", color: "#166534" };
}

export function buildWaMsg(store, cart, orderMeta, orderContext = {}) {
  const currencyCode = store?.currencyCode || "AOA";
  const whatsappOrderFormat = normalizeWhatsAppOrderFormat(store?.whatsappOrderFormat);
  const lines = cart.flatMap((item) => {
    const itemLines = [
      `- ${item.qty}x ${item.name}`,
      `  Preco unitario: ${fmtMoney(item.price, currencyCode)}`,
      `  Subtotal: ${fmtMoney(item.price * item.qty, currencyCode)}`,
    ];

    const shareableImageUrl = getShareableImageUrl(item.image);
    if (whatsappOrderFormat === "with_image_links" && shareableImageUrl) {
      itemLines.push(`  Imagem: ${shareableImageUrl}`);
    }

    return itemLines;
  });
  const fallbackSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const subtotalAmount = Number(orderContext?.subtotalAmount ?? fallbackSubtotal) || 0;
  const discountPercent = Math.max(0, Math.min(100, Number(orderContext?.discountPercent || 0) || 0));
  const discountAmount = Number(orderContext?.discountAmount || 0) || 0;
  const totalAmount = Number(orderContext?.totalAmount ?? Math.max(0, subtotalAmount - discountAmount)) || 0;
  const extra = [];
  const location = [orderMeta.area?.trim(), orderMeta.province?.trim()].filter(Boolean).join(", ");
  const preferredFulfillment = getFulfillmentLabel(orderMeta.fulfillmentType);
  const trackingCode = String(orderContext?.trackingCode || "").trim();
  const trackingUrl = String(orderContext?.trackingUrl || "").trim();
  const customerPhone = String(orderContext?.customerPhone || orderMeta.customerPhone || "").replace(/\D/g, "");

  if (trackingCode) extra.push(`Codigo do pedido: ${trackingCode}`);
  if (orderMeta.customerName.trim()) extra.push(`Cliente: ${orderMeta.customerName.trim()}`);
  if (customerPhone) extra.push(`Telefone: ${customerPhone}`);
  if (preferredFulfillment) extra.push(`Recebimento: ${preferredFulfillment}`);
  if (location) extra.push(`Localidade: ${location}`);
  if (orderMeta.pickupTime?.trim()) extra.push(`Horario de retirada: ${orderMeta.pickupTime.trim()}`);
  if (orderMeta.deliveryTime?.trim()) extra.push(`Horario de entrega: ${orderMeta.deliveryTime.trim()}`);
  if (store.pickupNote.trim()) extra.push(`Entrega/retirada: ${store.pickupNote.trim()}`);
  if (orderMeta.notes.trim()) extra.push(`Observacoes: ${orderMeta.notes.trim()}`);
  if (trackingUrl) extra.push(`Acompanhar pedido: ${trackingUrl}`);

  return encodeURIComponent(
    [
      `*Pedido - ${store.name || "Minha Loja"}*`,
      ...extra,
      "",
      ...lines,
      "",
      discountAmount > 0 ? `Subtotal: ${fmtMoney(subtotalAmount, currencyCode)}` : null,
      discountAmount > 0 ? `Desconto fidelidade (${discountPercent.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%): -${fmtMoney(discountAmount, currencyCode)}` : null,
      `*Total: ${fmtMoney(totalAmount, currencyCode)}*`,
      "",
      "Aguardo confirmacao.",
    ].filter(Boolean).join("\n"),
  );
}
