import React from "react";
import { ChevronLeft, ChevronRight, Minus, Package, Percent, Plus, Star, Tag, X } from "lucide-react";
import { SURFACE_STYLE } from "../../constants.js";
import { getDiscountPercent, getMaxQty, getProductBadge, getProductGallery, hasLimitedStock, isProductOnPromotion } from "../../utils/catalog.js";
import { fmtMoney } from "../../utils/format.js";
import { Badge } from "../common/UiBits.jsx";

const SWIPE_THRESHOLD = 44;

function createSwipeHandlers({ enabled, onPrev, onNext }) {
  let touchStartX = 0;
  let touchStartY = 0;

  return {
    onTouchStart(event) {
      if (!enabled) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    },
    onTouchEnd(event) {
      if (!enabled) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      if (deltaX < 0) {
        onNext();
        return;
      }

      onPrev();
    },
  };
}

function GalleryViewer({ productName, gallery, activeIndex, onSelect, onClose }) {
  const currentImage = gallery[activeIndex] || "";
  const hasGallery = gallery.length > 1;
  const handlePrev = React.useCallback(() => {
    onSelect(activeIndex === 0 ? gallery.length - 1 : activeIndex - 1);
  }, [activeIndex, gallery.length, onSelect]);
  const handleNext = React.useCallback(() => {
    onSelect(activeIndex === gallery.length - 1 ? 0 : activeIndex + 1);
  }, [activeIndex, gallery.length, onSelect]);
  const swipeHandlers = React.useMemo(
    () =>
      createSwipeHandlers({
        enabled: gallery.length > 1,
        onPrev: handlePrev,
        onNext: handleNext,
      }),
    [gallery.length, handleNext, handlePrev],
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(15,23,42,0.78)", padding: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "1160px", maxHeight: "92vh", overflow: "auto", background: "white", borderRadius: "28px", padding: "22px", boxSizing: "border-box", boxShadow: "0 28px 80px rgba(15,23,42,0.28)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "18px" }}>
          <div>
            <div style={{ fontSize: "19px", fontWeight: "800", lineHeight: 1.2 }}>{productName}</div>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
              Foto {activeIndex + 1} de {gallery.length}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: "34px", height: "34px", borderRadius: "999px", border: "0.5px solid var(--color-border-tertiary)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: hasGallery ? "92px minmax(0, 1fr)" : "minmax(0, 1fr)", gap: "18px", alignItems: "start" }}>
          {hasGallery && (
            <div style={{ display: "grid", gap: "10px", maxHeight: "72vh", overflowY: "auto", paddingRight: "4px" }}>
              {gallery.map((image, index) => (
                <button
                  key={`${productName}-gallery-${index + 1}`}
                  type="button"
                  onClick={() => onSelect(index)}
                  style={{ padding: 0, borderRadius: "18px", overflow: "hidden", border: index === activeIndex ? "3px solid #16a34a" : "1px solid var(--color-border-tertiary)", background: index === activeIndex ? "rgba(22,163,74,0.08)" : "white", cursor: "pointer", boxShadow: index === activeIndex ? "0 10px 24px rgba(22,163,74,0.18)" : "none" }}
                >
                  <img src={image} alt={`${productName} ${index + 1}`} style={{ width: "100%", height: "92px", objectFit: "cover", display: "block" }} />
                </button>
              ))}
            </div>
          )}

          <div
            style={{ position: "relative", minHeight: "420px", borderRadius: "24px", background: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)", border: "1px solid rgba(148,163,184,0.16)", padding: "18px", touchAction: hasGallery ? "pan-y" : "auto" }}
            onTouchStart={swipeHandlers.onTouchStart}
            onTouchEnd={swipeHandlers.onTouchEnd}
          >
            {currentImage ? (
              <img src={currentImage} alt={productName} style={{ width: "100%", height: "min(72vh, 760px)", objectFit: "contain", borderRadius: "18px" }} />
            ) : (
              <div style={{ height: "420px", borderRadius: "18px", background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={28} style={{ opacity: 0.25 }} />
              </div>
            )}

            {hasGallery && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", width: "46px", height: "46px", borderRadius: "999px", border: "none", background: "rgba(15,23,42,0.78)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 12px 32px rgba(15,23,42,0.22)" }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", width: "46px", height: "46px", borderRadius: "999px", border: "none", background: "rgba(15,23,42,0.78)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 12px 32px rgba(15,23,42,0.22)" }}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            <div style={{ position: "absolute", top: "16px", right: "16px", padding: "7px 11px", borderRadius: "999px", background: "rgba(15,23,42,0.76)", color: "white", fontSize: "12px", fontWeight: "800", letterSpacing: "0.03em" }}>
              {activeIndex + 1}/{gallery.length}
            </div>
          </div>
        </div>

        {hasGallery && (
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "14px", textAlign: "center" }}>
            Miniaturas na esquerda e foto principal ao centro. Desliza ou usa as setas para alternar.
          </div>
        )}

        {!hasGallery && gallery.length === 1 && (
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "14px", textAlign: "center" }}>
            Esta galeria tem uma unica foto neste momento.
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProdCard({ product, cart, color, currencyCode, onAdd, onUpd }) {
  const item = cart.find((entry) => entry.id === product.id);
  const maxQty = getMaxQty(product);
  const soldOut = maxQty < 1;
  const discount = getDiscountPercent(product);
  const badge = getProductBadge(product);
  const canIncrease = item ? item.qty < maxQty : true;
  const gallery = getProductGallery(product);
  const hasGallery = gallery.length > 1;
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [currentImageFailed, setCurrentImageFailed] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const activeImage = gallery[activeImageIndex] || "";
  const mediaHeight = "clamp(172px, 22vw, 214px)";

  function selectImage(index) {
    setCurrentImageFailed(false);
    setActiveImageIndex(index);
  }

  const handlePrevImage = React.useCallback(() => {
    selectImage(activeImageIndex === 0 ? gallery.length - 1 : activeImageIndex - 1);
  }, [activeImageIndex, gallery.length]);
  const handleNextImage = React.useCallback(() => {
    selectImage(activeImageIndex === gallery.length - 1 ? 0 : activeImageIndex + 1);
  }, [activeImageIndex, gallery.length]);
  const swipeHandlers = React.useMemo(
    () =>
      createSwipeHandlers({
        enabled: hasGallery,
        onPrev: handlePrevImage,
        onNext: handleNextImage,
      }),
    [handleNextImage, handlePrevImage, hasGallery],
  );

  React.useEffect(() => {
    setActiveImageIndex(0);
    setCurrentImageFailed(false);
    setViewerOpen(false);
  }, [product.id, product.image, gallery.length]);

  return (
    <>
      <div data-testid={`catalog-product-${product.id}`} style={{ ...SURFACE_STYLE, width: "100%", minWidth: 0, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, #fdfefc 100%)", boxShadow: "0 20px 44px rgba(16,35,31,0.07)" }}>
        <div style={{ padding: "12px 12px 0" }}>
          <div
            style={{
              position: "relative",
              minHeight: mediaHeight,
              borderRadius: "24px",
              overflow: "hidden",
              touchAction: hasGallery ? "pan-y" : "auto",
              background: "radial-gradient(circle at top right, rgba(28,154,116,0.08), transparent 36%), radial-gradient(circle at bottom left, rgba(240,201,120,0.11), transparent 30%), linear-gradient(180deg, #ffffff 0%, #f6f8f3 100%)",
              border: "1px solid rgba(104, 128, 120, 0.14)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.82)",
            }}
            onTouchStart={swipeHandlers.onTouchStart}
            onTouchEnd={swipeHandlers.onTouchEnd}
            onClick={hasGallery ? () => setViewerOpen(true) : undefined}
          >
            <div style={{ position: "absolute", inset: "0 0 auto 0", height: "3px", background: `linear-gradient(90deg, ${color} 0%, rgba(240,201,120,0.82) 100%)`, opacity: 0.7 }} />
            {activeImage && !currentImageFailed ? (
              <img
                key={`${product.id}-${activeImage}`}
                src={activeImage}
                alt={product.name}
                style={{ width: "100%", height: mediaHeight, objectFit: "contain", padding: "22px 18px 16px", cursor: hasGallery ? "zoom-in" : "default" }}
                onError={() => {
                  setCurrentImageFailed(true);
                }}
              />
            ) : (
              <div style={{ height: mediaHeight, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(244,247,241,0.72)" }}>
                <Package size={22} style={{ opacity: 0.25 }} />
              </div>
            )}

            <div style={{ position: "absolute", top: "14px", left: "12px", display: "flex", gap: "6px", flexWrap: "wrap", maxWidth: "74%" }}>
              {isProductOnPromotion(product) && (
                <Badge bg="rgba(255,255,255,0.92)" color="#9f1239" borderColor="rgba(190,24,93,0.16)" style={{ backdropFilter: "blur(10px)", fontWeight: "700" }}>
                  <Percent size={10} /> Promocao
                </Badge>
              )}
              {product.featured && (
                <Badge bg="rgba(255,255,255,0.92)" color="#9a6700" borderColor="rgba(180,83,9,0.14)" style={{ backdropFilter: "blur(10px)", fontWeight: "700" }}>
                  <Star size={10} /> Destaque
                </Badge>
              )}
              {discount > 0 && <Badge bg="rgba(255,255,255,0.92)" color="#166534" borderColor="rgba(22,101,52,0.16)" style={{ backdropFilter: "blur(10px)", fontWeight: "700" }}>-{discount}%</Badge>}
            </div>

            {hasGallery && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setViewerOpen(true);
                  }}
                  style={{ position: "absolute", left: "50%", bottom: "12px", transform: "translateX(-50%)", padding: "7px 12px", borderRadius: "999px", border: "1px solid rgba(104, 128, 120, 0.18)", background: "rgba(255,255,255,0.9)", color: "var(--color-text-primary)", fontSize: "11px", fontWeight: "700", cursor: "pointer", boxShadow: "0 12px 24px rgba(15,23,42,0.1)", whiteSpace: "nowrap", backdropFilter: "blur(10px)" }}
                >
                  Ver {gallery.length} fotos
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePrevImage();
                  }}
                  aria-label="Imagem anterior"
                  style={{ position: "absolute", left: "10px", bottom: "12px", width: "32px", height: "32px", borderRadius: "999px", border: "1px solid rgba(104, 128, 120, 0.16)", background: "rgba(255,255,255,0.9)", color: "var(--color-text-primary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 8px 18px rgba(15,23,42,0.1)", backdropFilter: "blur(8px)" }}
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleNextImage();
                  }}
                  aria-label="Proxima imagem"
                  style={{ position: "absolute", right: "10px", bottom: "12px", width: "32px", height: "32px", borderRadius: "999px", border: "1px solid rgba(104, 128, 120, 0.16)", background: "rgba(255,255,255,0.9)", color: "var(--color-text-primary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 8px 18px rgba(15,23,42,0.1)", backdropFilter: "blur(8px)" }}
                >
                  <ChevronRight size={15} />
                </button>
                <div style={{ position: "absolute", right: "12px", top: "12px", padding: "5px 8px", borderRadius: "999px", background: "rgba(16,35,31,0.68)", color: "white", fontSize: "11px", fontWeight: "700", backdropFilter: "blur(10px)" }}>
                  {activeImageIndex + 1}/{gallery.length}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ padding: "14px 14px 13px", display: "flex", flexDirection: "column", flex: 1 }}>
          {hasGallery && (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(gallery.length, 4)}, minmax(0, 1fr))`, gap: "6px", marginBottom: "8px" }}>
                {gallery.map((image, index) => (
                  <button
                    key={`${product.id}-thumb-${index + 1}`}
                    type="button"
                    onClick={() => selectImage(index)}
                    aria-label={`Ver imagem ${index + 1}`}
                    style={{ padding: 0, borderRadius: "12px", overflow: "hidden", border: index === activeImageIndex ? `1.5px solid ${color}` : "1px solid rgba(104, 128, 120, 0.14)", background: "white", cursor: "pointer", boxShadow: index === activeImageIndex ? "0 10px 18px rgba(16,35,31,0.1)" : "none" }}
                  >
                    <img src={image} alt={`${product.name} ${index + 1}`} style={{ width: "100%", height: "42px", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setViewerOpen(true)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "12px", border: "1px solid rgba(104, 128, 120, 0.14)", background: "rgba(246,248,243,0.9)", cursor: "pointer", fontSize: "12px", fontWeight: "700", color: "var(--color-text-primary)" }}
                >
                  Ver todas as {gallery.length} fotos
                </button>
                <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", textAlign: "center" }}>
                  Toque para ampliar ou trocar a vista.
                </div>
              </div>
            </div>
          )}

          <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "8px", lineHeight: "1.45", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", minHeight: "41px", letterSpacing: "-0.01em" }}>{product.name}</div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
            {product.category && (
              <Badge bg="rgba(246,248,243,0.92)" color="var(--color-text-secondary)" borderColor="rgba(104, 128, 120, 0.12)" style={{ fontWeight: "700" }}>
                <Tag size={9} /> {product.category}
              </Badge>
            )}
            <Badge bg={badge.bg} color={badge.color} borderColor="rgba(104, 128, 120, 0.08)" style={{ fontWeight: "700" }}>{badge.label}</Badge>
          </div>

          {product.description && <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginBottom: "12px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.7 }}>{product.description}</div>}

          <div style={{ marginTop: "auto" }}>
            <div style={{ height: "1px", background: "linear-gradient(90deg, rgba(104, 128, 120, 0.04), rgba(104, 128, 120, 0.18), rgba(104, 128, 120, 0.04))", marginBottom: "12px" }} />
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "6px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color, letterSpacing: "-0.03em" }}>{fmtMoney(product.price, currencyCode)}</div>
              {product.compareAt > product.price && <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", textDecoration: "line-through" }}>{fmtMoney(product.compareAt, currencyCode)}</div>}
            </div>

            <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginBottom: "12px", lineHeight: 1.6 }}>
              {hasLimitedStock(product) ? `${product.stock} unidade${Number(product.stock) === 1 ? "" : "s"} disponiveis` : "Disponibilidade imediata"}
            </div>

            {!item ? (
              <button data-testid={`catalog-add-product-${product.id}`} onClick={() => onAdd(product)} disabled={soldOut} style={{ width: "100%", padding: "11px", background: soldOut ? "var(--color-background-secondary)" : `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`, color: soldOut ? "var(--color-text-secondary)" : "white", border: "none", borderRadius: "16px", cursor: soldOut ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", boxShadow: soldOut ? "none" : "0 16px 28px rgba(28, 154, 116, 0.16)" }}>
                <Plus size={12} /> {soldOut ? "Indisponivel" : "Adicionar"}
              </button>
            ) : (
              <div style={{ padding: "8px 10px", borderRadius: "16px", border: "1px solid rgba(104, 128, 120, 0.12)", background: "rgba(246,248,243,0.72)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <button onClick={() => onUpd(product.id, item.qty - 1)} style={{ width: "30px", height: "30px", borderRadius: "50%", border: `1.5px solid ${color}`, background: "rgba(255,255,255,0.9)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color }}>
                    <Minus size={12} />
                  </button>
                  <span style={{ fontSize: "14px", fontWeight: "600" }}>{item.qty}</span>
                  <button onClick={() => onUpd(product.id, item.qty + 1)} disabled={!canIncrease} style={{ width: "30px", height: "30px", borderRadius: "50%", border: "none", background: canIncrease ? color : "var(--color-background-secondary)", cursor: canIncrease ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", color: canIncrease ? "white" : "var(--color-text-secondary)" }}>
                    <Plus size={12} />
                  </button>
                </div>
                {!canIncrease && hasLimitedStock(product) && <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", textAlign: "center", marginTop: "6px" }}>Limite de stock atingido</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewerOpen && hasGallery && (
        <GalleryViewer
          productName={product.name}
          gallery={gallery}
          activeIndex={activeImageIndex}
          onSelect={selectImage}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
