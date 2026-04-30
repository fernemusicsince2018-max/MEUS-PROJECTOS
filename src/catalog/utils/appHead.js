function upsertMeta(selector, attributes, content) {
  if (typeof document === "undefined" || !selector) return;

  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    Object.entries(attributes || {}).forEach(([key, value]) => {
      node.setAttribute(key, value);
    });
    document.head.appendChild(node);
  }

  node.setAttribute("content", String(content || ""));
}

function upsertLink(selector, attributes, href) {
  if (typeof document === "undefined" || !selector || !href) return;

  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("link");
    Object.entries(attributes || {}).forEach(([key, value]) => {
      node.setAttribute(key, value);
    });
    document.head.appendChild(node);
  }

  node.setAttribute("href", String(href));
}

export function syncAppHead({
  title,
  description,
  themeColor = "#1c9a74",
  appTitle,
  canonicalUrl = "",
  imageUrl = "",
  robots = "",
}) {
  if (typeof document === "undefined") return;

  const safeTitle = String(title || appTitle || "Catalogo");
  const safeDescription = String(
    description || "Sua loja no WhatsApp com catalogo digital, pedidos e painel do lojista.",
  );
  const safeAppTitle = String(appTitle || safeTitle).slice(0, 60);

  document.title = safeTitle;

  upsertMeta('meta[name="description"]', { name: "description" }, safeDescription);
  upsertMeta('meta[name="theme-color"]', { name: "theme-color" }, themeColor);
  upsertMeta(
    'meta[name="apple-mobile-web-app-title"]',
    { name: "apple-mobile-web-app-title" },
    safeAppTitle,
  );
  upsertMeta('meta[property="og:type"]', { property: "og:type" }, "website");
  upsertMeta('meta[property="og:title"]', { property: "og:title" }, safeTitle);
  upsertMeta('meta[property="og:description"]', { property: "og:description" }, safeDescription);
  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, safeTitle);
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, safeDescription);
  if (robots) {
    upsertMeta('meta[name="robots"]', { name: "robots" }, robots);
  }

  if (canonicalUrl) {
    upsertLink('link[rel="canonical"]', { rel: "canonical" }, canonicalUrl);
    upsertMeta('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
  }

  if (imageUrl) {
    upsertMeta('meta[property="og:image"]', { property: "og:image" }, imageUrl);
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image" }, imageUrl);
  }
}
