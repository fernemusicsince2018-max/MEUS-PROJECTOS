import React from "react";
import { Pin, RefreshCw, Star } from "lucide-react";
import { SURFACE_STYLE } from "../../constants.js";
import { fmtMoney } from "../../utils/format.js";
import { formatOrderDateTime } from "../../utils/orders.js";
import { Badge, StatTile } from "../common/UiBits.jsx";

const STATUS_BUTTON_STYLE = {
  borderRadius: "12px",
  padding: "9px 10px",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer",
  border: "1px solid transparent",
};

function OrderReviewStars({ rating = 0, size = 15, color = "#f59e0b" }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      {[1, 2, 3, 4, 5].map((value) => {
        const active = value <= Math.round(Number(rating || 0));
        return <Star key={value} size={size} color={color} fill={active ? color : "none"} />;
      })}
    </div>
  );
}

function StoreReviewDistributionRow({ rating, count, total }) {
  const share = total > 0 ? Math.max(0, Math.min(100, (count / total) * 100)) : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "68px 1fr 32px", gap: "10px", alignItems: "center" }}>
      <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--color-text-secondary)" }}>
        {rating} estrela{rating === 1 ? "" : "s"}
      </div>
      <div style={{ height: "10px", borderRadius: "999px", background: "rgba(12,37,34,0.08)", overflow: "hidden" }}>
        <div
          style={{
            width: `${share}%`,
            height: "100%",
            borderRadius: "999px",
            background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
          }}
        />
      </div>
      <div style={{ fontSize: "12px", fontWeight: "800", textAlign: "right", color: "var(--color-text-primary)" }}>
        {count}
      </div>
    </div>
  );
}

function getStoreReviewDisplayDate(review) {
  if (!review) return "Data indisponível";
  const timestamp = review.createdAt || review.updatedAt;
  return timestamp ? formatOrderDateTime(timestamp) : "Data indisponível";
}

function StoreTestimonialCard({ testimonial, featured = false }) {
  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "18px",
        background: "white",
        border: "1px solid var(--color-border-tertiary)",
        display: "grid",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: "4px" }}>
          <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--color-text-primary)" }}>
            {testimonial.customerLabel || "Cliente verificado"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
            {getStoreReviewDisplayDate(testimonial)}
          </div>
        </div>
        <div style={{ display: "grid", justifyItems: "end", gap: "6px" }}>
          {featured ? (
            <Badge bg="#ecfccb" color="#3f6212">
              <Pin size={12} /> Fixado
            </Badge>
          ) : null}
          <OrderReviewStars rating={testimonial.rating} size={14} />
        </div>
      </div>
      <div style={{ fontSize: "13px", lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
        "{testimonial.comment}"
      </div>
    </div>
  );
}

function TestimonialColumn({
  title,
  description,
  reviews = [],
  emptyMessage,
  countLabel = "",
  featured = false,
}) {
  return (
    <div style={{ padding: "16px", borderRadius: "22px", background: "var(--color-background-secondary)", display: "grid", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
            {title}
          </div>
          <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            {description}
          </div>
        </div>
        {countLabel ? (
          <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
            {countLabel}
          </div>
        ) : null}
      </div>

      {reviews.length > 0 ? (
        <div style={{ display: "grid", gap: "10px" }}>
          {reviews.map((testimonial) => (
            <StoreTestimonialCard
              key={testimonial.id}
              testimonial={testimonial}
              featured={featured || testimonial.isFeatured}
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

function StoreReputationPanel({ store }) {
  const reviewSummary =
    store?.reviewSummary && typeof store.reviewSummary === "object"
      ? store.reviewSummary
      : null;
  const testimonials = Array.isArray(store?.testimonials)
    ? store.testimonials.filter((entry) => entry?.id && entry?.comment)
    : [];
  const featuredTestimonials = Array.isArray(store?.featuredTestimonials)
    ? store.featuredTestimonials.filter((entry) => entry?.id && entry?.comment)
    : testimonials.filter((entry) => entry?.isFeatured).slice(0, 5);
  const recentTestimonials = Array.isArray(store?.recentTestimonials)
    ? store.recentTestimonials.filter((entry) => entry?.id && entry?.comment)
    : testimonials.filter((entry) => !entry?.isFeatured).slice(0, 3);
  const totalReviews = Math.max(0, Number(reviewSummary?.totalReviews || 0));
  const testimonialCount = Math.max(
    0,
    Number(reviewSummary?.testimonialCount || testimonials.length || 0),
  );
  const featuredCount = Math.max(
    0,
    Number(reviewSummary?.featuredCount || featuredTestimonials.length || 0),
  );
  const nonFeaturedTestimonialCount = Math.max(0, testimonialCount - featuredCount);
  const averageRating = Number(reviewSummary?.averageRating || 0);

  return (
    <div style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
            Reputação da loja
          </div>
          <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            Aqui ficam as estrelas, os comentários recentes e os testemunhos que vão primeiro para a vitrine.
          </div>
        </div>
        {totalReviews > 0 ? (
          <Badge bg="#fff7ed" color="#b45309">
            <Star size={12} /> {averageRating.toFixed(1)} / 5
          </Badge>
        ) : null}
      </div>

      {totalReviews > 0 ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
            <div style={{ padding: "14px 16px", borderRadius: "20px", background: "var(--color-background-secondary)", display: "grid", gap: "8px" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", fontWeight: "800" }}>
                Nota média
              </div>
              <div style={{ fontSize: "28px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                {averageRating.toFixed(1)}
              </div>
              <OrderReviewStars rating={averageRating} size={16} />
            </div>

            <div style={{ padding: "14px 16px", borderRadius: "20px", background: "var(--color-background-secondary)", display: "grid", gap: "8px" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", fontWeight: "800" }}>
                Total de avaliações
              </div>
              <div style={{ fontSize: "28px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                {totalReviews}
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                Clientes que já avaliaram a loja.
              </div>
            </div>

            <div style={{ padding: "14px 16px", borderRadius: "20px", background: "var(--color-background-secondary)", display: "grid", gap: "8px" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", fontWeight: "800" }}>
                Testemunhos publicados
              </div>
              <div style={{ fontSize: "28px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                {testimonialCount}
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                Comentários que ajudam novos clientes a confiar.
              </div>
            </div>

            <div style={{ padding: "14px 16px", borderRadius: "20px", background: "var(--color-background-secondary)", display: "grid", gap: "8px" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)", fontWeight: "800" }}>
                Fixados na vitrine
              </div>
              <div style={{ fontSize: "28px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                {featuredCount}
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                Até 5 testemunhos escolhidos pelo lojista.
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
            <div style={{ padding: "16px", borderRadius: "22px", background: "var(--color-background-secondary)", display: "grid", gap: "10px" }}>
              <div style={{ fontSize: "14px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                Distribuição das estrelas
              </div>
              {[5, 4, 3, 2, 1].map((rating) => (
                <StoreReviewDistributionRow
                  key={rating}
                  rating={rating}
                  count={Math.max(0, Number(reviewSummary?.distribution?.[rating] || 0))}
                  total={totalReviews}
                />
              ))}
            </div>

            <div style={{ padding: "16px", borderRadius: "22px", background: "var(--color-background-secondary)", display: "grid", gap: "10px" }}>
              <div style={{ fontSize: "14px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
                Como aparece ao cliente
              </div>
              <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                A vitrine pública fica curta e confiável: até 5 testemunhos fixados pela loja e mais 3 comentários recentes.
              </div>
              <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                Usa esta área para destacar os comentários mais fortes sem misturar isso com a operação dos pedidos.
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
            <TestimonialColumn
              title="Testemunhos fixados"
              description="Aparecem primeiro na vitrine pública."
              reviews={featuredTestimonials}
              countLabel={`${featuredCount} / 5 em destaque`}
              featured
              emptyMessage="Ainda não escolheste testemunhos em destaque. Usa a lista abaixo para fixar os comentários mais fortes."
            />
            <TestimonialColumn
              title="Testemunhos recentes"
              description="Mantém a prova social viva com os comentários mais novos."
              reviews={recentTestimonials}
              countLabel={
                nonFeaturedTestimonialCount > recentTestimonials.length
                  ? `+${Math.max(0, nonFeaturedTestimonialCount - recentTestimonials.length)} comentário(s) adicionais`
                  : ""
              }
              emptyMessage="Já existem estrelas registadas, mas ainda não há comentários escritos recentes para mostrar."
            />
          </div>
        </>
      ) : (
        <div style={{ padding: "16px", borderRadius: "20px", background: "var(--color-background-secondary)", fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
          Quando um cliente avaliar a loja por estrelas e comentário, os dados vão aparecer aqui e também podem ser mostrados na vitrine pública como testemunho.
        </div>
      )}
    </div>
  );
}

function ReviewOrderCard({
  review,
  color,
  onToggleReviewFeature,
  busyReviewId = "",
}) {
  if (!review) return null;

  const isUpdatingReviewFeature = Boolean(review?.id) && busyReviewId === review.id;
  const reviewMeta = [];

  if (review.trackingCode) {
    reviewMeta.push(`Pedido ${review.trackingCode}`);
  }

  if (review.totalAmount != null) {
    reviewMeta.push(fmtMoney(review.totalAmount, review.currencyCode));
  }

  if (review.createdAt || review.updatedAt) {
    reviewMeta.push(`Avaliada em ${formatOrderDateTime(review.createdAt || review.updatedAt)}`);
  }

  return (
    <div style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: "6px" }}>
          <div style={{ fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
            {review.customerLabel || review.customerName || "Cliente verificado"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            {reviewMeta.length > 0 ? reviewMeta.join(" - ") : "Avaliação recebida pela loja"}
          </div>
        </div>

        <div style={{ display: "grid", justifyItems: "end", gap: "8px" }}>
          <OrderReviewStars rating={review.rating} />
          {review.isFeatured ? (
            <Badge bg="#ecfccb" color="#3f6212">
              <Pin size={12} /> Fixado na vitrine
            </Badge>
          ) : null}
        </div>
      </div>

      {review.comment ? (
        <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
          "{review.comment}"
        </div>
      ) : (
        <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
          O cliente avaliou a loja em estrelas, mas ainda não deixou comentário escrito.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
          {review.comment
            ? "A vitrine pública aceita até 5 testemunhos fixados."
            : "Só comentários escritos podem ser fixados como testemunho na vitrine."}
        </div>

        {review.comment ? (
          <button
            type="button"
            onClick={() => onToggleReviewFeature?.(review.id, !review.isFeatured)}
            disabled={!onToggleReviewFeature || isUpdatingReviewFeature}
            style={{
              ...STATUS_BUTTON_STYLE,
              background: review.isFeatured ? "#fff7ed" : color,
              color: review.isFeatured ? "#9a3412" : "white",
              borderColor: review.isFeatured ? "#fed7aa" : color,
              opacity: isUpdatingReviewFeature ? 0.65 : 1,
              cursor: !onToggleReviewFeature || isUpdatingReviewFeature ? "not-allowed" : "pointer",
            }}
          >
            {isUpdatingReviewFeature
              ? "A guardar..."
              : review.isFeatured
                ? "Retirar dos destaques"
                : "Fixar entre os destaques"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function ReviewsTab({
  reviews = [],
  pageInfo = {},
  store,
  color,
  loading = false,
  loadingMore = false,
  onRefresh,
  onLoadMore,
  onToggleReviewFeature,
  busyReviewId = "",
}) {
  const reviewSummary =
    store?.reviewSummary && typeof store.reviewSummary === "object"
      ? store.reviewSummary
      : null;
  const totalReviews = Math.max(0, Number(reviewSummary?.totalReviews || 0));
  const testimonialCount = Math.max(0, Number(reviewSummary?.testimonialCount || 0));
  const featuredCount = Math.max(0, Number(reviewSummary?.featuredCount || 0));
  const averageRating = Number(reviewSummary?.averageRating || 0);
  const visibleReviews = React.useMemo(
    () => reviews.filter((review) => review?.id && Number(review.rating || 0) > 0),
    [reviews],
  );

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: "700" }}>Avaliações da loja</div>
          <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            Aqui o lojista acompanha reputação, comentários e escolhe o que vai para destaque na vitrine pública.
            Esta área atualiza automaticamente a cada 1 minuto enquanto estiver aberta.
          </div>
        </div>

        <button onClick={onRefresh} disabled={loading} style={{ padding: "10px 14px", borderRadius: "14px", border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: loading ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px", opacity: loading ? 0.6 : 1 }}>
          <RefreshCw size={14} /> {loading ? "A carregar..." : "Atualizar"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        <StatTile label="Total" value={totalReviews} hint="avaliações recebidas" color={color} />
        <StatTile label="Nota média" value={totalReviews > 0 ? averageRating.toFixed(1) : "-"} hint="média da loja" color={color} />
        <StatTile label="Comentários" value={testimonialCount} hint="testemunhos publicados" color={color} />
        <StatTile label="Fixados" value={featuredCount} hint="na vitrine pública" color={color} />
        <StatTile label="Na lista" value={visibleReviews.length} hint="nesta consulta" color={color} />
      </div>

      <StoreReputationPanel store={store} />

      <div style={{ display: "grid", gap: "14px" }}>
        <div>
          <div style={{ fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)" }}>
            Avaliações recebidas
          </div>
          <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            Esta lista usa uma carga dedicada de avaliações, separada dos pedidos do painel, e renova-se sozinha a cada 1 minuto.
          </div>
        </div>

        {visibleReviews.length > 0 ? (
          <div style={{ display: "grid", gap: "14px" }}>
            {visibleReviews.map((review) => (
              <ReviewOrderCard
                key={review.id}
                review={review}
                color={color}
                onToggleReviewFeature={onToggleReviewFeature}
                busyReviewId={busyReviewId}
              />
            ))}
          </div>
        ) : (
          <div style={{ ...SURFACE_STYLE, padding: "24px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            {totalReviews > 0
              ? "Já existem avaliações na loja, mas esta página ainda não trouxe resultados. Atualiza a lista ou tenta novamente."
              : "Ainda não existem avaliações nesta loja. Assim que os clientes responderem, elas aparecem aqui."}
          </div>
        )}

        {pageInfo?.hasMore ? (
          <div style={{ ...SURFACE_STYLE, padding: "18px", display: "grid", gap: "10px", justifyItems: "center", textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              Carrega mais avaliações antigas sem depender da lista de pedidos.
            </div>
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore || loading || !onLoadMore}
              style={{
                ...STATUS_BUTTON_STYLE,
                background: color,
                color: "white",
                borderColor: color,
                minWidth: "240px",
                opacity: loadingMore ? 0.65 : 1,
                cursor: loadingMore || loading || !onLoadMore ? "not-allowed" : "pointer",
              }}
            >
              {loadingMore ? "A carregar mais..." : "Carregar mais avaliações"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
