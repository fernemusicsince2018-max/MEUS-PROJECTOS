import { ChevronDown, ChevronUp } from "lucide-react";
import { SURFACE_STYLE } from "../../constants.js";

export function Badge({ children, bg, color, borderColor = "transparent", style = {} }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        padding: "3px 8px",
        background: bg,
        color,
        border: `1px solid ${borderColor}`,
        borderRadius: "999px",
        fontWeight: "600",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function ToggleTile({ label, description, checked, onChange, ...buttonProps }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked ? "true" : "false"}
      {...buttonProps}
      style={{
        ...SURFACE_STYLE,
        padding: "12px 14px",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}
    >
      <div>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--color-text-primary)" }}>{label}</div>
        <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "3px" }}>{description}</div>
      </div>
      <div
        style={{
          width: "42px",
          height: "24px",
          borderRadius: "999px",
          background: checked ? "#16a34a" : "var(--color-border-tertiary)",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: "white",
            position: "absolute",
            top: "3px",
            left: checked ? "21px" : "3px",
            transition: "left 140ms ease",
          }}
        />
      </div>
    </button>
  );
}

export function StatTile({ label, value, hint, color, compact = false, style = {} }) {
  const padding = compact ? "12px 14px" : "16px";
  const labelFontSize = compact ? "11px" : "12px";
  const valueFontSize = compact ? "20px" : "24px";
  const hintFontSize = compact ? "11px" : "12px";
  const labelMarginBottom = compact ? "6px" : "8px";
  const hintMarginTop = compact ? "3px" : "4px";

  return (
    <div style={{ ...SURFACE_STYLE, padding, ...style }}>
      <div style={{ fontSize: labelFontSize, color: "var(--color-text-secondary)", marginBottom: labelMarginBottom }}>{label}</div>
      <div style={{ fontSize: valueFontSize, fontWeight: "700", color }}>{value}</div>
      <div style={{ fontSize: hintFontSize, color: "var(--color-text-secondary)", marginTop: hintMarginTop }}>{hint}</div>
    </div>
  );
}

export function CatalogMetric({ label, value }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: "18px",
        padding: "12px 12px 10px",
        textAlign: "center",
        backdropFilter: "blur(14px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      <div style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: "10px", opacity: 0.8, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "2px" }}>{label}</div>
    </div>
  );
}

export function PreviewLine({ label, value, swatch }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", fontSize: "13px" }}>
      <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--color-text-primary)", fontWeight: "600" }}>
        {swatch && <span style={{ width: "12px", height: "12px", borderRadius: "999px", background: swatch, display: "inline-block" }} />}
        {value}
      </span>
    </div>
  );
}

export function CollapsiblePanel({
  title,
  description = "",
  open = true,
  onToggle,
  children,
  summary = null,
  style = {},
  bodyStyle = {},
  summaryStyle = {},
  headerActions = null,
  toggleLabels = {},
}) {
  const openLabel = toggleLabels.open || "Mostrar formulario";
  const closeLabel = toggleLabels.close || "Esconder formulario";

  return (
    <div
      style={{
        ...SURFACE_STYLE,
        padding: "20px",
        display: "grid",
        gap: "16px",
        ...style,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: "4px", flex: "1 1 260px" }}>
          <div style={{ fontSize: "17px", fontWeight: "800", fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}>
            {title}
          </div>
          {description ? (
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              {description}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {headerActions}
          <button
            type="button"
            onClick={onToggle}
            style={{
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "999px",
              padding: "9px 12px",
              background: open ? "var(--color-background-secondary)" : "var(--color-background-primary)",
              color: "var(--color-text-primary)",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "700",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
            }}
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {open ? closeLabel : openLabel}
          </button>
        </div>
      </div>

      {open ? (
        <div style={{ display: "grid", gap: "14px", ...bodyStyle }}>
          {children}
        </div>
      ) : summary ? (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "16px",
            border: "0.5px dashed var(--color-border-tertiary)",
            color: "var(--color-text-secondary)",
            fontSize: "12px",
            lineHeight: 1.6,
            ...summaryStyle,
          }}
        >
          {summary}
        </div>
      ) : null}
    </div>
  );
}

export function Toast({ msg }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(var(--toast-offset, 24px) + env(safe-area-inset-bottom, 0px))",
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-md)",
        padding: "10px 18px",
        fontSize: "13px",
        fontWeight: "600",
        zIndex: 9999,
        whiteSpace: "nowrap",
        color: "var(--color-text-primary)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      }}
    >
      {msg}
    </div>
  );
}
