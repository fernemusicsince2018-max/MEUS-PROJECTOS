import { useEffect, useMemo } from "react";
import { buildAbsoluteAppUrl, buildPublicCatalogPath } from "../utils/appRoutes.js";
import { syncAppHead } from "../utils/appHead.js";
import { createDisplayBrand } from "../utils/catalog.js";
import { buildStorefrontCatalogUrl } from "../../../shared/storefront.js";

const TAB_LABELS = {
  loja: "Loja",
  produtos: "Produtos",
  pedidos: "Pedidos",
  compartilhar: "Partilhar",
};

function humanizeToken(value, fallback) {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildStoreNavigationTitle(storeName, fallback) {
  const normalizedStoreName = String(storeName || "").trim();
  if (!normalizedStoreName) return fallback;
  return `LOJA| ${normalizedStoreName}`;
}

function buildRouteHead({
  screen,
  tab,
  superAdminTab,
  catalogMode,
  store,
  trackedOrder,
  trackingError,
  session,
  blockedCatalog,
  offlineState,
  runtimeBrand,
}) {
  const storeName =
    store?.name
    || trackedOrder?.store?.name
    || blockedCatalog?.store?.name
    || session?.storeName
    || "";
  const canonicalUrl =
    typeof window !== "undefined"
      ? buildAbsoluteAppUrl(`${window.location.pathname}${window.location.search}`)
      : "";

  const themeColor =
    store?.color
    || trackedOrder?.store?.color
    || blockedCatalog?.store?.color
    || runtimeBrand?.accent
    || "#1c9a74";

  switch (screen) {
    case "home":
      return {
        title: runtimeBrand?.name
          ? `${runtimeBrand.name} | Web para clientes e app para lojistas`
          : "Web para clientes e app para lojistas",
        description:
          "Entrada publica da plataforma com catalogos para clientes e painel instalavel para lojistas em /app.",
        themeColor: runtimeBrand?.accent || themeColor,
        appTitle: runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: runtimeBrand?.logoUrl || "",
        robots: "index,follow",
      };
    case "loading":
      return {
        title: buildStoreNavigationTitle(storeName, "A carregar"),
        description: "Estamos a preparar o catalogo e o painel para uma abertura rapida no telemovel.",
        themeColor,
        appTitle: storeName || runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: store?.logo || runtimeBrand?.logoUrl || "",
        robots: "noindex,nofollow",
      };
    case "auth":
      return {
        title: buildStoreNavigationTitle(storeName, "Entrar no painel"),
        description: "Painel mobile-first para gerir a loja, produtos, pedidos e partilha por WhatsApp.",
        themeColor: runtimeBrand?.accent || themeColor,
        appTitle: storeName || runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: runtimeBrand?.logoUrl || "",
        robots: "noindex,nofollow",
      };
    case "admin":
      return {
        title: buildStoreNavigationTitle(storeName, TAB_LABELS[tab] || "Painel do lojista"),
        description:
          store?.description
          || `Gestao mobile da loja${storeName ? ` ${storeName}` : ""} com produtos, pedidos e partilha pronta para PWA.`,
        themeColor,
        appTitle: storeName || runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: store?.logo || runtimeBrand?.logoUrl || "",
        robots: "noindex,nofollow",
      };
    case "superadmin":
      return {
        title: humanizeToken(superAdminTab, "Painel super admin"),
        description: "Controlo central de clientes, planos e configuracoes da plataforma.",
        themeColor: runtimeBrand?.dark || runtimeBrand?.accent || themeColor,
        appTitle: runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: runtimeBrand?.logoUrl || "",
        robots: "noindex,nofollow",
      };
    case "catalog":
      return {
        title: buildStoreNavigationTitle(
          storeName,
          catalogMode === "preview" ? "Preview do catalogo" : "Catalogo",
        ),
        description:
          store?.description
          || `Explora os produtos${storeName ? ` de ${storeName}` : ""}, monta o carrinho e envia o pedido por WhatsApp.`,
        themeColor,
        appTitle: storeName || runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: store?.logo || runtimeBrand?.logoUrl || "",
        robots: catalogMode === "public" ? "index,follow" : "noindex,nofollow",
      };
    case "tracking":
      return {
        title: buildStoreNavigationTitle(
          trackedOrder?.store?.name,
          trackedOrder?.trackingCode ? `Pedido ${trackedOrder.trackingCode}` : "Acompanhar encomenda",
        ),
        description:
          trackedOrder?.store?.name
            ? `Segue o estado mais recente do teu pedido na loja ${trackedOrder.store.name}.`
            : trackingError || "Consulta o estado mais recente da tua encomenda.",
        themeColor,
        appTitle: trackedOrder?.store?.name || runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: trackedOrder?.store?.logo || runtimeBrand?.logoUrl || "",
        robots: "noindex,nofollow",
      };
    case "blocked":
      return {
        title: buildStoreNavigationTitle(
          blockedCatalog?.store?.name,
          "Loja temporariamente indisponivel",
        ),
        description:
          blockedCatalog?.message
          || "Esta vitrine publica esta em pausa enquanto o plano comercial da loja e reativado.",
        themeColor,
        appTitle: blockedCatalog?.store?.name || runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: blockedCatalog?.store?.logo || runtimeBrand?.logoUrl || "",
        robots: "noindex,nofollow",
      };
    case "maintenance":
      return {
        title: buildStoreNavigationTitle(storeName, "Catalogo em manutencao"),
        description: "O acesso publico aos catalogos foi pausado temporariamente pela plataforma.",
        themeColor: runtimeBrand?.dark || runtimeBrand?.accent || themeColor,
        appTitle: storeName || runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: runtimeBrand?.logoUrl || "",
        robots: "noindex,nofollow",
      };
    case "config-required":
      return {
        title: "Configuracao em falta",
        description: "A app precisa da API configurada para abrir este ambiente com seguranca.",
        themeColor: runtimeBrand?.dark || runtimeBrand?.accent || themeColor,
        appTitle: runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: runtimeBrand?.logoUrl || "",
        robots: "noindex,nofollow",
      };
    case "offline":
      return {
        title: buildStoreNavigationTitle(storeName, "Sem ligacao"),
        description:
          offlineState?.message
          || "Esta area precisa de internet ou de uma visita anterior para abrir offline neste dispositivo.",
        themeColor: runtimeBrand?.dark || runtimeBrand?.accent || themeColor,
        appTitle: storeName || runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: runtimeBrand?.logoUrl || "",
        robots: "noindex,nofollow",
      };
    case "notfound":
      return {
        title: "Pagina nao encontrada",
        description: "A rota pedida nao existe ou ja nao esta disponivel.",
        themeColor: runtimeBrand?.dark || runtimeBrand?.accent || themeColor,
        appTitle: runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: runtimeBrand?.logoUrl || "",
        robots: "noindex,nofollow",
      };
    default:
      return {
        title: buildStoreNavigationTitle(storeName, "Catalogo"),
        description: "Sua loja no WhatsApp com catalogo digital, pedidos e painel do lojista.",
        themeColor,
        appTitle: storeName || runtimeBrand?.name || "Catalogo",
        canonicalUrl,
        imageUrl: store?.logo || runtimeBrand?.logoUrl || "",
        robots: "index,follow",
      };
  }
}

export function useAppPresentationController({
  runtimeBrand,
  runtimeConfig,
  store,
  sid,
  screen,
  tab,
  superAdminTab,
  catalogMode,
  trackedOrder,
  trackingError,
  session,
  blockedCatalog,
  offlineState,
  cartCount,
  isOnline,
  storageStatus,
  syncStatus,
  resetOrderExperience,
  setCatalogMode,
  navigateToPath,
  setScreen,
}) {
  const brand = useMemo(() => createDisplayBrand(runtimeBrand, store), [runtimeBrand, store]);
  const catUrl = useMemo(
    () =>
      sid
        ? buildStorefrontCatalogUrl(sid, store, {
            origin:
              typeof window !== "undefined"
                ? window.location.origin
                : buildAbsoluteAppUrl(buildPublicCatalogPath(sid)),
            publicCatalogBaseUrl: runtimeConfig?.publicCatalogBaseUrl,
            publicCatalogBaseDomain: runtimeConfig?.publicCatalogBaseDomain,
          }) || buildAbsoluteAppUrl(buildPublicCatalogPath(sid))
        : "",
    [runtimeConfig?.publicCatalogBaseDomain, runtimeConfig?.publicCatalogBaseUrl, sid, store],
  );
  const connectionState = useMemo(
    () => ({
      isOnline,
      storageMode: storageStatus.mode,
      storageLabel: storageStatus.label,
      syncMode: syncStatus.mode,
      syncAt: syncStatus.timestamp,
      syncSource: syncStatus.source,
    }),
    [isOnline, storageStatus.label, storageStatus.mode, syncStatus.mode, syncStatus.source, syncStatus.timestamp],
  );

  function handleMerchantPreview() {
    if (!sid) return;
    resetOrderExperience();
    setCatalogMode("preview");
    navigateToPath(buildPublicCatalogPath(sid, { preview: true }));
    setScreen("catalog");
  }

  useEffect(() => {
    const toastOffset =
      screen === "admin"
        ? "116px"
        : screen === "catalog" && cartCount > 0
          ? "92px"
          : "24px";
    const installPromptOffset = screen === "admin" ? "108px" : "18px";

    document.documentElement.style.setProperty("--toast-offset", toastOffset);
    document.documentElement.style.setProperty("--install-prompt-offset", installPromptOffset);
  }, [screen, cartCount]);

  useEffect(() => {
    syncAppHead(
      buildRouteHead({
        screen,
        tab,
        superAdminTab,
        catalogMode,
        store,
        trackedOrder,
        trackingError,
        session,
        blockedCatalog,
        offlineState,
        runtimeBrand,
      }),
    );
  }, [
    blockedCatalog,
    catalogMode,
    offlineState,
    runtimeBrand,
    screen,
    session,
    store,
    superAdminTab,
    tab,
    trackedOrder,
    trackingError,
  ]);

  useEffect(
    () => () => {
      document.documentElement.style.removeProperty("--toast-offset");
      document.documentElement.style.removeProperty("--install-prompt-offset");
    },
    [],
  );

  return {
    state: {
      brand,
      catUrl,
      connectionState,
    },
    actions: {
      handleMerchantPreview,
    },
  };
}
