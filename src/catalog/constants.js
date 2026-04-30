export const STORE_DEFAULTS = {
  name: "",
  description: "",
  whatsapp: "",
  logo: "",
  color: "#25ae82",
  currencyCode: "AOA",
  pickupNote: "",
  whatsappOrderFormat: "text_only",
  publicEnabled: false,
  legalName: "",
  taxId: "",
  businessEmail: "",
  businessPhone: "",
  addressLine: "",
  city: "",
  country: "",
  publicSlug: "",
  customDomain: "",
};

export const PRODUCT_DEFAULTS = {
  id: "",
  name: "",
  description: "",
  price: 0,
  compareAt: 0,
  image: "",
  images: [],
  category: "",
  stock: "",
  featured: false,
  onPromotion: false,
  available: true,
};

export const PALETTE = ["#25ae82", "#2563eb", "#dc2626", "#ea580c", "#9333ea", "#0891b2", "#be185d", "#ca8a04", "#475569"];

export const STORE_CURRENCY_OPTIONS = [
  { value: "AOA", label: "Kz - Kwanza angolano", symbol: "Kz" },
  { value: "BRL", label: "R$ - Real brasileiro", symbol: "R$" },
  { value: "USD", label: "$ - Dolar americano", symbol: "$" },
  { value: "EUR", label: "EUR - Euro", symbol: "EUR" },
];

export const WHATSAPP_ORDER_FORMAT_OPTIONS = [
  { value: "text_only", label: "Pedido escrito com quantidades e precos" },
  { value: "with_image_links", label: "Pedido escrito + links publicos das imagens" },
];

export const PASSWORD_POLICY_HINT = "Minimo 10 caracteres, com letra maiuscula, minuscula e numero.";

export const FIELD_STYLE = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "var(--border-radius-md)",
  border: "0.5px solid var(--color-border-tertiary)",
  background: "var(--color-background-primary)",
  color: "var(--color-text-primary)",
  fontSize: "13px",
  lineHeight: 1.4,
  boxSizing: "border-box",
};

export const TEXTAREA_STYLE = {
  ...FIELD_STYLE,
  minHeight: "88px",
  resize: "vertical",
};

export const SURFACE_STYLE = {
  background: "var(--color-background-primary)",
  border: "0.5px solid var(--color-border-tertiary)",
  borderRadius: "var(--border-radius-lg)",
};
