import { Edit2, ExternalLink, Package, Percent, Plus, Star, Tag, Trash2 } from "lucide-react";
import { SURFACE_STYLE } from "../../constants.js";
import { fmtMoney } from "../../utils/format.js";
import { getDiscountPercent, getProductBadge, getProductGallery, hasLimitedStock, isProductOnPromotion, isSoldOut } from "../../utils/catalog.js";
import { Badge } from "../common/UiBits.jsx";

export default function ProductsTab({ prods, color, currencyCode, onAdd, onEdit, onDel, catalogLocked = false, planAccessMessage = "", activationUrl = "" }) {
  const ordered = [...prods].sort(
    (a, b) =>
      Number(isSoldOut(a)) - Number(isSoldOut(b)) ||
      Number(isProductOnPromotion(b)) - Number(isProductOnPromotion(a)) ||
      Number(b.featured) - Number(a.featured) ||
      a.name.localeCompare(b.name),
  );

  return (
    <div>
      {catalogLocked && (
        <div
          style={{
            marginBottom: "16px",
            padding: "14px 16px",
            borderRadius: "var(--border-radius-lg)",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "4px" }}>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#9a3412" }}>
              {planAccessMessage || "Ativa um plano para voltar a gerir os produtos da tua loja."}
            </div>
            <div style={{ fontSize: "12px", color: "#9a3412" }}>
              Enquanto o plano nao estiver ativo, nao podes adicionar, editar nem remover produtos.
            </div>
          </div>

          {activationUrl ? (
            <a
              href={activationUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                background: color,
                color: "white",
                border: "none",
                borderRadius: "var(--border-radius-md)",
                padding: "10px 16px",
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: "700",
                textDecoration: "none",
              }}
            >
              Ativar plano para adicionar produtos <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: "600" }}>Meus produtos</div>
          <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            Organiza o stock, destaca promocoes e controla o que esta disponivel.
          </div>
        </div>

        <button
          data-testid="products-add"
          onClick={catalogLocked ? undefined : onAdd}
          disabled={catalogLocked}
          style={{
            background: catalogLocked ? "var(--color-border-tertiary)" : color,
            color: "white",
            border: "none",
            borderRadius: "var(--border-radius-md)",
            padding: "9px 16px",
            fontSize: "13px",
            cursor: catalogLocked ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: "600",
            opacity: catalogLocked ? 0.7 : 1,
          }}
        >
          <Plus size={13} /> {catalogLocked ? "Ativa um plano para adicionar" : "Adicionar produto"}
        </button>
      </div>

      {ordered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            border: "1px dashed var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            color: "var(--color-text-secondary)",
            background: "var(--color-background-primary)",
          }}
        >
          <Package size={36} style={{ marginBottom: "12px", opacity: 0.35 }} />
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>Ainda nao tens produtos</div>
          <div style={{ fontSize: "13px" }}>Cria o primeiro item para comecar a montar o catalogo.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
          {ordered.map((product) => {
            const badge = getProductBadge(product);
            const discount = getDiscountPercent(product);
            const gallery = getProductGallery(product);
            const coverImage = gallery[0] || "";
            const missingImages = Math.max(0, 4 - gallery.length);
            const publicGalleryReady = gallery.length > 1;

            return (
              <div key={product.id} style={{ ...SURFACE_STYLE, overflow: "hidden" }}>
                <div style={{ position: "relative" }}>
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt={product.name}
                      style={{ width: "100%", height: "150px", objectFit: "cover" }}
                      onError={(event) => {
                        event.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <div style={{ height: "96px", background: "var(--color-background-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Package size={24} style={{ opacity: 0.3 }} />
                    </div>
                  )}

                  <div style={{ position: "absolute", top: "10px", left: "10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {isProductOnPromotion(product) && (
                      <Badge bg="#fee2e2" color="#be123c">
                        <Percent size={10} /> Promocao
                      </Badge>
                    )}
                    {product.featured && (
                      <Badge bg="#fef3c7" color="#b45309">
                        <Star size={10} /> Destaque
                      </Badge>
                    )}
                    {discount > 0 && <Badge bg="#dcfce7" color="#166534">-{discount}%</Badge>}
                  </div>

                  {gallery.length > 1 && (
                    <div style={{ position: "absolute", right: "10px", bottom: "10px", padding: "5px 8px", borderRadius: "999px", background: "rgba(15,23,42,0.7)", color: "white", fontSize: "11px", fontWeight: "700" }}>
                      {gallery.length} fotos
                    </div>
                  )}
                </div>

                <div style={{ padding: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>{product.name}</div>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                    {product.category && (
                      <Badge bg="var(--color-background-secondary)" color="var(--color-text-secondary)">
                        <Tag size={9} /> {product.category}
                      </Badge>
                    )}
                    {gallery.length > 0 && (
                      <Badge bg="#ecfeff" color="#0f766e">
                        {gallery.length} foto{gallery.length === 1 ? "" : "s"}
                      </Badge>
                    )}
                    {missingImages > 0 && (
                      <Badge bg="#fff7ed" color="#c2410c">
                        Faltam {missingImages}
                      </Badge>
                    )}
                    <Badge bg={badge.bg} color={badge.color}>{badge.label}</Badge>
                  </div>

                  {gallery.length > 1 && (
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(gallery.length, 4)}, minmax(0, 1fr))`, gap: "6px", marginBottom: "10px" }}>
                      {gallery.map((image, index) => (
                        <div key={`${product.id}-preview-${index + 1}`} style={{ borderRadius: "10px", overflow: "hidden", border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)" }}>
                          <img src={image} alt={`${product.name} ${index + 1}`} style={{ width: "100%", height: "38px", objectFit: "cover", display: "block" }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {product.description && (
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "8px", minHeight: "34px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {product.description}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ fontSize: "16px", fontWeight: "700", color }}>{fmtMoney(product.price, currencyCode)}</div>
                    {product.compareAt > product.price && (
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", textDecoration: "line-through" }}>{fmtMoney(product.compareAt, currencyCode)}</div>
                    )}
                  </div>

                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "12px" }}>
                    {hasLimitedStock(product) ? `Stock: ${product.stock}` : "Stock livre"}
                  </div>

                  <div style={{ fontSize: "11px", color: publicGalleryReady ? "#166534" : "#9a3412", marginBottom: "12px" }}>
                    {publicGalleryReady
                      ? "Galeria publica ativa: o cliente pode abrir e deslizar entre as fotos."
                      : "Galeria publica ainda inativa: adiciona pelo menos 2 fotos. Ideal: 4/4."}
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={catalogLocked ? undefined : () => onEdit(product)}
                      disabled={catalogLocked}
                      style={{
                        flex: 1,
                        padding: "7px",
                        border: "0.5px solid var(--color-border-tertiary)",
                        borderRadius: "var(--border-radius-md)",
                        background: "transparent",
                        cursor: catalogLocked ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                        color: "var(--color-text-secondary)",
                        opacity: catalogLocked ? 0.45 : 1,
                      }}
                    >
                      <Edit2 size={11} /> Editar
                    </button>
                    <button
                      onClick={catalogLocked ? undefined : () => onDel(product.id)}
                      disabled={catalogLocked}
                      style={{
                        padding: "7px 10px",
                        border: "0.5px solid var(--color-border-tertiary)",
                        borderRadius: "var(--border-radius-md)",
                        background: "transparent",
                        cursor: catalogLocked ? "not-allowed" : "pointer",
                        color: "var(--color-text-secondary)",
                        opacity: catalogLocked ? 0.45 : 1,
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
