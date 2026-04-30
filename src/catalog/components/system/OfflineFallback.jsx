import { RefreshCw, WifiOff } from "lucide-react";
import BrandMark from "../common/BrandMark.jsx";

export default function OfflineFallback({
  brand,
  title = "Sem ligacao neste momento",
  message = "Precisamos de internet para abrir esta area agora.",
  hint = "Volta a tentar quando a ligacao estiver estavel.",
  actionLabel = "Tentar novamente",
  onRetry,
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `
          radial-gradient(circle at top left, rgba(28,154,116,0.12), transparent 24%),
          radial-gradient(circle at bottom right, rgba(240,201,120,0.18), transparent 20%),
          linear-gradient(180deg, #fbfdf9 0%, #eef4ec 100%)
        `,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          padding: "26px 24px",
          borderRadius: "32px",
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(104, 128, 120, 0.18)",
          boxShadow: "0 24px 64px rgba(12, 37, 34, 0.1)",
          backdropFilter: "blur(18px)",
          display: "grid",
          gap: "16px",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "999px", background: "rgba(12,37,34,0.05)", width: "fit-content" }}>
          <BrandMark brand={brand} size={34} rounded={12} />
          <span style={{ fontSize: "11px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>
            Modo offline
          </span>
        </div>

        <div style={{ width: "62px", height: "62px", borderRadius: "20px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, rgba(12,37,34,0.08) 0%, rgba(28,154,116,0.16) 100%)", color: brand?.dark || "#0c2522" }}>
          <WifiOff size={28} />
        </div>

        <div>
          <div style={{ fontSize: "30px", lineHeight: 1.05, fontWeight: "800", fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}>
            {title}
          </div>
          <div style={{ marginTop: "10px", fontSize: "14px", lineHeight: 1.75, color: "var(--color-text-secondary)" }}>
            {message}
          </div>
        </div>

        <div style={{ padding: "16px 18px", borderRadius: "22px", background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", fontSize: "13px", lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
          {hint}
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: "12px 18px",
              borderRadius: "16px",
              border: "none",
              cursor: "pointer",
              fontWeight: "800",
              background: `linear-gradient(135deg, ${brand?.dark || "#0c2522"} 0%, ${brand?.accent || "#1c9a74"} 100%)`,
              color: "white",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 16px 34px rgba(12, 37, 34, 0.18)",
            }}
          >
            <RefreshCw size={15} /> {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
