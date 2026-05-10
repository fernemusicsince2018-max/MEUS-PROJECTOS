import React from "react";
import { ArrowLeft, Package, Phone, Pin, Search, ShoppingCart, Star, Store, X } from "lucide-react";
import { STORE_DEFAULTS } from "../../constants.js";
import { isProductOnPromotion, isSoldOut } from "../../utils/catalog.js";
import { fmtMoney } from "../../utils/format.js";
import { formatOrderDate } from "../../utils/orders.js";
import CartDrawer from "./CartDrawer.jsx";
import OrderSuccessSheet from "./OrderSuccessSheet.jsx";
import ProdCard from "./ProdCard.jsx";
import BrandMark from "../common/BrandMark.jsx";
import { CatalogMetric } from "../common/UiBits.jsx";

const PUBLIC_REVIEW_PAGE_SIZE = 12;
const PUBLIC_REVIEWS_AUTO_REFRESH_MS = 60 * 1000;

function resolvePublicReviewsRefreshLimit(pageInfo = {}, loadedReviews = []) {
  const visibleCount = Array.isArray(loadedReviews) ? loadedReviews.length : 0;
  const currentLimit = Math.max(0, Number(pageInfo?.limit || 0));
  const nextOffset = Math.max(0, Number(pageInfo?.nextOffset || 0));

  return Math.max(PUBLIC_REVIEW_PAGE_SIZE, currentLimit, nextOffset, visibleCount);
}

function mergeRefreshedPublicReviews(refreshedReviews = [], existingReviews = [], totalAvailable = null) {
  const safeRefreshedReviews = Array.isArray(refreshedReviews) ? refreshedReviews : [];
  const safeExistingReviews = Array.isArray(existingReviews) ? existingReviews : [];
  const parsedTotal = Number(totalAvailable);
  const hasKnownTotal = Number.isFinite(parsedTotal) && parsedTotal >= 0;
  const baseTargetLength = Math.max(
    safeRefreshedReviews.length,
    safeExistingReviews.length,
  );
  const targetLength = hasKnownTotal
    ? Math.min(baseTargetLength, Math.floor(parsedTotal))
    : baseTargetLength;
  const mergedReviews = [];
  const seenReviewIds = new Set();

  for (const review of safeRefreshedReviews) {
    if (!review?.id || seenReviewIds.has(review.id)) continue;
    seenReviewIds.add(review.id);
    mergedReviews.push(review);
  }

  for (const review of safeExistingReviews) {
    if (mergedReviews.length >= targetLength) break;
    if (!review?.id || seenReviewIds.has(review.id)) continue;
    seenReviewIds.add(review.id);
    mergedReviews.push(review);
  }

  return mergedReviews.slice(0, targetLength || safeRefreshedReviews.length);
}

function RatingStars({ rating = 0, size = 16, color = "#f59e0b" }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      {[1, 2, 3, 4, 5].map((value) => {
        const active = value <= Math.round(Number(rating || 0));
        return <Star key={value} size={size} color={color} fill={active ? color : "none"} />;
      })}
    </div>
  );
}

function getReviewDisplayDate(review) {
  const timestamp = review?.createdAt || review?.updatedAt;
  return timestamp ? formatOrderDate(timestamp) : "";
}

function ReviewCard({ review, featured = false }) {
  return (
    <div
      style={{
        padding: "18px",
        borderRadius: "24px",
        background: "white",
        border: "1px solid rgba(104, 128, 120, 0.12)",
        boxShadow: "0 14px 30px rgba(16,35,31,0.05)",
        display: "grid",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: "4px" }}>
          <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--color-text-primary)" }}>
            {review.customerLabel || "Cliente verificado"}
          </div>
          {getReviewDisplayDate(review) ? (
            <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
              Avaliado em {getReviewDisplayDate(review)}
            </div>
          ) : null}
        </div>
        <div style={{ display: "grid", justifyItems: "end", gap: "6px" }}>
          {featured ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "999px", background: "#ecfccb", color: "#3f6212", fontSize: "11px", fontWeight: "800" }}>
              <Pin size={12} /> Em destaque
            </div>
          ) : null}
          <RatingStars rating={review.rating} size={14} />
        </div>
      </div>
      <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.75 }}>
        {review.comment
          ? `"${review.comment}"`
          : "Este cliente avaliou a loja, mas não deixou comentário escrito."}
      </div>
    </div>
  );
}

function ReviewColumn({
  title,
  description,
  reviews = [],
  emptyMessage,
  countLabel = "",
  featured = false,
}) {
  return (
    <div style={{ padding: "18px", borderRadius: "24px", background: "rgba(255,255,255,0.88)", border: "1px solid rgba(104, 128, 120, 0.1)", display: "grid", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "15px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{title}</div>
          <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            {description}
          </div>
        </div>
        {countLabel ? (
          <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>{countLabel}</div>
        ) : null}
      </div>

      {reviews.length > 0 ? (
        <div style={{ display: "grid", gap: "12px" }}>
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              featured={featured || review.isFeatured}
            />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

function ReviewsModal({
  open,
  onClose,
  reviewSummary,
  reviews,
  loading = false,
  loadingMore = false,
  error = "",
  hasMore = false,
  onLoadMore,
}) {
  if (!open) return null;

  const totalReviews = Math.max(0, Number(reviewSummary?.totalReviews || 0));
  const averageRating = Number(reviewSummary?.averageRating || 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 30,
        background: "rgba(12, 37, 34, 0.52)",
        padding: "20px 14px",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(100%, 940px)",
          maxHeight: "min(88vh, 920px)",
          overflow: "auto",
          borderRadius: "30px",
          background: "linear-gradient(180deg, #ffffff 0%, #f7faf6 100%)",
          border: "1px solid rgba(104, 128, 120, 0.16)",
          boxShadow: "0 28px 70px rgba(12,37,34,0.24)",
          padding: "22px",
          display: "grid",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-secondary)", fontWeight: "800" }}>
              Todas as avaliações
            </div>
            <div style={{ fontSize: "28px", fontWeight: "800", fontFamily: "var(--font-display)", lineHeight: 1.05 }}>
              Clientes reais e histórico completo da loja.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "18px", fontWeight: "800" }}>{averageRating.toFixed(1)}</div>
              <RatingStars rating={averageRating} />
              <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                {totalReviews} avaliação(ões)
              </div>
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              Esta janela atualiza os comentários automaticamente a cada 1 minuto enquanto estiver aberta.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "999px",
              border: "1px solid rgba(104, 128, 120, 0.16)",
              background: "white",
              color: "var(--color-text-primary)",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div style={{ padding: "14px 16px", borderRadius: "18px", background: "#fff1f2", color: "#be123c", fontSize: "13px", lineHeight: 1.6 }}>
            {error}
          </div>
        ) : null}

        {loading && !reviews.length ? (
          <div style={{ padding: "34px 20px", borderRadius: "22px", background: "rgba(255,255,255,0.86)", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "13px" }}>
            A carregar avaliações...
          </div>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                featured={review.isFeatured}
              />
            ))}

            {!reviews.length && !error ? (
              <div style={{ padding: "30px 20px", borderRadius: "22px", background: "rgba(255,255,255,0.86)", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "13px", lineHeight: 1.7 }}>
                Ainda não existem avaliações públicas para mostrar nesta loja.
              </div>
            ) : null}
          </div>
        )}

        {hasMore ? (
          <div style={{ display: "grid", justifyItems: "center" }}>
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              style={{
                minWidth: "240px",
                padding: "14px 18px",
                borderRadius: "18px",
                border: "1px solid rgba(104, 128, 120, 0.16)",
                background: "white",
                color: "var(--color-text-primary)",
                fontSize: "13px",
                fontWeight: "800",
                cursor: loadingMore ? "not-allowed" : "pointer",
                opacity: loadingMore ? 0.65 : 1,
              }}
            >
              {loadingMore ? "A carregar..." : "Carregar mais avaliações"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function Catalog({
  brand,
  mode,
  storeId = "",
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
  onLoadPublicStoreReviews,
  toast,
  onBack,
  toastNode,
}) {
  const accent = store.color || STORE_DEFAULTS.color;
  const currencyCode = store.currencyCode || STORE_DEFAULTS.currencyCode;
  const categories = [...new Set(prods.map((product) => product.category).filter(Boolean))];
  const featured = prods.filter((product) => product.featured);
  const reviewSummary =
    store.reviewSummary && typeof store.reviewSummary === "object"
      ? store.reviewSummary
      : null;
  const testimonials = Array.isArray(store.testimonials)
    ? store.testimonials.filter((entry) => entry?.id && entry?.comment)
    : [];
  const featuredTestimonials = Array.isArray(store.featuredTestimonials)
    ? store.featuredTestimonials.filter((entry) => entry?.id && entry?.comment)
    : testimonials.filter((entry) => entry?.isFeatured).slice(0, 5);
  const recentTestimonials = Array.isArray(store.recentTestimonials)
    ? store.recentTestimonials.filter((entry) => entry?.id && entry?.comment)
    : testimonials.filter((entry) => !entry?.isFeatured).slice(0, 3);
  const totalReviews = Math.max(0, Number(reviewSummary?.totalReviews || 0));
  const testimonialCount = Math.max(
    0,
    Number(reviewSummary?.testimonialCount || testimonials.length || 0),
  );
  const featuredReviewCount = Math.max(
    0,
    Number(reviewSummary?.featuredCount || featuredTestimonials.length || 0),
  );
  const nonFeaturedTestimonialCount = Math.max(0, testimonialCount - featuredReviewCount);
  const [activeFilter, setActiveFilter] = React.useState("");
  const [reviewsModalOpen, setReviewsModalOpen] = React.useState(false);
  const [publicReviews, setPublicReviews] = React.useState([]);
  const [publicReviewSummary, setPublicReviewSummary] = React.useState(reviewSummary || null);
  const [publicReviewsPageInfo, setPublicReviewsPageInfo] = React.useState({
    total: totalReviews,
    limit: PUBLIC_REVIEW_PAGE_SIZE,
    offset: 0,
    hasMore: false,
    nextOffset: 0,
  });
  const [publicReviewsLoading, setPublicReviewsLoading] = React.useState(false);
  const [publicReviewsLoadingMore, setPublicReviewsLoadingMore] = React.useState(false);
  const [publicReviewsError, setPublicReviewsError] = React.useState("");
  const [publicReviewsStoreId, setPublicReviewsStoreId] = React.useState("");
  const publicReviewsRefreshInFlightRef = React.useRef(false);
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

  React.useEffect(() => {
    setPublicReviewSummary(reviewSummary || null);
  }, [reviewSummary]);

  React.useEffect(() => {
    setReviewsModalOpen(false);
    setPublicReviews([]);
    setPublicReviewSummary(reviewSummary || null);
    setPublicReviewsError("");
    setPublicReviewsStoreId("");
    setPublicReviewsPageInfo({
      total: totalReviews,
      limit: PUBLIC_REVIEW_PAGE_SIZE,
      offset: 0,
      hasMore: false,
      nextOffset: 0,
    });
  }, [storeId, reviewSummary, totalReviews]);

  async function loadPublicReviews({ reset = false, silent = false, limit = null } = {}) {
    if (!onLoadPublicStoreReviews || !storeId || publicReviewsRefreshInFlightRef.current) {
      return;
    }

    const offset = reset ? 0 : Number(publicReviewsPageInfo.nextOffset || 0);
    const requestLimit = Math.max(
      PUBLIC_REVIEW_PAGE_SIZE,
      Number(limit || publicReviewsPageInfo.limit || PUBLIC_REVIEW_PAGE_SIZE),
    );
    publicReviewsRefreshInFlightRef.current = true;

    if (reset) {
      if (!silent) {
        setPublicReviewsLoading(true);
      }
    } else {
      setPublicReviewsLoadingMore(true);
    }
    setPublicReviewsError("");

    try {
      const response = await onLoadPublicStoreReviews(storeId, {
        limit: requestLimit,
        offset,
      });
      const incomingReviews = Array.isArray(response?.reviews) ? response.reviews : [];
      const currentReviews = Array.isArray(publicReviews) ? publicReviews : [];
      const nextVisibleReviews = reset
        ? mergeRefreshedPublicReviews(incomingReviews, currentReviews, response?.pageInfo?.total)
        : (() => {
          const next = [...currentReviews];
          const seenIds = new Set(currentReviews.map((entry) => entry.id));
          for (const review of incomingReviews) {
            if (review?.id && !seenIds.has(review.id)) {
              seenIds.add(review.id);
              next.push(review);
            }
          }
          return next;
        })();
      setPublicReviews(nextVisibleReviews);
      setPublicReviewSummary(response?.reviewSummary || reviewSummary || null);
      setPublicReviewsPageInfo({
        total: Math.max(0, Number(response?.pageInfo?.total || totalReviews)),
        limit: Math.max(1, Number(response?.pageInfo?.limit || PUBLIC_REVIEW_PAGE_SIZE)),
        offset: Math.max(0, Number(response?.pageInfo?.offset || offset)),
        hasMore: nextVisibleReviews.length < Math.max(0, Number(response?.pageInfo?.total || totalReviews)),
        nextOffset: Math.max(
          0,
          reset
            ? nextVisibleReviews.length
            : Number(response?.pageInfo?.nextOffset || offset + incomingReviews.length),
        ),
      });
      setPublicReviewsStoreId(storeId);
    } catch (error) {
      setPublicReviewsError(error.message || "Não foi possível carregar as avaliações desta loja.");
    } finally {
      publicReviewsRefreshInFlightRef.current = false;
      if (!silent) {
        setPublicReviewsLoading(false);
      }
      setPublicReviewsLoadingMore(false);
    }
  }

  function handleOpenReviewsModal() {
    setReviewsModalOpen(true);
    if (publicReviewsStoreId !== storeId || publicReviews.length === 0) {
      loadPublicReviews({ reset: true }).catch(() => {});
    }
  }

  React.useEffect(() => {
    if (!reviewsModalOpen || !onLoadPublicStoreReviews || !storeId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (publicReviewsLoading || publicReviewsLoadingMore) {
        return;
      }

      loadPublicReviews({
        reset: true,
        silent: true,
        limit: resolvePublicReviewsRefreshLimit(publicReviewsPageInfo, publicReviews),
      }).catch(() => {});
    }, PUBLIC_REVIEWS_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    reviewsModalOpen,
    onLoadPublicStoreReviews,
    storeId,
    publicReviews,
    publicReviewsPageInfo,
    publicReviewsLoading,
    publicReviewsLoadingMore,
  ]);

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
                <Store size={12} /> Seleção {brand.name}
              </div>
              <div style={{ fontSize: "21px", fontFamily: "var(--font-display)", fontWeight: "800", marginBottom: "6px", lineHeight: 1.18, letterSpacing: "-0.03em", maxWidth: "760px", color: "var(--color-text-primary)" }}>Os produtos em destaque aparecem primeiro e deixam a vitrine mais elegante.</div>
              <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7, maxWidth: "760px" }}>Promoções, novidades e itens com melhor margem ficam mais visíveis para o cliente sem poluir o catálogo.</div>
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

          {(totalReviews > 0 || testimonials.length > 0) ? (
            <div style={{ marginTop: "22px", display: "grid", gap: "14px" }}>
              <div style={{ padding: "18px 20px", borderRadius: "26px", background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(247,250,246,0.98) 100%)", border: "1px solid rgba(104, 128, 120, 0.12)", boxShadow: "0 18px 34px rgba(16,35,31,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: "6px" }}>
                    <div style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-secondary)", fontWeight: "800" }}>
                      Prova social
                    </div>
                    <div style={{ fontSize: "22px", fontFamily: "var(--font-display)", fontWeight: "800", lineHeight: 1.15 }}>
                      Clientes reais já avaliaram esta loja.
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                      Vê as estrelas e alguns comentários deixados por quem já comprou aqui.
                    </div>
                  </div>

                  <div style={{ minWidth: "220px", padding: "16px 18px", borderRadius: "22px", background: "rgba(255,255,255,0.86)", border: "1px solid rgba(104, 128, 120, 0.1)", display: "grid", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "30px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                        {Number(reviewSummary?.averageRating || 0).toFixed(1)}
                      </div>
                      <RatingStars rating={reviewSummary?.averageRating || 0} />
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      {totalReviews || testimonials.length} avaliação(ões)
                      {testimonialCount > 0 ? ` · ${testimonialCount} comentário(s) publicados` : ""}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      {featuredReviewCount > 0
                        ? `${featuredReviewCount} testemunho(s) em destaque`
                        : "A mostrar confiança real da loja"}
                    </div>
                    {totalReviews > 0 ? (
                      <button
                        type="button"
                        onClick={handleOpenReviewsModal}
                        style={{
                          marginTop: "4px",
                          padding: "12px 14px",
                          borderRadius: "16px",
                          border: "1px solid rgba(104, 128, 120, 0.16)",
                          background: "white",
                          color: "var(--color-text-primary)",
                          fontSize: "12px",
                          fontWeight: "800",
                          cursor: "pointer",
                        }}
                      >
                        Ver todas as {totalReviews} avaliações
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {featuredTestimonials.length > 0 || recentTestimonials.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
                  <ReviewColumn
                    title="Testemunhos em destaque"
                    description="Os comentários mais fortes escolhidos pela própria loja."
                    reviews={featuredTestimonials}
                    countLabel={featuredReviewCount > 0 ? `${featuredReviewCount} fixado(s)` : ""}
                    featured
                    emptyMessage="A loja ainda não fixou testemunhos. Quando isso acontecer, eles vão aparecer primeiro aqui."
                  />
                  <ReviewColumn
                    title="Avaliações recentes"
                    description="Os comentários mais novos para mostrar que a loja continua ativa."
                    reviews={recentTestimonials}
                    countLabel={
                      nonFeaturedTestimonialCount > recentTestimonials.length
                        ? `+${Math.max(0, nonFeaturedTestimonialCount - recentTestimonials.length)} comentário(s) no histórico`
                        : ""
                    }
                    emptyMessage="Já existem estrelas registadas, mas ainda não há comentários recentes para mostrar nesta vitrine."
                  />
                </div>
              ) : (
                <div style={{ padding: "18px 20px", borderRadius: "24px", background: "rgba(255,255,255,0.88)", border: "1px solid rgba(104, 128, 120, 0.1)", fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                  Esta loja já recebeu estrelas, mas os clientes ainda não deixaram comentários escritos para mostrar aqui.
                </div>
              )}
            </div>
          ) : null}
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

      <ReviewsModal
        open={reviewsModalOpen}
        onClose={() => setReviewsModalOpen(false)}
        reviewSummary={publicReviewSummary || reviewSummary}
        reviews={publicReviews}
        loading={publicReviewsLoading}
        loadingMore={publicReviewsLoadingMore}
        error={publicReviewsError}
        hasMore={Boolean(publicReviewsPageInfo.hasMore)}
        onLoadMore={() => loadPublicReviews({ reset: false })}
      />

      {toast && toastNode}
    </div>
  );
}
