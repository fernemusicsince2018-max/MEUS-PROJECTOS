import React from "react";
import { ArrowRight, Clock3, Eye, Home, LogOut, Package, Share2, ShieldAlert, Star, Store, Truck, Wallet, Wifi, WifiOff } from "lucide-react";
import { STORE_DEFAULTS } from "../../constants.js";
import {
  buildPlanActivationLink,
  getPlanAccessState,
  getPlanCountdown,
  getPlanTimeRemaining,
  hasLimitedStock,
  resolveMerchantPlanSnapshot,
  isSoldOut,
} from "../../utils/catalog.js";
import { formatSyncTimestamp } from "../../utils/network.js";
import OrdersTab from "./OrdersTab.jsx";
import ProductModal from "./ProductModal.jsx";
import ProductsTab from "./ProductsTab.jsx";
import ReviewsTab from "./ReviewsTab.jsx";
import ShareTab from "./ShareTab.jsx";
import PlansTab from "./PlansTab.jsx";
import StoreForm from "./StoreForm.jsx";
import BrandMark from "../common/BrandMark.jsx";
import { StatTile } from "../common/UiBits.jsx";
import TrialBanner from "./TrialBanner.jsx";

const TAB_ITEMS = [
  ["inicio", "Inicio", Home],
  ["loja", "Loja", Store],
  ["produtos", "Produtos", Package],
  ["pedidos", "Pedidos", Truck],
  ["avaliacoes", "Avaliacoes", Star],
  ["planos", "Planos", Wallet],
  ["compartilhar", "Partilhar", Share2],
];

function buildConnectionMeta(connectionState, storageStatus) {
  const online = connectionState?.isOnline !== false;
  const syncMode = connectionState?.syncMode || "live";
  const syncAt = connectionState?.syncAt || "";
  const sourceLabelMap = {
    sessao: "Sessão pronta",
    catalogo_admin: "Catálogo em dia",
    catalogo_publico: "Vitrine em dia",
    pedidos: "Pedidos em dia",
    avaliacoes: "Avaliacoes em dia",
    tracking: "Acompanhamento em dia",
    superadmin: "Painel em dia",
  };
  const sourceLabel = sourceLabelMap[connectionState?.syncSource] || "Painel pronto";
  const timeLabel = formatSyncTimestamp(syncAt);

  return {
    online,
    onlineLabel: online ? "Online" : "Offline",
    onlineDetail: online ? "Ligação ativa e pronta para sincronizar." : "A mostrar o que já ficou guardado neste telemóvel.",
    syncLabel: syncMode === "cached" ? "Copia local" : sourceLabel,
    syncDetail:
      syncMode === "cached"
        ? timeLabel
          ? `Guardada ${timeLabel}.`
          : "Sem internet. A mostrar a última cópia guardada."
        : timeLabel
          ? `Atualizado ${timeLabel}.`
          : storageStatus?.label || connectionState?.storageLabel || "Pronto para editar.",
  };
}

function formatPlanDateLabel(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Admin({
  brand,
  store,
  prods,
  orders = [],
  ordersSummary,
  ordersLoading = false,
  ordersPageInfo,
  ordersLoadingMore = false,
  merchantReviews = [],
  merchantReviewsLoading = false,
  merchantReviewsPageInfo,
  merchantReviewsLoadingMore = false,
  busyOrderId = "",
  busyCustomerKey = "",
  busyReviewId = "",
  catUrl,
  tab,
  setTab,
  modal,
  setModal,
  onSaveStore,
  onSaveProd,
  onDel,
  onPreview,
  onLogout,
  onOrdersRefresh,
  onOrdersLoadMore,
  onReviewsRefresh,
  onReviewsLoadMore,
  onOrderStatusChange,
  onCustomerDiscountSave,
  onReviewFeatureToggle,
  planCatalog,
  planCatalogLoading,
  planCatalogError,
  onPlanActivationRequest,
  onPlanPaymentProofSubmit,
  onOpenPlans,
  onRefreshPlans,
  session,
  toast,
  toastNode,
  storageStatus,
  connectionState,
}) {
  const accent = store.color || STORE_DEFAULTS.color;
  const featuredCount = prods.filter((product) => product.featured).length;
  const activeCount = prods.filter((product) => !isSoldOut(product)).length;
  const lowStockCount = prods.filter((product) => hasLimitedStock(product) && Number(product.stock) > 0 && Number(product.stock) <= 3).length;
  const reviewSummary =
    store?.reviewSummary && typeof store.reviewSummary === "object"
      ? store.reviewSummary
      : null;
  const totalReviews = Math.max(0, Number(reviewSummary?.totalReviews || 0));
  const averageRating = Number(reviewSummary?.averageRating || 0);
  const planSnapshot = resolveMerchantPlanSnapshot(session, planCatalog?.store);
  const planAccess = session
    ? getPlanAccessState(planSnapshot.planStatus, planSnapshot.planExpiresAt)
    : { allowed: true, message: "" };
  const catalogLocked = !planAccess.allowed;
  const activePlanRequest = planCatalog?.activeRequest || null;
  const hasOpenPlanRequest = Boolean(activePlanRequest?.id || activePlanRequest?.status);
  const activationUrl = buildPlanActivationLink({
    supportWhatsApp: store.supportWhatsApp,
    storeName: store.name || planSnapshot.storeName,
    referenceId: planSnapshot.referenceId,
    storeId: planSnapshot.storeId,
  });
  const connectionMeta = buildConnectionMeta(connectionState, storageStatus);
  const showDashboardHome = tab === "inicio";
  const planExpiryLabel = formatPlanDateLabel(planSnapshot.planExpiresAt);
  const [countdownNow, setCountdownNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!planSnapshot.planExpiresAt) return undefined;

    const timer = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [planSnapshot.planExpiresAt, planSnapshot.planStatus]);

  const planCountdown = getPlanCountdown(planSnapshot.planStatus, planSnapshot.planExpiresAt, new Date(countdownNow));
  const planTimeRemaining = getPlanTimeRemaining(planSnapshot.planStatus, planSnapshot.planExpiresAt, countdownNow);
  const topbarPlanMeta = planTimeRemaining
    ? {
      label: planTimeRemaining.compactLabel,
      detail: planTimeRemaining.detailLabel,
      bg: planTimeRemaining.bg,
      color: planTimeRemaining.color,
      borderColor: planTimeRemaining.borderColor,
    }
    : planCountdown
      ? {
        label: planCountdown.label,
        detail: planExpiryLabel
          ? `${catalogLocked ? "Expirou" : "Termina"} em ${planExpiryLabel}.`
          : "Acompanha o tempo restante do plano aqui.",
        bg: planCountdown.bg,
        color: planCountdown.color,
        borderColor: planCountdown.borderColor,
      }
      : null;
  const heroPanelTitle = catalogLocked ? "Loja temporariamente inativa" : "Loja ativa";
  const heroPanelDetail = catalogLocked
    ? planExpiryLabel
      ? `Plano expirado em ${planExpiryLabel}. A vitrine publica esta bloqueada ate a reativacao.`
      : planAccess.message
    : `${prods.length} produtos no painel`;
  const heroCopy = catalogLocked
    ? (planAccess.message || "A vitrine publica volta ao normal assim que a reativacao do plano for aprovada.")
    : brand.tagline;
  const heroPrimaryChip = catalogLocked
    ? "Vitrine pausada"
    : connectionMeta.onlineLabel;
  const heroSecondaryChip = catalogLocked
    ? hasOpenPlanRequest
      ? "Pedido em andamento"
      : "Aguardando reativacao"
    : connectionMeta.syncLabel;
  const heroPanelButtonLabel = hasOpenPlanRequest
    ? "Continuar ativacao"
    : "Sinalizar ativacao";
  const previewButtonLabel = catalogLocked ? "Abrir preview privado" : "Abrir vitrine";
  const previewButtonTitle = catalogLocked
    ? "A loja esta inativa para clientes. Este preview e privado para o lojista."
    : "Abrir a vitrine publica.";

  return (
    <div className="admin-shell" style={{ minHeight: "600px", fontFamily: "var(--font-sans)", background: "var(--color-background-secondary)" }}>
      <div className="admin-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", padding: "14px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 7 }}>
        <div className="admin-topbar__brand" style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <BrandMark brand={brand} size={40} rounded={14} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: "700", fontFamily: "var(--font-display)" }}>{brand.name}</div>
            <div className="admin-topbar__meta" style={{ fontSize: "11px", color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {store.name || "Prepara a tua loja"} | {storageStatus.label}
            </div>
          </div>
        </div>

        {topbarPlanMeta ? (
          <div
            className="admin-topbar__countdown"
            style={{
              display: "grid",
              gap: "4px",
              padding: "10px 14px",
              borderRadius: "18px",
              background: topbarPlanMeta.bg,
              color: topbarPlanMeta.color,
              border: `1px solid ${topbarPlanMeta.borderColor}`,
              minWidth: "220px",
              flex: "1 1 240px",
              maxWidth: "360px",
              boxShadow: catalogLocked ? "0 12px 28px rgba(127,29,29,0.12)" : "0 12px 28px rgba(22,101,52,0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              <Clock3 size={13} /> Tempo do lojista
            </div>
            <div style={{ fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{topbarPlanMeta.label}</div>
            <div style={{ fontSize: "12px", lineHeight: 1.45, opacity: 0.92 }}>{topbarPlanMeta.detail}</div>
          </div>
        ) : null}

        <div className="admin-topbar__actions" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {session?.user?.email ? (
            <div className="admin-topbar__email" style={{ fontSize: "12px", color: "var(--color-text-secondary)", padding: "0 2px" }}>
              {session.user.email}
            </div>
          ) : null}

          <button data-testid="admin-open-catalog-preview" className="admin-topbar__button admin-topbar__button--primary" onClick={onPreview} title={previewButtonTitle} style={{ background: `linear-gradient(135deg, ${brand.accent} 0%, ${accent} 100%)`, color: "white", border: "none", borderRadius: "var(--border-radius-md)", padding: "10px 16px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", boxShadow: "0 12px 24px rgba(28, 154, 116, 0.18)" }}>
            <Eye size={13} /> {previewButtonLabel}
          </button>

          {onLogout ? (
            <button data-testid="admin-logout" className="admin-topbar__button" onClick={onLogout} style={{ background: "transparent", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "10px 14px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "700" }}>
              <LogOut size={13} /> Sair
            </button>
          ) : null}
        </div>
      </div>

      {catalogLocked || showDashboardHome ? (
        <TrialBanner
          planStatus={planSnapshot.planStatus}
          planExpiresAt={planSnapshot.planExpiresAt}
          storeId={planSnapshot.storeId}
          storeName={store.name || planSnapshot.storeName}
          referenceId={planSnapshot.referenceId}
          supportWhatsApp={store.supportWhatsApp}
          maxFreeProducts={store.maxFreeProducts}
          productCount={prods.length}
          planAccessMessage={planAccess.message}
          onOpenPlans={onOpenPlans}
          activeRequest={activePlanRequest}
        />
      ) : null}

      {showDashboardHome ? (
        <div className="admin-shell__overview" style={{ padding: "20px 20px 0" }}>
          <div
            className="admin-shell__hero"
            style={{
              background: catalogLocked
                ? "linear-gradient(135deg, rgba(69,10,10,0.99) 0%, rgba(127,29,29,0.98) 58%, rgba(185,28,28,0.94) 100%)"
                : `linear-gradient(135deg, ${brand.dark} 0%, ${brand.accent} 58%, ${brand.highlight} 180%)`,
              borderRadius: "30px",
              padding: "24px",
              color: "white",
              marginBottom: "18px",
              position: "relative",
              overflow: "hidden",
              boxShadow: catalogLocked ? "0 20px 60px rgba(127, 29, 29, 0.22)" : "0 20px 60px rgba(12, 37, 34, 0.18)",
            }}
          >
            <div style={{ position: "absolute", width: "220px", height: "220px", borderRadius: "999px", background: catalogLocked ? "rgba(254,226,226,0.1)" : "rgba(255,255,255,0.08)", top: "-90px", right: "-40px" }} />
            <div style={{ position: "absolute", width: "140px", height: "140px", borderRadius: "999px", background: catalogLocked ? "rgba(254,242,242,0.08)" : "rgba(255,255,255,0.07)", bottom: "-48px", left: "-20px" }} />

            <div className="admin-shell__hero-grid" style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ maxWidth: "620px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "7px 12px", background: catalogLocked ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.12)", borderRadius: "999px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "14px" }}>
                  {catalogLocked ? <ShieldAlert size={12} /> : <Store size={12} />} {brand.name}
                </div>
                <div className="admin-shell__hero-title" style={{ fontSize: "30px", lineHeight: 1.08, fontFamily: "var(--font-display)", fontWeight: "800", maxWidth: "640px" }}>
                  Tudo da tua loja, num painel feito para o telemóvel.
                </div>
                <div className="admin-shell__hero-copy" style={{ fontSize: "13px", opacity: 0.9, maxWidth: "520px", marginTop: "10px" }}>
                  {heroCopy}
                </div>
              </div>

              <div
                className="admin-shell__hero-card"
                style={{
                  padding: "16px 18px",
                  minWidth: "230px",
                  borderRadius: "22px",
                  background: catalogLocked
                    ? "linear-gradient(180deg, rgba(127,29,29,0.42) 0%, rgba(153,27,27,0.28) 100%)"
                    : "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(6px)",
                  border: catalogLocked ? "1px solid rgba(254,226,226,0.2)" : "none",
                  boxShadow: catalogLocked ? "0 18px 38px rgba(69, 10, 10, 0.28)" : "none",
                }}
              >
                <div style={{ fontSize: "11px", opacity: 0.82, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                  {heroPanelTitle}
                </div>
                <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{store.name || brand.name}</div>
                <div style={{ fontSize: "12px", opacity: 0.88, marginTop: "4px", lineHeight: 1.6 }}>{heroPanelDetail}</div>

                <div className="admin-shell__hero-pill-row" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 11px", borderRadius: "999px", background: catalogLocked ? "rgba(69,10,10,0.42)" : connectionMeta.online ? "rgba(255,255,255,0.18)" : "rgba(127, 29, 29, 0.32)", fontSize: "11px", fontWeight: "800" }}>
                    {catalogLocked ? <ShieldAlert size={12} /> : connectionMeta.online ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {heroPrimaryChip}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 11px", borderRadius: "999px", background: catalogLocked ? "rgba(255,255,255,0.2)" : connectionState?.syncMode === "cached" ? "rgba(15, 23, 42, 0.24)" : "rgba(255,255,255,0.18)", fontSize: "11px", fontWeight: "800" }}>
                    {heroSecondaryChip}
                  </span>
                  {planTimeRemaining ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 11px", borderRadius: "999px", background: "rgba(255,255,255,0.18)", fontSize: "11px", fontWeight: "800" }}>
                      <Clock3 size={12} /> {planTimeRemaining.compactLabel}
                    </span>
                  ) : null}
                </div>

                {catalogLocked && onOpenPlans ? (
                  <button
                    type="button"
                    onClick={onOpenPlans}
                    style={{
                      marginTop: "14px",
                      border: "none",
                      borderRadius: "14px",
                      padding: "11px 14px",
                      background: "white",
                      color: "#7f1d1d",
                      cursor: "pointer",
                      fontWeight: "800",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: "0 14px 30px rgba(15,23,42,0.18)",
                    }}
                  >
                    <Wallet size={13} /> {heroPanelButtonLabel} <ArrowRight size={13} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="admin-shell__status-strip" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "18px" }}>
            <div className="admin-shell__status-card" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(104, 128, 120, 0.14)", borderRadius: "22px", padding: "14px 16px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary)", fontWeight: "800" }}>Agora</div>
              <div className="admin-shell__status-card-title" style={{ marginTop: "8px", fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}>
                {TAB_ITEMS.find(([id]) => id === tab)?.[1] || "Painel"}
              </div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                Resumo geral com ligacao, catalogo, pedidos e reputacao da loja.
              </div>
            </div>

            <div className="admin-shell__status-card" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(104, 128, 120, 0.14)", borderRadius: "22px", padding: "14px 16px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary)", fontWeight: "800" }}>
                Ligacao
              </div>
              <div className="admin-shell__status-card-title" style={{ marginTop: "8px", fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}>
                {connectionMeta.syncLabel}
              </div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {connectionMeta.syncDetail}
              </div>
            </div>

            <div className="admin-shell__status-card" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(104, 128, 120, 0.14)", borderRadius: "22px", padding: "14px 16px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary)", fontWeight: "800" }}>Dados</div>
              <div className="admin-shell__status-card-title" style={{ marginTop: "8px", fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}>
                {storageStatus.label}
              </div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {connectionMeta.onlineDetail}
              </div>
            </div>
          </div>

          <div className="admin-shell__stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
            <StatTile label="Produtos" value={prods.length} hint="no catálogo" color={accent} />
            <StatTile label="Ativos" value={activeCount} hint="prontos para venda" color={accent} />
            <StatTile label="Destaques" value={featuredCount} hint="mais visíveis" color={accent} />
            <StatTile label="Stock baixo" value={lowStockCount} hint="para rever" color={accent} />
            <StatTile label="Pedidos" value={ordersSummary?.totalCount ?? orders.length} hint="recebidos" color={accent} />
            <StatTile label="Avaliacoes" value={totalReviews} hint="clientes que avaliaram" color={accent} />
            <StatTile label="Nota media" value={totalReviews > 0 ? averageRating.toFixed(1) : "-"} hint="reputacao atual" color={accent} />
          </div>
        </div>
      ) : null}

      <div className="admin-tabbar-desktop" style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "0 20px", marginTop: showDashboardHome ? "20px" : 0, background: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)", position: "sticky", top: "73px", zIndex: 6 }}>
        {TAB_ITEMS.map(([id, label, Icon]) => (
          <button data-testid={`admin-tab-${id}`} key={id} onClick={() => setTab(id)} style={{ padding: "14px 14px", border: "none", background: "transparent", cursor: "pointer", fontSize: "13px", fontWeight: tab === id ? "700" : "600", color: tab === id ? "var(--color-text-primary)" : "var(--color-text-secondary)", borderBottom: tab === id ? `3px solid ${brand.accent}` : "3px solid transparent", display: "flex", alignItems: "center", gap: "6px", marginBottom: "-1px" }}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="admin-content" style={{ padding: tab === "inicio" ? "0" : "0 20px 24px" }}>
        {tab === "loja" && <StoreForm store={store} onSave={onSaveStore} catalogLocked={catalogLocked} planAccessMessage={planAccess.message} activationUrl={activationUrl} />}
        {tab === "produtos" && <ProductsTab prods={prods} color={accent} currencyCode={store.currencyCode} onAdd={() => setModal({ data: null })} onEdit={(product) => setModal({ data: product })} onDel={onDel} catalogLocked={catalogLocked} planAccessMessage={planAccess.message} activationUrl={activationUrl} />}
        {tab === "pedidos" && <OrdersTab orders={orders} summary={ordersSummary} pageInfo={ordersPageInfo} store={store} color={accent} loading={ordersLoading} loadingMore={ordersLoadingMore} onRefresh={onOrdersRefresh} onLoadMore={onOrdersLoadMore} onChangeStatus={onOrderStatusChange} onSaveCustomerDiscount={onCustomerDiscountSave} busyOrderId={busyOrderId} busyCustomerKey={busyCustomerKey} />}
        {tab === "avaliacoes" && <ReviewsTab reviews={merchantReviews} pageInfo={merchantReviewsPageInfo} store={store} color={accent} loading={merchantReviewsLoading} loadingMore={merchantReviewsLoadingMore} onRefresh={onReviewsRefresh} onLoadMore={onReviewsLoadMore} onToggleReviewFeature={onReviewFeatureToggle} busyReviewId={busyReviewId} />}
        {tab === "planos" && <PlansTab store={store} session={session} planCatalog={planCatalog} loading={planCatalogLoading} error={planCatalogError} onRefresh={onRefreshPlans} onRequestActivation={onPlanActivationRequest} onSubmitPaymentProof={onPlanPaymentProofSubmit} />}
        {tab === "compartilhar" && <ShareTab catUrl={catUrl} color={accent} store={store} catalogLocked={catalogLocked} planAccessMessage={planAccess.message} activationUrl={activationUrl} />}
      </div>

      <nav className="admin-mobile-tabbar" aria-label="Navegacao do painel">
        <div className="admin-mobile-tabbar__inner">
          {TAB_ITEMS.map(([id, label, Icon]) => {
            const active = tab === id;

            return (
              <button
                className="admin-mobile-tabbar__button"
                key={id}
                type="button"
                onClick={() => setTab(id)}
                data-active={active ? "true" : "false"}
                style={{
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "18px",
                  padding: "10px 6px",
                  background: active ? `linear-gradient(135deg, ${brand.accent} 0%, ${accent} 100%)` : "transparent",
                  color: active ? "white" : "rgba(255,255,255,0.72)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  fontSize: "11px",
                  fontWeight: "800",
                  minHeight: "58px",
                }}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {modal ? <ProductModal prod={modal.data} onSave={onSaveProd} onClose={() => setModal(null)} color={accent} currencyCode={store.currencyCode} /> : null}
      {toast && toastNode}
    </div>
  );
}
