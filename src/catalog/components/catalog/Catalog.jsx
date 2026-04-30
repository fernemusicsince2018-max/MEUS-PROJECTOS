import React from "react";
import { ArrowLeft, Package, Phone, Search, ShoppingCart, Store, X } from "lucide-react";
import { STORE_DEFAULTS } from "../../constants.js";
import { isProductOnPromotion, isSoldOut } from "../../utils/catalog.js";
import { fmtMoney } from "../../utils/format.js";
import CartDrawer from "./CartDrawer.jsx";
import OrderSuccessSheet from "./OrderSuccessSheet.jsx";
import ProdCard from "./ProdCard.jsx";
import BrandMark from "../common/BrandMark.jsx";
import { CatalogMetric } from "../common/UiBits.jsx";

export default function Catalog({
  brand,
  mode,
  store,
  prods,
  cart,
  cartCount,
  cartTotal,
  cartOpen,
  setCartOpen,
  search,
  setSearch,
  orderMeta,
  setOrderMeta,
  onAdd,
  onUpd,
  onCheckout,
  checkoutBusy = false,
  orderReceipt = null,
  onCloseOrderReceipt,
  onTrackOrderReceipt,
  onOpenReceiptWhatsApp,
  toast,
  onBack,
  toastNode,
}) {
  const accent = store.color || STORE_DEFAULTS.color;
  const currencyCode = store.currencyCode || STORE_DEFAULTS.currencyCode;
  const categories = [...new Set(prods.map((product) => product.category).filter(Boolean))];
  const featured = prods.filter((product) => product.featured);
  const [activeFilter, setActiveFilter] = React.useState("");
  const shellStyle = { width: "100%", maxWidth: "1420px", margin: "0 auto" };

  React.useEffect(() => {
    if (activeFilter === "__featured" && featured.length === 0) setActiveFilter("");
    if (activeFilter && activeFilter !== "__featured" && !categories.includes(activeFilter)) setActiveFilter("");
  }, [activeFilter, categories, featured.length]);

  const visible =
    activeFilter === "__featured"
      ? prods.filter((product) => product.featured)
      : activeFilter
        ? prods.filter((product) => product.category === activeFilter)
        : prods;

  const orderedVisible = [...visible].sort(
    (a, b) =>
      Number(isSoldOut(a)) - Number(isSoldOut(b)) ||
      Number(isProductOnPromotion(b)) - Number(isProductOnPromotion(a)) ||
      Number(b.featured) - Number(a.featured) ||
      a.name.localeCompare(b.name),
  );
  const productGridColumns = "repeat(auto-fit, minmax(min(100%, 270px), 340px))";

  return (
    <div style={{ minHeight: "600px", fontFamily: "var(--font-sans)", background: "var(--color-background-primary)" }}>
      <div style={{ background: `linear-gradient(145deg, ${brand.dark} 0%, ${accent} 54%, ${brand.highlight} 175%)`, padding: "20px 16px 28px 16px", color: "white", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: "260px", height: "260px", borderRadius: "999px", background: "rgba(255,255,255,0.08)", top: "-110px", right: "-90px" }} />
        <div style={{ position: "absolute", width: "180px", height: "180px", borderRadius: "999px", background: "rgba(255,255,255,0.06)", bottom: "-80px", left: "-30px" }} />
        <div style={{ ...shellStyle, position: "relative" }}>
          {mode === "preview" && (
            <button onClick={onBack} style={{ position: "absolute", top: "12px", left: "0", background: "rgba(255,255,255,0.18)", border: "none", borderRadius: "20px", padding: "6px 10px", cursor: "pointer", color: "white", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", zIndex: 2 }}>
              <ArrowLeft size={11} /> Admin
            </button>
          )}

          <div style={{ position: "relative", textAlign: "center", paddingTop: mode === "preview" ? "10px" : "0" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "8px 13px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "999px", marginBottom: "14px", backdropFilter: "blur(10px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)" }}>
              <BrandMark brand={brand} size={34} rounded={12} />
              <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase" }}>{brand.name}</span>
            </div>
            {store.logo && <img src={store.logo} alt="logo" style={{ width: "82px", height: "82px", borderRadius: "28px", objectFit: "cover", marginBottom: "14px", border: "2px solid rgba(255,255,255,0.42)", marginInline: "auto", boxShadow: "0 18px 36px rgba(0,0,0,0.16)" }} onError={(event) => { event.target.style.display = "none"; }} />}
            <div style={{ fontSize: "32px", fontWeight: "800", marginBottom: "8px", fontFamily: "var(--font-display)", lineHeight: 1.02, letterSpacing: "-0.03em" }}>{store.name || "Minha Loja"}</div>
            {store.description && <div style={{ fontSize: "13px", opacity: 0.9, maxWidth: "560px", margin: "0 auto", lineHeight: 1.7 }}>{store.description}</div>}
            {store.pickupNote && <div style={{ marginTop: "14px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 13px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.14)", fontSize: "12px", backdropFilter: "blur(10px)" }}><Phone size={12} /> {store.pickupNote}</div>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginTop: "22px", position: "relative" }}>
            <CatalogMetric label="Produtos" value={prods.length} />
            <CatalogMetric label="Categorias" value={categories.length} />
            <CatalogMetric label="Destaques" value={featured.length} />
          </div>
        </div>

      <div style={{ padding: "14px 16px", borderBottom: "0.5px solid rgba(104, 128, 120, 0.16)", background: "rgba(251,253,249,0.82)", backdropFilter: "blur(14px)", position: "sticky", top: 0, zIndex: 3 }}>
        <div style={shellStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.88)", borderRadius: "20px", padding: "12px 14px", border: "1px solid rgba(104, 128, 120, 0.14)", boxShadow: "0 10px 28px rgba(16,35,31,0.05)" }}>
            <Search size={14} style={{ color: "var(--color-text-secondary)", flexShrink: 0 }} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produtos..." style={{ border: "none", background: "transparent", outline: "none", fontSize: "13px", width: "100%", color: "var(--color-text-primary)" }} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", display: "flex" }}><X size={13} /></button>}
          </div>
        </div>
      </div>

      {(categories.length > 0 || featured.length > 0) && (
        <div style={{ display: "flex", gap: "8px", padding: "12px 16px 10px", overflowX: "auto", borderBottom: "0.5px solid rgba(104, 128, 120, 0.12)" }}>
          <div style={{ ...shellStyle, display: "flex", gap: "8px" }}>
            {[{ id: "", label: "Todos" }, ...(featured.length ? [{ id: "__featured", label: "Destaques" }] : []), ...categories.map((category) => ({ id: category, label: category }))].map((item) => {
              const active = activeFilter === item.id;
              return (
                <button key={item.id || "all"} onClick={() => setActiveFilter(item.id)} style={{ padding: "8px 15px", borderRadius: "999px", fontSize: "12px", cursor: "pointer", fontWeight: "700", whiteSpace: "nowrap", background: active ? `linear-gradient(135deg, ${brand.accent} 0%, ${accent} 100%)` : "rgba(255,255,255,0.9)", color: active ? "white" : "var(--color-text-secondary)", border: active ? "none" : "1px solid rgba(104, 128, 120, 0.14)", boxShadow: active ? "0 12px 24px rgba(28, 154, 116, 0.16)" : "0 8px 16px rgba(16,35,31,0.04)" }}>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: "16px", paddingBottom: cartCount > 0 ? "94px" : "16px", color: "var(--color-text-primary)" }}>
        <div style={shellStyle}>
          {featured.length > 0 && !search && !activeFilter && (
            <div style={{ marginBottom: "18px", padding: "18px 20px", borderRadius: "26px", background: "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(247,250,246,0.98) 100%)", border: "1px solid rgba(104, 128, 120, 0.12)", boxShadow: "0 18px 34px rgba(16,35,31,0.05)", color: "var(--color-text-primary)" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-secondary)", fontWeight: "800", marginBottom: "8px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Store size={12} /> Selecao {brand.name}
              </div>
              <div style={{ fontSize: "21px", fontFamily: "var(--font-display)", fontWeight: "800", marginBottom: "6px", lineHeight: 1.18, letterSpacing: "-0.03em", maxWidth: "760px", color: "var(--color-text-primary)" }}>Os produtos em destaque aparecem primeiro e deixam a vitrine mais elegante.</div>
              <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7, maxWidth: "760px" }}>Promocoes, novidades e itens com melhor margem ficam mais visiveis para o cliente sem poluir o catalogo.</div>
            </div>
          )}

          {orderedVisible.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-text-secondary)" }}>
              <Package size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
              <div style={{ fontSize: "14px", fontWeight: "600" }}>Nenhum produto encontrado</div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>Tenta outra pesquisa ou muda o filtro.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: productGridColumns, gap: "20px", justifyContent: "center", alignItems: "stretch" }}>
              {orderedVisible.map((product) => <ProdCard key={product.id} product={product} cart={cart} color={accent} currencyCode={currencyCode} onAdd={onAdd} onUpd={onUpd} />)}
            </div>
          )}
          </div>
        </div>
      </div>

      {cartCount > 0 && (
        <div style={{ position: "sticky", bottom: 0, padding: "12px 16px 16px", background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.94) 22%, rgba(255,255,255,0.98) 100%)", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
          <button data-testid="catalog-open-cart" onClick={() => setCartOpen(true)} style={{ width: "100%", padding: "14px", background: `linear-gradient(135deg, ${brand.accent} 0%, ${accent} 100%)`, color: "white", border: "none", borderRadius: "18px", cursor: "pointer", fontSize: "14px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 16px 34px rgba(28, 154, 116, 0.2)" }}>
            <ShoppingCart size={16} />
            Ver carrinho ({cartCount} {cartCount === 1 ? "item" : "itens"}) - {fmtMoney(cartTotal, currencyCode)}
          </button>
        </div>
      )}

      {cartOpen && <CartDrawer store={store} cart={cart} total={cartTotal} color={accent} orderMeta={orderMeta} setOrderMeta={setOrderMeta} onUpd={onUpd} onCheckout={onCheckout} onClose={() => setCartOpen(false)} checkoutBusy={checkoutBusy} />}

      {orderReceipt && (
        <OrderSuccessSheet
          order={orderReceipt.order}
          trackingUrl={orderReceipt.trackingUrl}
          merchantNotification={orderReceipt.merchantNotification}
          onClose={onCloseOrderReceipt}
          onTrack={onTrackOrderReceipt}
          onOpenWhatsApp={onOpenReceiptWhatsApp}
        />
      )}

      {toast && toastNode}
    </div>
  );
}
