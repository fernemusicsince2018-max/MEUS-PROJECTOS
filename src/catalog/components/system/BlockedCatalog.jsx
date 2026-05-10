import { AlertTriangle, Clock3, Phone, RefreshCw, ShieldAlert, Store } from "lucide-react";
import { STORE_DEFAULTS } from "../../constants.js";
import BrandMark from "../common/BrandMark.jsx";

function isExpiredDate(value) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const expiryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return expiryDay < todayDay;
}

function getPlanStatusMeta(planStatus, planExpiresAt) {
  const normalizedStatus = String(planStatus || "").trim().toLowerCase();
  const expired = isExpiredDate(planExpiresAt);

  if (normalizedStatus === "active" && expired) {
    return {
      label: "Plano expirado",
      detail: "A vitrine pública volta assim que a loja renovar o acesso.",
      toneBg: "rgba(254, 242, 242, 0.92)",
      toneColor: "#991b1b",
    };
  }

  if (normalizedStatus === "trial" && expired) {
    return {
      label: "Trial expirado",
      detail: "A fase inicial terminou e a loja precisa reativar o plano.",
      toneBg: "rgba(255, 247, 237, 0.92)",
      toneColor: "#c2410c",
    };
  }

  if (normalizedStatus === "past_due") {
    return {
      label: "Pagamento em atraso",
      detail: "O catálogo público foi pausado até à regularização do plano.",
      toneBg: "rgba(255, 247, 237, 0.92)",
      toneColor: "#c2410c",
    };
  }

  if (normalizedStatus === "canceled") {
    return {
      label: "Plano cancelado",
      detail: "A vitrine foi suspensa enquanto a loja estiver sem plano ativo.",
      toneBg: "rgba(241, 245, 249, 0.92)",
      toneColor: "#334155",
    };
  }

  return {
    label: "Plano inativo",
    detail: "A loja está a ajustar o acesso comercial antes de voltar a abrir o catálogo.",
    toneBg: "rgba(239, 246, 255, 0.92)",
    toneColor: "#1d4ed8",
  };
}

function formatDateLabel(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function buildWhatsAppHref(rawPhone) {
  const phone = String(rawPhone || "").replace(/\D/g, "");
  if (!phone) return "";
  return `https://wa.me/${phone}`;
}

export default function BlockedCatalog({
  platformBrand,
  store,
  message,
  planStatus,
  planExpiresAt,
  onRetry,
}) {
  const accent = store?.color || platformBrand?.accent || STORE_DEFAULTS.color;
  const dark = platformBrand?.dark || "#0c2522";
  const highlight = platformBrand?.highlight || "#f0c978";
  const storeName = store?.name || "Loja temporariamente indisponível";
  const storeDescription = store?.description || "Esta vitrine está a passar por um ajuste comercial e voltará a abrir em breve.";
  const planMeta = getPlanStatusMeta(planStatus, planExpiresAt);
  const expiryLabel = formatDateLabel(planExpiresAt);
  const whatsappHref = buildWhatsAppHref(store?.whatsapp);
  const identityBrand = {
    name: storeName,
    logoUrl: store?.logo || "",
    initials: String(storeName || "LG")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((token) => token[0]?.toUpperCase() || "")
      .join("") || "LG",
    accent,
    dark,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `
          radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 24%),
          radial-gradient(circle at bottom right, rgba(240,201,120,0.24), transparent 20%),
          linear-gradient(145deg, ${dark} 0%, ${accent} 58%, ${highlight} 160%)
        `,
      }}
    >
      <div style={{ width: "100%", maxWidth: "1080px", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "36px", background: "rgba(255,255,255,0.08)", filter: "blur(40px)", transform: "translateY(28px)" }} />

        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: "18px",
            padding: "18px",
            borderRadius: "36px",
            background: "rgba(9, 20, 18, 0.28)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 28px 80px rgba(0,0,0,0.22)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div
            style={{
              padding: "28px",
              borderRadius: "28px",
              background: "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.08) 100%)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
            }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "8px 14px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", fontSize: "11px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "18px" }}>
              <BrandMark brand={platformBrand} size={30} rounded={10} />
              {platformBrand?.name || "Catálogo"}
            </div>

            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "9px 14px", borderRadius: "999px", background: "rgba(127, 29, 29, 0.26)", color: "#fecaca", fontSize: "12px", fontWeight: "800", marginBottom: "16px" }}>
              <ShieldAlert size={14} /> Loja temporariamente indisponível por plano inativo
            </div>

            <div style={{ fontSize: "38px", lineHeight: 1.02, fontWeight: "800", fontFamily: "var(--font-display)", maxWidth: "560px" }}>
              A vitrine desta loja está em pausa enquanto o plano comercial é reativado.
            </div>

            <div style={{ marginTop: "14px", fontSize: "15px", lineHeight: 1.7, color: "rgba(255,255,255,0.82)", maxWidth: "560px" }}>
              {message || "Esta loja está temporariamente indisponível para clientes porque o plano não está ativo."}
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "22px" }}>
              <button
                type="button"
                onClick={onRetry}
                style={{
                  padding: "12px 18px",
                  borderRadius: "16px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "800",
                  background: "white",
                  color: dark,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 14px 34px rgba(0,0,0,0.18)",
                }}
              >
                <RefreshCw size={15} /> Atualizar página
              </button>

              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "12px 18px",
                    borderRadius: "16px",
                    textDecoration: "none",
                    fontWeight: "800",
                    background: "rgba(255,255,255,0.12)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.14)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Phone size={15} /> Falar com a loja
                </a>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginTop: "24px" }}>
              <div style={{ padding: "16px 18px", borderRadius: "22px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.72, marginBottom: "6px" }}>Estado atual</div>
                <div style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font-display)" }}>{planMeta.label}</div>
                <div style={{ fontSize: "12px", opacity: 0.82, marginTop: "4px" }}>{planMeta.detail}</div>
              </div>

              <div style={{ padding: "16px 18px", borderRadius: "22px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.72, marginBottom: "6px" }}>Mensagem</div>
                <div style={{ fontSize: "16px", fontWeight: "800", fontFamily: "var(--font-display)" }}>Volta em breve</div>
                <div style={{ fontSize: "12px", opacity: 0.82, marginTop: "4px" }}>
                  O atendimento da loja continua fora da vitrine até o plano voltar a ficar ativo.
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "22px",
              borderRadius: "28px",
              background: "rgba(255,255,255,0.94)",
              border: "1px solid rgba(255,255,255,0.24)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.12)",
              display: "grid",
              gap: "18px",
              alignContent: "start",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "999px", background: planMeta.toneBg, color: planMeta.toneColor, fontSize: "12px", fontWeight: "800" }}>
                <AlertTriangle size={14} /> {planMeta.label}
              </div>
              {expiryLabel ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: "700" }}>
                  <Clock3 size={14} /> {expiryLabel}
                </div>
              ) : null}
            </div>

            <div style={{ padding: "20px", borderRadius: "24px", background: `linear-gradient(155deg, rgba(28,154,116,0.1) 0%, rgba(240,201,120,0.18) 100%)`, border: "1px solid rgba(28,154,116,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <BrandMark brand={identityBrand} size={72} rounded={24} />
                <div>
                  <div style={{ fontSize: "13px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary)", fontWeight: "800" }}>Identidade da loja</div>
                  <div style={{ fontSize: "28px", lineHeight: 1.04, fontWeight: "800", fontFamily: "var(--font-display)", marginTop: "4px" }}>{storeName}</div>
                  <div style={{ marginTop: "8px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "999px", background: "rgba(255,255,255,0.7)", fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: "700" }}>
                    <Store size={13} /> Vitrine pública pausada
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "16px", fontSize: "14px", lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
                {storeDescription}
              </div>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ padding: "16px 18px", borderRadius: "22px", background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary)", fontWeight: "800", marginBottom: "6px" }}>O que está a acontecer</div>
                <div style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-text-primary)" }}>
                  O catálogo deixou de aceitar visitas públicas enquanto a loja regulariza o acesso do plano. Assim que a conta voltar a ficar ativa, a vitrine reaparece automaticamente.
                </div>
              </div>

              <div style={{ padding: "16px 18px", borderRadius: "22px", background: "rgba(16, 35, 31, 0.04)", border: "1px solid rgba(16,35,31,0.08)" }}>
                <div style={{ fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary)", fontWeight: "800", marginBottom: "6px" }}>Enquanto isso</div>
                <div style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
                  Guarda este link e volta a tentar daqui a pouco. Se a loja tiver atendimento manual ativo, o contacto direto por WhatsApp também pode continuar disponível.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
