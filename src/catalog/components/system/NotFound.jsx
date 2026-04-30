import { ArrowRight, Compass, Store } from "lucide-react";
import { buildAuthPath, buildRootPath } from "../../utils/appRoutes.js";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          padding: "28px",
          borderRadius: "28px",
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(104, 128, 120, 0.14)",
          boxShadow: "0 24px 54px rgba(16,35,31,0.08)",
          textAlign: "center",
          display: "grid",
          gap: "14px",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "20px",
            margin: "0 auto",
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(135deg, rgba(37,174,130,0.14) 0%, rgba(27,28,72,0.18) 100%)",
            color: "var(--color-text-primary)",
          }}
        >
          <Compass size={28} />
        </div>
        <div style={{ fontSize: "28px", fontFamily: "var(--font-display)", fontWeight: "800", letterSpacing: "-0.03em" }}>
          Pagina ou loja nao encontrada
        </div>
        <div style={{ fontSize: "14px", lineHeight: 1.75, color: "var(--color-text-secondary)" }}>
          O link pode ter expirado, estar incompleto ou apontar para uma rota que nao existe neste ambiente.
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginTop: "4px" }}>
          <a
            href={buildRootPath()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #25ae82 0%, #1b1c48 160%)",
              color: "white",
              textDecoration: "none",
              fontWeight: "800",
              fontSize: "13px",
            }}
          >
            <Store size={14} />
            Ir para a entrada publica
          </a>
          <a
            href={buildAuthPath()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              borderRadius: "16px",
              background: "rgba(16,35,31,0.06)",
              color: "var(--color-text-primary)",
              textDecoration: "none",
              fontWeight: "800",
              fontSize: "13px",
              border: "1px solid rgba(104, 128, 120, 0.14)",
            }}
          >
            Entrar no painel
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
