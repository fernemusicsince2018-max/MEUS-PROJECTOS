export default function FLabel({ label, hint, children }) {
  return (
    <div>
      <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "6px" }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "4px" }}>{hint}</div>}
    </div>
  );
}
