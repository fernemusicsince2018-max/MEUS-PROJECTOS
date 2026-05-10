import {
  ArrowRight,
  ChartColumn,
  Link2,
  Package,
  Smartphone,
  Store,
} from "lucide-react";
import BrandMark from "../../components/common/BrandMark.jsx";
import PublicLayout from "../../layouts/PublicLayout.jsx";
import {
  buildAuthPath,
  buildMerchantAppPath,
  buildSuperAdminPath,
} from "../../utils/appRoutes.js";

const BENEFITS = Object.freeze([
  {
    title: "Vitrine profissional",
    copy: "Tudo o que voce vende num unico link com cara de marca, claro para o cliente e pronto para partilhar.",
    icon: Store,
  },
  {
    title: "Atendimento mais claro",
    copy: "O cliente entende melhor antes de pedir, compara opcoes e chega ao WhatsApp com mais intencao de compra.",
    icon: ChartColumn,
  },
  {
    title: "Painel no telemovel",
    copy: "Atualize catalogo, acompanhe pedidos e envie a URL da loja num painel simples, rapido e mobile-first.",
    icon: Smartphone,
  },
]);

const STEPS = Object.freeze([
  {
    id: "1",
    title: "Criar loja",
    copy: "Cadastre produtos e servicos em minutos, sem montar tudo manualmente em cada conversa.",
  },
  {
    id: "2",
    title: "Publicar catalogo",
    copy: "A sua vitrine fica online com um link profissional pronto para enviar no WhatsApp ou nas redes.",
  },
  {
    id: "3",
    title: "Enviar e vender",
    copy: "Sempre que um cliente pedir atendimento, voce responde com um unico link e conduz a conversa com mais clareza.",
  },
]);

const PROOF_POINTS = Object.freeze([
  { label: "Catalogo online", icon: Store },
  { label: "URL profissional", icon: Link2 },
  { label: "Pedido acompanhado", icon: Package },
]);

const HOME_STYLES = `
  .public-home-page {
    --font-display: "Sora", "Segoe UI", system-ui, sans-serif;
    --font-sans: "DM Sans", "Segoe UI", system-ui, sans-serif;
    --ph-accent: var(--brand-accent, #25ae82);
    --ph-accent-2: var(--brand-accent-2, #ffc61a);
    --ph-text: #eef4ee;
    --ph-muted: rgba(238, 244, 238, 0.72);
    --ph-gradient: linear-gradient(135deg, var(--ph-accent) 0%, var(--ph-accent-2) 100%);
    min-height: 100vh;
    padding: 14px;
    color: var(--ph-text);
    font-family: var(--font-sans);
    background:
      radial-gradient(circle at 18% 0%, rgba(47, 209, 126, 0.12), transparent 26%),
      radial-gradient(circle at 100% 18%, rgba(255, 198, 26, 0.12), transparent 22%),
      linear-gradient(180deg, #03110a 0%, #04170e 100%);
  }

  .public-home-frame {
    overflow: hidden;
    border-radius: 28px;
    border: 1px solid rgba(111, 216, 151, 0.14);
    background:
      radial-gradient(circle at top center, rgba(255, 255, 255, 0.05), transparent 24%),
      linear-gradient(180deg, #04170e 0%, #052113 100%);
    box-shadow: 0 28px 72px rgba(0, 0, 0, 0.28);
  }

  .public-home-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 24px 54px;
    background: rgba(4, 24, 14, 0.84);
    backdrop-filter: blur(18px);
    border-bottom: 1px solid rgba(111, 216, 151, 0.12);
  }

  .public-home-brand {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .public-home-brand-name {
    font-family: var(--font-display);
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .public-home-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 56px;
    padding: 14px 26px;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-decoration: none;
    transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease;
  }

  .public-home-button:hover {
    transform: translateY(-2px);
  }

  .public-home-button--primary {
    background: var(--ph-gradient);
    color: #032112;
    box-shadow: 0 18px 34px rgba(57, 222, 119, 0.18);
  }

  .public-home-button--ghost {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.02);
    color: var(--ph-text);
  }

  .public-home-button-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    flex-shrink: 0;
    background: rgba(3, 33, 18, 0.42);
    box-shadow: 0 0 0 6px rgba(57, 222, 119, 0.12);
    animation: public-home-pulse 2.2s ease-in-out infinite;
  }

  .public-home-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.02fr) minmax(380px, 0.98fr);
    gap: 48px;
    align-items: center;
    padding: 70px 54px 54px;
  }

  .public-home-copy-shell {
    display: grid;
    gap: 24px;
    align-content: start;
  }

  .public-home-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    width: fit-content;
    padding: 12px 18px;
    border-radius: 999px;
    border: 1px solid rgba(57, 222, 119, 0.22);
    background: rgba(57, 222, 119, 0.07);
    color: var(--ph-accent-2);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .public-home-eyebrow::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--ph-accent);
    box-shadow: 0 0 0 6px rgba(57, 222, 119, 0.12);
    animation: public-home-pulse 2.2s ease-in-out infinite;
  }

  .public-home-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(54px, 7vw, 90px);
    line-height: 0.96;
    font-weight: 700;
    letter-spacing: -0.045em;
    max-width: 8.8ch;
  }

  .public-home-title-accent {
    background: var(--ph-gradient);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
  }

  .public-home-copy {
    margin: 0;
    max-width: 34ch;
    color: var(--ph-muted);
    font-size: 17px;
    line-height: 1.72;
  }

  .public-home-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
  }

  .public-home-proof {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .public-home-proof-pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 18px;
    border: 1px solid rgba(111, 216, 151, 0.14);
    background: rgba(255, 255, 255, 0.03);
    color: var(--ph-text);
    font-size: 14px;
    font-weight: 600;
  }

  .public-home-proof-pill svg {
    color: var(--ph-accent-2);
    flex-shrink: 0;
  }

  .public-home-visual {
    position: relative;
    min-height: 660px;
  }

  .public-home-floating-card {
    position: absolute;
    z-index: 2;
    padding: 18px 20px;
    border-radius: 24px;
    border: 1px solid rgba(111, 216, 151, 0.14);
    background: rgba(8, 34, 21, 0.92);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.24);
    animation: public-home-float 7s ease-in-out infinite;
  }

  .public-home-floating-card--link {
    top: 92px;
    right: -8px;
    min-width: 248px;
    animation-delay: -1.2s;
  }

  .public-home-floating-card--tracking {
    left: 0;
    top: 276px;
    min-width: 256px;
    animation-delay: -0.4s;
  }

  .public-home-floating-label {
    display: block;
    margin-bottom: 10px;
    color: rgba(238, 244, 238, 0.48);
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .public-home-floating-value {
    font-family: var(--font-display);
    font-size: 23px;
    font-weight: 700;
    color: var(--ph-accent);
    letter-spacing: -0.03em;
  }

  .public-home-floating-copy {
    margin-top: 4px;
    color: rgba(238, 244, 238, 0.62);
    font-size: 13px;
    line-height: 1.55;
  }

  .public-home-device {
    position: absolute;
    right: 28px;
    top: 16px;
    width: min(100%, 452px);
    padding: 16px;
    border-radius: 38px;
    border: 1px solid rgba(111, 216, 151, 0.18);
    background: linear-gradient(180deg, rgba(6, 30, 18, 0.98) 0%, rgba(5, 22, 13, 0.98) 100%);
    box-shadow:
      0 0 0 10px rgba(57, 222, 119, 0.06),
      0 28px 64px rgba(0, 0, 0, 0.24);
    animation: public-home-float 7s ease-in-out infinite;
  }

  .public-home-device-top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 8px 8px 0;
  }

  .public-home-device-title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.2;
  }

  .public-home-device-copy {
    color: rgba(238, 244, 238, 0.56);
    font-size: 13px;
    line-height: 1.4;
  }

  .public-home-main-shot {
    overflow: hidden;
    border-radius: 30px;
    border: 1px solid rgba(111, 216, 151, 0.14);
    background: rgba(255, 255, 255, 0.03);
  }

  .public-home-main-shot img,
  .public-home-thumb img {
    display: block;
    width: 100%;
    height: auto;
  }

  .public-home-thumb-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
  }

  .public-home-thumb {
    overflow: hidden;
    border-radius: 24px;
    border: 1px solid rgba(111, 216, 151, 0.14);
    background: rgba(255, 255, 255, 0.03);
  }

  .public-home-section {
    display: grid;
    gap: 24px;
    padding: 0 54px 54px;
  }

  .public-home-section-heading {
    display: grid;
    gap: 10px;
    max-width: 680px;
  }

  .public-home-kicker {
    color: var(--ph-accent-2);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .public-home-section-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(28px, 4vw, 42px);
    line-height: 1.06;
    letter-spacing: -0.03em;
  }

  .public-home-section-copy {
    margin: 0;
    color: var(--ph-muted);
    font-size: 15px;
    line-height: 1.72;
  }

  .public-home-card-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .public-home-card {
    display: grid;
    gap: 14px;
    padding: 24px;
    border-radius: 28px;
    border: 1px solid rgba(111, 216, 151, 0.14);
    background: rgba(255, 255, 255, 0.03);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
  }

  .public-home-card-icon {
    width: 52px;
    height: 52px;
    border-radius: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.06);
    color: var(--ph-accent-2);
  }

  .public-home-card-title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
  }

  .public-home-card-copy {
    margin: 0;
    color: var(--ph-muted);
    font-size: 14px;
    line-height: 1.7;
  }

  .public-home-step-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .public-home-step {
    display: grid;
    gap: 18px;
    padding: 24px;
    border-radius: 28px;
    border: 1px solid rgba(111, 216, 151, 0.14);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
  }

  .public-home-step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 999px;
    background: rgba(57, 222, 119, 0.1);
    color: var(--ph-accent-2);
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
  }

  .public-home-step-title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
  }

  .public-home-step-copy {
    margin: 0;
    color: var(--ph-muted);
    font-size: 14px;
    line-height: 1.7;
  }

  .public-home-final {
    margin: 0 54px 54px;
    padding: 30px;
    border-radius: 30px;
    border: 1px solid rgba(111, 216, 151, 0.16);
    background: linear-gradient(135deg, rgba(12, 42, 27, 0.96) 0%, rgba(18, 64, 40, 0.92) 100%);
    display: grid;
    gap: 14px;
  }

  .public-home-final-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(30px, 4vw, 46px);
    line-height: 1.04;
    letter-spacing: -0.03em;
    max-width: 14ch;
  }

  .public-home-final-copy {
    margin: 0;
    color: var(--ph-muted);
    font-size: 15px;
    line-height: 1.72;
    max-width: 38ch;
  }

  .public-home-final-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    padding-top: 6px;
  }

  @keyframes public-home-float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  @keyframes public-home-pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.74;
    }
  }

  @media (max-width: 1180px) {
    .public-home-hero,
    .public-home-section,
    .public-home-nav {
      padding-left: 28px;
      padding-right: 28px;
    }

    .public-home-final {
      margin-left: 28px;
      margin-right: 28px;
    }

    .public-home-hero {
      grid-template-columns: 1fr;
    }

    .public-home-visual {
      min-height: auto;
      padding-top: 18px;
    }

    .public-home-device,
    .public-home-floating-card {
      position: relative;
      top: auto;
      right: auto;
      left: auto;
      bottom: auto;
      width: 100%;
      max-width: 520px;
    }

    .public-home-visual {
      display: grid;
      gap: 14px;
      justify-items: center;
    }
  }

  @media (max-width: 900px) {
    .public-home-card-grid,
    .public-home-step-grid {
      grid-template-columns: 1fr;
    }

    .public-home-title {
      max-width: 11ch;
    }
  }

  @media (max-width: 640px) {
    .public-home-page {
      padding: 8px;
    }

    .public-home-nav,
    .public-home-hero,
    .public-home-section {
      padding-left: 18px;
      padding-right: 18px;
    }

    .public-home-nav {
      padding-top: 18px;
      padding-bottom: 18px;
      flex-direction: column;
      align-items: stretch;
    }

    .public-home-brand-name {
      font-size: 18px;
    }

    .public-home-title {
      font-size: clamp(42px, 14vw, 72px);
      max-width: 9ch;
    }

    .public-home-copy {
      font-size: 15px;
    }

    .public-home-thumb-grid {
      grid-template-columns: 1fr;
    }

    .public-home-final {
      margin-left: 18px;
      margin-right: 18px;
      padding: 24px 18px;
    }
  }
`;

function HomeButton({ href, label, withDot = false, ghost = false }) {
  return (
    <a
      href={href}
      className={`public-home-button ${ghost ? "public-home-button--ghost" : "public-home-button--primary"}`}
    >
      {withDot ? <span className="public-home-button-dot" /> : null}
      <span>{label}</span>
      <ArrowRight size={18} />
    </a>
  );
}

function BenefitCard({ icon: Icon, title, copy }) {
  return (
    <article className="public-home-card">
      <div className="public-home-card-icon">
        <Icon size={24} />
      </div>
      <h3 className="public-home-card-title">{title}</h3>
      <p className="public-home-card-copy">{copy}</p>
    </article>
  );
}

function StepCard({ id, title, copy }) {
  return (
    <article className="public-home-step">
      <span className="public-home-step-number">{id}</span>
      <h3 className="public-home-step-title">{title}</h3>
      <p className="public-home-step-copy">{copy}</p>
    </article>
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
  const primaryLabel = hasActiveSession ? "Abrir painel" : "Criar minha loja";
  const navLabel = hasActiveSession ? "Abrir painel" : "Comecar agora";
  const brandName = String(brand?.name || "KASTROZAPP");

  return (
    <PublicLayout>
      <style>{HOME_STYLES}</style>
      <div
        className="public-home-page"
        style={{
          "--brand-accent": brand?.accent || "#25ae82",
          "--brand-accent-2": brand?.highlight || "#ffc61a",
        }}
      >
        <div className="public-home-frame">
          <div className="public-home-nav">
            <div className="public-home-brand">
              <BrandMark brand={brand} size={54} rounded={16} />
              <span className="public-home-brand-name">{brandName}</span>
            </div>
            <HomeButton href={primaryHref} label={navLabel} withDot />
          </div>

          <section className="public-home-hero">
            <div className="public-home-copy-shell">
              <span className="public-home-eyebrow">Venda mais no WhatsApp</span>

              <h1 className="public-home-title">
                Sua loja pronta para vender no <span className="public-home-title-accent">WhatsApp.</span>
              </h1>

              <p className="public-home-copy">
                Publique produtos, envie um link profissional e transforme cada atendimento em pedido
                com mais clareza.
              </p>

              <div className="public-home-actions">
                <HomeButton href={primaryHref} label={primaryLabel} />
                <HomeButton href="#como-funciona" label="Ver como funciona" ghost />
              </div>

              <div className="public-home-proof">
                {PROOF_POINTS.map(({ label, icon: Icon }) => (
                  <div key={label} className="public-home-proof-pill">
                    <Icon size={16} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="public-home-visual">
              <div className="public-home-floating-card public-home-floating-card--link">
                <span className="public-home-floating-label">Link pronto</span>
                <div className="public-home-floating-value">/sua-loja</div>
                <div className="public-home-floating-copy">
                  Uma URL limpa para enviar no WhatsApp, Instagram ou bio.
                </div>
              </div>

              <div className="public-home-floating-card public-home-floating-card--tracking">
                <span className="public-home-floating-label">Pedido acompanhado</span>
                <div className="public-home-floating-value">Status claro</div>
                <div className="public-home-floating-copy">
                  Cliente e lojista acompanham o mesmo processo sem confusao.
                </div>
              </div>

              <div className="public-home-device">
                <div className="public-home-device-top">
                  <BrandMark brand={brand} size={42} rounded={14} />
                  <div>
                    <div className="public-home-device-title">{brandName}</div>
                    <div className="public-home-device-copy">Painel mobile da loja</div>
                  </div>
                </div>

                <div className="public-home-main-shot">
                  <img
                    src="/landing/dashboard-mobile.png"
                    alt="Painel principal da loja no telemovel"
                    decoding="async"
                  />
                </div>

                <div className="public-home-thumb-grid">
                  <div className="public-home-thumb">
                    <img
                      src="/landing/catalog-mobile.png"
                      alt="Catalogo online da loja"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="public-home-thumb">
                    <img
                      src="/landing/tracking-mobile.png"
                      alt="Acompanhamento do pedido"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="public-home-section" id="beneficios">
            <div className="public-home-section-heading">
              <span className="public-home-kicker">O que voce ganha</span>
              <h2 className="public-home-section-title">
                Menos conversa solta. Mais apresentacao profissional e mais clareza para vender.
              </h2>
              <p className="public-home-section-copy">
                A landing foi reduzida ao essencial: mostrar valor rapido, reforcar a confianca e levar
                direto para a criacao da loja.
              </p>
            </div>

            <div className="public-home-card-grid">
              {BENEFITS.map((benefit) => (
                <BenefitCard
                  key={benefit.title}
                  icon={benefit.icon}
                  title={benefit.title}
                  copy={benefit.copy}
                />
              ))}
            </div>
          </section>

          <section className="public-home-section" id="como-funciona">
            <div className="public-home-section-heading">
              <span className="public-home-kicker">Rota simples</span>
              <h2 className="public-home-section-title">Tres passos para comecar a vender.</h2>
              <p className="public-home-section-copy">
                Sem fluxo longo nem texto tecnico: criar, publicar e responder com um unico link.
              </p>
            </div>

            <div className="public-home-step-grid">
              {STEPS.map((step) => (
                <StepCard
                  key={step.id}
                  id={step.id}
                  title={step.title}
                  copy={step.copy}
                />
              ))}
            </div>
          </section>

          <section className="public-home-final">
            <h2 className="public-home-final-title">Comece hoje e tenha a sua URL pronta para vender.</h2>
            <p className="public-home-final-copy">
              Crie a loja, publique o catalogo e responda com um unico link sempre que um cliente pedir
              atendimento.
            </p>

            <div className="public-home-final-actions">
              <HomeButton href={primaryHref} label={primaryLabel} />
              <HomeButton href="#beneficios" label="Ver beneficios" ghost />
            </div>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
