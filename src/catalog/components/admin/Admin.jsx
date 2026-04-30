import { Eye, LogOut, Package, Share2, Store, Truck, Wallet, Wifi, WifiOff } from "lucide-react";
import { STORE_DEFAULTS } from "../../constants.js";
import { buildPlanActivationLink, getPlanAccessState, hasLimitedStock, isSoldOut } from "../../utils/catalog.js";
import { formatSyncTimestamp } from "../../utils/network.js";
import OrdersTab from "./OrdersTab.jsx";
import ProductModal from "./ProductModal.jsx";
import ProductsTab from "./ProductsTab.jsx";
import ShareTab from "./ShareTab.jsx";
import PlansTab from "./PlansTab.jsx";
import StoreForm from "./StoreForm.jsx";
import BrandMark from "../common/BrandMark.jsx";
import { StatTile } from "../common/UiBits.jsx";
import TrialBanner from "./TrialBanner.jsx";

const TAB_ITEMS = [
  ["loja", "Loja", Store],
  ["produtos", "Produtos", Package],
  ["pedidos", "Pedidos", Truck],
  ["planos", "Planos", Wallet],
  ["compartilhar", "Partilhar", Share2],
];

function buildConnectionMeta(connectionState, storageStatus) {
  const online = connectionState?.isOnline !== false;
  const syncMode = connectionState?.syncMode || "live";
  const syncAt = connectionState?.syncAt || "";
  const sourceLabelMap = {
    sessao: "Sessao pronta",
    catalogo_admin: "Catalogo em dia",
    catalogo_publico: "Vitrine em dia",
    pedidos: "Pedidos em dia",
    tracking: "Tracking em dia",
    superadmin: "Painel em dia",
  };
  const sourceLabel = sourceLabelMap[connectionState?.syncSource] || "Painel pronto";
  const timeLabel = formatSyncTimestamp(syncAt);

  return {
    online,
    onlineLabel: online ? "Online" : "Offline",
    onlineDetail: online ? "Ligacao ativa e pronta para sincronizar." : "A mostrar o que ja ficou guardado neste telemovel.",
    syncLabel: syncMode === "cached" ? "Copia local" : sourceLabel,
    syncDetail:
      syncMode === "cached"
        ? timeLabel
          ? `Guardada ${timeLabel}`
          : "Sem internet. A mostrar a ultima copia guardada."
        : timeLabel
          ? `Atualizado ${timeLabel}`
          : storageStatus?.label || connectionState?.storageLabel || "Pronto para editar",
  };
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
  busyOrderId = "",
  busyCustomerKey = "",
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
  onOrderStatusChange,
  onCustomerDiscountSave,
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
  const planAccess = session
    ? getPlanAccessState(session?.planStatus, session?.planExpiresAt)
    : { allowed: true, message: "" };
  const catalogLocked = !planAccess.allowed;
  const activationUrl = buildPlanActivationLink({
    supportWhatsApp: store.supportWhatsApp,
    storeName: store.name || session?.storeName,
    referenceId: session?.referenceId,
    storeId: session?.storeId,
  });
  const connectionMeta = buildConnectionMeta(connectionState, storageStatus);
  const isPlansView = tab === "planos";

  return (
    <div className="admin-shell" style={{ minHeight: "600px", fontFamily: "var(--font-sans)", background: "var(--color-background-secondary)" }}>
      {!isPlansView ? (
        <TrialBanner
          planStatus={session?.planStatus}
          planExpiresAt={session?.planExpiresAt}
          storeId={session?.storeId}
          storeName={store.name || session?.storeName}
          referenceId={session?.referenceId}
          supportWhatsApp={store.supportWhatsApp}
          maxFreeProducts={store.maxFreeProducts}
          productCount={prods.length}
          planAccessMessage={planAccess.message}
          onOpenPlans={onOpenPlans}
        />
      ) : null}

      <div className="admin-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "14px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 7 }}>
        <div className="admin-topbar__brand" style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <BrandMark brand={brand} size={40} rounded={14} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: "700", fontFamily: "var(--font-display)" }}>{brand.name}</div>
            <div className="admin-topbar__meta" style={{ fontSize: "11px", color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {store.name || "Prepara a tua loja"} | {storageStatus.label}
            </div>
          </div>
        </div>

        <div className="admin-topbar__actions" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {session?.user?.email ? (
            <div className="admin-topbar__email" style={{ fontSize: "12px", color: "var(--color-text-secondary)", padding: "0 2px" }}>
              {session.user.email}
            </div>
          ) : null}

          <button data-testid="admin-open-catalog-preview" className="admin-topbar__button admin-topbar__button--primary" onClick={onPreview} style={{ background: `linear-gradient(135deg, ${brand.accent} 0%, ${accent} 100%)`, color: "white", border: "none", borderRadius: "var(--border-radius-md)", padding: "10px 16px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", boxShadow: "0 12px 24px rgba(28, 154, 116, 0.18)" }}>
            <Eye size={13} /> Abrir vitrine
          </button>

          {onLogout ? (
            <button data-testid="admin-logout" className="admin-topbar__button" onClick={onLogout} style={{ background: "transparent", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "10px 14px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "700" }}>
              <LogOut size={13} /> Sair
            </button>
          ) : null}
        </div>
      </div>

      {!isPlansView ? (
        <div className="admin-shell__overview" style={{ padding: "20px 20px 0" }}>
          <div className="admin-shell__hero" style={{ background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.accent} 58%, ${brand.highlight} 180%)`, borderRadius: "30px", padding: "24px", color: "white", marginBottom: "18px", position: "relative", overflow: "hidden", boxShadow: "0 20px 60px rgba(12, 37, 34, 0.18)" }}>
            <div style={{ position: "absolute", width: "220px", height: "220px", borderRadius: "999px", background: "rgba(255,255,255,0.08)", top: "-90px", right: "-40px" }} />
            <div style={{ position: "absolute", width: "140px", height: "140px", borderRadius: "999px", background: "rgba(255,255,255,0.07)", bottom: "-48px", left: "-20px" }} />

            <div className="admin-shell__hero-grid" style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ maxWidth: "620px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "7px 12px", background: "rgba(255,255,255,0.12)", borderRadius: "999px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "14px" }}>
                  <Store size={12} /> {brand.name}
                </div>
                <div className="admin-shell__hero-title" style={{ fontSize: "30px", lineHeight: 1.08, fontFamily: "var(--font-display)", fontWeight: "800", maxWidth: "640px" }}>
                  Tudo da tua loja, num painel feito para o telemovel.
                </div>
                <div className="admin-shell__hero-copy" style={{ fontSize: "13px", opacity: 0.9, maxWidth: "520px", marginTop: "10px" }}>
                  {brand.tagline}
                </div>
              </div>

              <div className="admin-shell__hero-card" style={{ padding: "16px 18px", minWidth: "230px", borderRadius: "22px", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)" }}>
                <div style={{ fontSize: "11px", opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Loja ativa</div>
                <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{store.name || brand.name}</div>
                <div style={{ fontSize: "12px", opacity: 0.82, marginTop: "4px" }}>{prods.length} produtos no painel</div>

                <div className="admin-shell__hero-pill-row" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 11px", borderRadius: "999px", background: connectionMeta.online ? "rgba(255,255,255,0.18)" : "rgba(127, 29, 29, 0.32)", fontSize: "11px", fontWeight: "800" }}>
                    {connectionMeta.online ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {connectionMeta.onlineLabel}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 11px", borderRadius: "999px", background: connectionState?.syncMode === "cached" ? "rgba(15, 23, 42, 0.24)" : "rgba(255,255,255,0.18)", fontSize: "11px", fontWeight: "800" }}>
                    {connectionMeta.syncLabel}
                  </span>
                </div>
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
                Salta rapido entre loja, produtos, pedidos e partilha.
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
            <StatTile label="Produtos" value={prods.length} hint="no catalogo" color={accent} />
            <StatTile label="Ativos" value={activeCount} hint="prontos para venda" color={accent} />
            <StatTile label="Destaques" value={featuredCount} hint="mais visiveis" color={accent} />
            <StatTile label="Stock baixo" value={lowStockCount} hint="para rever" color={accent} />
            <StatTile label="Pedidos" value={ordersSummary?.totalCount ?? orders.length} hint="recebidos" color={accent} />
          </div>
        </div>
      ) : null}

      <div className="admin-tabbar-desktop" style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "0 20px", marginTop: isPlansView ? 0 : "20px", background: "rgba(255,255,255,0.78)", backdropFilter: "blur(16px)", position: "sticky", top: "73px", zIndex: 6 }}>
        {TAB_ITEMS.map(([id, label, Icon]) => (
          <button data-testid={`admin-tab-${id}`} key={id} onClick={() => setTab(id)} style={{ padding: "14px 14px", border: "none", background: "transparent", cursor: "pointer", fontSize: "13px", fontWeight: tab === id ? "700" : "600", color: tab === id ? "var(--color-text-primary)" : "var(--color-text-secondary)", borderBottom: tab === id ? `3px solid ${brand.accent}` : "3px solid transparent", display: "flex", alignItems: "center", gap: "6px", marginBottom: "-1px" }}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="admin-content" style={{ padding: isPlansView ? "0 20px 24px" : "24px 20px" }}>
        {tab === "loja" && <StoreForm store={store} onSave={onSaveStore} catalogLocked={catalogLocked} planAccessMessage={planAccess.message} activationUrl={activationUrl} />}
        {tab === "produtos" && <ProductsTab prods={prods} color={accent} currencyCode={store.currencyCode} onAdd={() => setModal({ data: null })} onEdit={(product) => setModal({ data: product })} onDel={onDel} catalogLocked={catalogLocked} planAccessMessage={planAccess.message} activationUrl={activationUrl} />}
        {tab === "pedidos" && <OrdersTab orders={orders} summary={ordersSummary} pageInfo={ordersPageInfo} store={store} color={accent} loading={ordersLoading} loadingMore={ordersLoadingMore} onRefresh={onOrdersRefresh} onLoadMore={onOrdersLoadMore} onChangeStatus={onOrderStatusChange} onSaveCustomerDiscount={onCustomerDiscountSave} busyOrderId={busyOrderId} busyCustomerKey={busyCustomerKey} />}
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
