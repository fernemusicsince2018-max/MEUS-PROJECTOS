import {
  ArrowRight,
  BadgeCheck,
  Globe2,
  Link2,
  ShieldCheck,
  Smartphone,
  Store,
} from "lucide-react";
import BrandMark from "../../components/common/BrandMark.jsx";
import PublicLayout from "../../layouts/PublicLayout.jsx";
import {
  buildAuthPath,
  buildMerchantAppPath,
  buildPublicCatalogPath,
  buildRootPath,
  buildSuperAdminPath,
  buildTrackingPath,
} from "../../utils/appRoutes.js";

const SURFACE_STYLE = {
  borderRadius: "28px",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.88)",
  boxShadow: "0 22px 54px rgba(16,35,31,0.08)",
  backdropFilter: "blur(16px)",
};

function ChannelCard({ icon, title, detail, route, tone }) {
  return (
    <div
      style={{
        ...SURFACE_STYLE,
        padding: "22px",
        display: "grid",
        gap: "12px",
        background: tone,
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "14px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(16,35,31,0.08)",
          color: "#10231f",
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: "22px", fontFamily: "var(--font-display)", fontWeight: "800", letterSpacing: "-0.03em" }}>
        {title}
      </div>
      <div style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-text-secondary)" }}>{detail}</div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          borderRadius: "999px",
          background: "rgba(16,35,31,0.06)",
          color: "var(--color-text-primary)",
          fontSize: "12px",
          fontWeight: "800",
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        <Link2 size={13} />
        {route}
      </div>
    </div>
  );
}

export default function PublicHomeRoute({
  brand,
  hasActiveSession = false,
  sessionRole = "",
}) {
  const dashboardHref =
    sessionRole === "super_admin" ? buildSuperAdminPath() : buildMerchantAppPath();
  const primaryHref = hasActiveSession ? dashboardHref : buildAuthPath();
  const primaryLabel = hasActiveSession ? "Abrir painel" : "Entrar no painel";

  return (
    <PublicLayout>
      <div
        style={{
          minHeight: "100vh",
          padding: "24px 16px 40px",
          background:
            "radial-gradient(circle at top left, rgba(37,174,130,0.18), transparent 26%), radial-gradient(circle at 82% 14%, rgba(255,198,26,0.2), transparent 20%), linear-gradient(180deg, #fbfdf9 0%, #eff6ee 100%)",
        }}
      >
        <div style={{ width: "min(1180px, 100%)", margin: "0 auto", display: "grid", gap: "18px" }}>
          <section
            style={{
              ...SURFACE_STYLE,
              padding: "clamp(24px, 5vw, 42px)",
              background:
                "linear-gradient(145deg, rgba(27,28,72,0.96) 0%, rgba(37,174,130,0.92) 56%, rgba(255,198,26,0.88) 165%)",
              color: "white",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-46px",
                right: "-32px",
                width: "220px",
                height: "220px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.1)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "-74px",
                left: "-28px",
                width: "180px",
                height: "180px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.08)",
              }}
            />

            <div
              style={{
                position: "relative",
                display: "grid",
                gap: "22px",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                alignItems: "center",
              }}
            >
              <div style={{ display: "grid", gap: "16px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.16)", width: "fit-content" }}>
                  <BrandMark brand={brand} size={38} rounded={14} />
                  <span style={{ fontSize: "12px", fontWeight: "800", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    {brand.name}
                  </span>
                </div>

                <div style={{ fontSize: "clamp(34px, 6vw, 58px)", lineHeight: 0.94, fontWeight: "800", fontFamily: "var(--font-display)", letterSpacing: "-0.05em", maxWidth: "11ch" }}>
                  Web para clientes. App para lojistas.
                </div>

                <div style={{ maxWidth: "60ch", fontSize: "15px", lineHeight: 1.8, color: "rgba(255,255,255,0.9)" }}>
                  A vitrine publica vive em links partilhaveis da loja. O painel do lojista fica isolado em
                  {" "}
                  <strong>/app</strong>
                  {" "}
                  e pode ser instalado como PWA ou empacotado para Android via Capacitor.
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <a
                    href={primaryHref}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "13px 18px",
                      borderRadius: "16px",
                      background: "rgba(255,255,255,0.96)",
                      color: brand.dark || "#10231f",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: "800",
                      boxShadow: "0 18px 30px rgba(12,37,34,0.16)",
                    }}
                  >
                    {primaryLabel}
                    <ArrowRight size={15} />
                  </a>
                  <a
                    href="#canais"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "13px 18px",
                      borderRadius: "16px",
                      background: "rgba(255,255,255,0.12)",
                      color: "white",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: "800",
                      border: "1px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    Ver canais
                  </a>
                </div>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                <div
                  style={{
                    ...SURFACE_STYLE,
                    padding: "18px",
                    background: "rgba(255,255,255,0.13)",
                    color: "white",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      <Globe2 size={14} />
                      Canal do cliente
                    </div>
                    <BadgeCheck size={16} />
                  </div>
                  <div style={{ fontSize: "22px", fontFamily: "var(--font-display)", fontWeight: "800", marginBottom: "6px" }}>
                    Catalogo partilhavel no browser
                  </div>
                  <div style={{ fontSize: "13px", lineHeight: 1.7, color: "rgba(255,255,255,0.88)" }}>
                    Cada loja abre numa URL publica propria, sem misturar a vitrine com o painel interno do lojista.
                  </div>
                </div>

                <div
                  style={{
                    ...SURFACE_STYLE,
                    padding: "18px",
                    background: "rgba(16,35,31,0.82)",
                    color: "white",
                  }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>
                    <Smartphone size={14} />
                    Canal do lojista
                  </div>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {[
                      "Auth e recuperacao em /auth",
                      "Painel comercial protegido em /app",
                      "PWA mobile-first e base pronta para Android",
                    ].map((item) => (
                      <div key={item} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", lineHeight: 1.6 }}>
                        <ShieldCheck size={14} style={{ flexShrink: 0, color: brand.highlight || "#ffc61a" }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="canais" style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))" }}>
            <ChannelCard
              icon={<Store size={20} />}
              title="Loja publica"
              detail="Clientes entram por um link da loja, exploram os produtos, montam o carrinho e enviam o pedido pelo WhatsApp."
              route={buildPublicCatalogPath("sua-loja")}
              tone="linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(242,249,245,0.98) 100%)"
            />
            <ChannelCard
              icon={<BadgeCheck size={20} />}
              title="Tracking do pedido"
              detail="Cada encomenda abre num link proprio de acompanhamento, sem exigir login do cliente."
              route={buildTrackingPath("token-do-pedido")}
              tone="linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(249,247,240,0.98) 100%)"
            />
            <ChannelCard
              icon={<Smartphone size={20} />}
              title="Painel do lojista"
              detail="Gestao da loja, produtos, pedidos e partilha do catalogo num canal proprio, pensado para instalacao no telemovel."
              route={buildMerchantAppPath()}
              tone="linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(240,246,251,0.98) 100%)"
            />
          </section>

          <section
            style={{
              ...SURFACE_STYLE,
              padding: "20px",
              display: "grid",
              gap: "12px",
              background: "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(250,252,248,0.98) 100%)",
            }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>
              <Globe2 size={14} />
              Como entrar
            </div>
            <div style={{ fontSize: "24px", fontFamily: "var(--font-display)", fontWeight: "800", letterSpacing: "-0.03em" }}>
              A raiz publica fica em
              {" "}
              <span style={{ color: brand.accent || "#25ae82" }}>{buildRootPath()}</span>
              {" "}
              e a operacao do lojista fica noutro trilho.
            </div>
            <div style={{ fontSize: "14px", lineHeight: 1.8, color: "var(--color-text-secondary)", maxWidth: "72ch" }}>
              Isto reduz mistura de contexto, melhora deploy multi-canal e deixa mais simples evoluir SEO,
              onboarding publico e instalacao da app do lojista sem conflitar com as rotas do catalogo.
            </div>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
