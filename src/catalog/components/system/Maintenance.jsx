export default function Maintenance({
  title = "Catálogo em manutenção",
  message = "O acesso público aos catálogos foi pausado temporariamente pelo super admin. Tenta novamente daqui a pouco.",
  symbol = "!",
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px", background: "var(--color-background-secondary)" }}>
      <div style={{ maxWidth: "520px", textAlign: "center", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "28px 24px", boxShadow: "0 20px 60px rgba(12, 37, 34, 0.08)" }}>
        <div style={{ fontSize: "42px", marginBottom: "12px" }}>{symbol}</div>
        <div style={{ fontSize: "22px", fontWeight: "800", marginBottom: "10px", fontFamily: "var(--font-display)" }}>{title}</div>
        <div style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
          {message}
        </div>
      </div>
    </div>
  );
}
