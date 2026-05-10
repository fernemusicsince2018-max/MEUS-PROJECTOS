import React from "react";
import { Check, Copy, ExternalLink, Phone, QrCode, Share2 } from "lucide-react";
import { SURFACE_STYLE } from "../../constants.js";
import { isLocalNetworkHostname } from "../../../../shared/storefront.js";

export default function ShareTab({ catUrl, color, store, catalogLocked = false, planAccessMessage = "", activationUrl = "" }) {
  const [copied, setCopied] = React.useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const isPublicEnabled = Boolean(store?.publicEnabled);
  const shareText = `${store.name || "Catalogo"}: ${catUrl}`;
  const canShareCatalog = catUrl && isPublicEnabled && !catalogLocked;
  const isLocalOnlyUrl = canShareCatalog && isLocalNetworkHostname(catUrl);
  const qrSrc = canShareCatalog ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(catUrl)}` : "";
  const waHref = canShareCatalog ? `https://wa.me/?text=${encodeURIComponent(`Vem ver este catalogo: ${catUrl}`)}` : "#";
  const visibleCatalogUrl = canShareCatalog
    ? catUrl
    : !catUrl
      ? "Guarda a loja primeiro."
      : catalogLocked
        ? "Loja inativa ate a reativacao do plano."
        : 'Catalogo publico desligado em "Minha Loja".';
  const qrPlaceholderLabel = !catUrl
    ? "Guarda a loja primeiro."
    : catalogLocked
      ? "Loja inativa ate reativar o plano."
      : 'Liga o catalogo publico em "Minha Loja".';

  async function copy() {
    if (!canShareCatalog) return;
    try {
      await navigator.clipboard.writeText(catUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {}
  }

  async function shareNow() {
    if (!canShareCatalog) return;
    if (!canNativeShare) {
      copy();
      return;
    }

    try {
      await navigator.share({
        title: store.name || "Catalogo",
        text: shareText,
        url: catUrl,
      });
    } catch (error) {}
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 520px)", gap: "14px" }}>
      <div style={{ ...SURFACE_STYLE, padding: "20px" }}>
        <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "6px" }}>Compartilhar catalogo</div>
        <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "22px" }}>
          Envia o link, usa o QR Code ou abre logo a mensagem de partilha no WhatsApp.
        </div>

        {catalogLocked ? (
          <div style={{ marginBottom: "16px", padding: "12px 14px", borderRadius: "var(--border-radius-md)", background: "#fee2e2", color: "#b91c1c", display: "grid", gap: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: "700" }}>
              {planAccessMessage || "O teu plano nao esta ativo. O catalogo publico fica bloqueado ate ativares um plano."}
            </div>
            {activationUrl ? (
              <a
                href={activationUrl}
                target="_blank"
                rel="noreferrer"
                style={{ width: "fit-content", padding: "8px 12px", background: "#b91c1c", color: "white", borderRadius: "10px", fontSize: "12px", fontWeight: "700", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                Ativar plano agora <ExternalLink size={13} />
              </a>
            ) : null}
          </div>
        ) : !isPublicEnabled ? (
          <div style={{ marginBottom: "16px", padding: "12px 14px", borderRadius: "var(--border-radius-md)", background: "#fff7ed", color: "#9a3412", fontSize: "12px", fontWeight: "700" }}>
            O catalogo publico esta desligado. Liga esta opcao em "Minha Loja" antes de partilhar o link.
          </div>
        ) : null}

        <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
          <ExternalLink size={13} /> Link do catalogo
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px", padding: "11px 12px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", fontSize: "11px", color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>
            {visibleCatalogUrl}
          </div>

          <button
            onClick={copy}
            disabled={!canShareCatalog}
            style={{
              padding: "10px 14px",
              background: copied ? "#16a34a" : color,
              color: "white",
              border: "none",
              borderRadius: "var(--border-radius-md)",
              cursor: canShareCatalog ? "pointer" : "not-allowed",
              fontSize: "12px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              minWidth: "90px",
              justifyContent: "center",
              opacity: canShareCatalog ? 1 : 0.55,
            }}
          >
            {copied ? (
              <>
                <Check size={12} /> Copiado
              </>
            ) : (
              <>
                <Copy size={12} /> Copiar
              </>
            )}
          </button>
        </div>

        {isLocalOnlyUrl ? (
          <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "var(--border-radius-md)", background: "#eff6ff", color: "#1d4ed8", fontSize: "12px", fontWeight: "600" }}>
            Este link aponta para o teu ambiente local. Ele so abre neste dispositivo ou noutros aparelhos que consigam chegar a este mesmo endereco na tua rede.
          </div>
        ) : null}

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
          <button
            onClick={shareNow}
            disabled={!canShareCatalog}
            style={{
              padding: "9px 14px",
              background: "transparent",
              color: "var(--color-text-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-md)",
              cursor: canShareCatalog ? "pointer" : "not-allowed",
              fontSize: "12px",
              fontWeight: "600",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              opacity: canShareCatalog ? 1 : 0.55,
            }}
          >
            <Share2 size={12} /> Partilhar
          </button>

          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "9px 14px",
              background: "#25D366",
              color: "white",
              borderRadius: "var(--border-radius-md)",
              fontSize: "12px",
              fontWeight: "600",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              opacity: canShareCatalog ? 1 : 0.55,
              pointerEvents: canShareCatalog ? "auto" : "none",
            }}
          >
            <Phone size={12} /> WhatsApp
          </a>
        </div>
      </div>

      <div style={{ ...SURFACE_STYLE, padding: "18px", textAlign: "center" }}>
        <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <QrCode size={13} /> QR Code
        </div>
        {qrSrc ? (
          <img src={qrSrc} alt="QR Code" style={{ width: "150px", height: "150px", borderRadius: "8px", margin: "0 auto" }} />
        ) : (
          <div style={{ width: "150px", height: "150px", background: "var(--color-background-secondary)", borderRadius: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)", fontSize: "12px", margin: "0 auto" }}>
            {qrPlaceholderLabel}
          </div>
        )}
        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "12px" }}>
          Ideal para montra, bancada, embalagens ou cartao de visita.
        </div>
        {qrSrc && (
          <a
            href={qrSrc}
            download="qrcode.png"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "12px",
              padding: "8px 18px",
              background: color,
              color: "white",
              borderRadius: "var(--border-radius-md)",
              fontSize: "12px",
              fontWeight: "600",
              textDecoration: "none",
            }}
          >
            Baixar QR Code
          </a>
        )}
      </div>
    </div>
  );
}
