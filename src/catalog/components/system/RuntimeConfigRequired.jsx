export default function RuntimeConfigRequired({ title = "Configuração obrigatória", message = "" }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "620px",
          borderRadius: "24px",
          background: "white",
          border: "1px solid rgba(148, 163, 184, 0.18)",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
          padding: "28px",
          display: "grid",
          gap: "14px",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", color: "#b45309" }}>
          API obrigatória
        </div>
        <div style={{ fontSize: "28px", lineHeight: 1.08, fontWeight: "800", color: "#0f172a" }}>{title}</div>
        <div style={{ fontSize: "14px", lineHeight: 1.7, color: "#475569" }}>
          {message || "Esta instalação precisa da API configurada para autenticar, gravar catálogos, pedidos e dados da base de dados com segurança."}
        </div>
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "16px",
            background: "#fff7ed",
            color: "#9a3412",
            fontSize: "13px",
            fontWeight: "700",
          }}
        >
          Define `VITE_CATALOG_API_BASE=/api` para web e uma URL absoluta em `VITE_NATIVE_CATALOG_API_BASE` para o app móvel antes de publicar.
        </div>
      </div>
    </div>
  );
}
