import React from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";

const DISMISS_STORAGE_KEY = "catalog:pwa-install-dismissed-at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator?.standalone === true
  );
}

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(max-width: 900px)")?.matches ?? false;
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const userAgent = String(navigator.userAgent || "");
  const isIos = /iphone|ipad|ipod/i.test(userAgent);
  const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios|chrome|android/i.test(userAgent);
  return isIos && isSafari;
}

function wasDismissedRecently() {
  if (typeof window === "undefined") return false;

  try {
    const rawValue = Number(window.localStorage.getItem(DISMISS_STORAGE_KEY) || 0);
    return Number.isFinite(rawValue) && rawValue > 0 && Date.now() - rawValue < DISMISS_DURATION_MS;
  } catch (error) {
    return false;
  }
}

function persistDismiss() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch (error) {}
}

export default function PwaInstallPrompt({ brand, screen }) {
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [installed, setInstalled] = React.useState(() => isStandaloneMode());
  const [dismissed, setDismissed] = React.useState(() => wasDismissedRecently());
  const [mobileOnly, setMobileOnly] = React.useState(() => isMobileViewport());

  React.useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setDismissed(true);
    };

    const handleResize = () => {
      setMobileOnly(isMobileViewport());
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const shouldShowIosHint = !installed && !deferredPrompt && isIosSafari();
  const canPromptInstall = Boolean(deferredPrompt);
  const shouldShow = !installed && !dismissed && mobileOnly && (canPromptInstall || shouldShowIosHint);
  const isMerchantContext = screen === "auth" || screen === "admin" || screen === "superadmin";

  if (!shouldShow || !isMerchantContext) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
    } catch (error) {}

    setDeferredPrompt(null);
  }

  function handleDismiss() {
    persistDismiss();
    setDismissed(true);
  }

  return (
    <div
      style={{
        position: "fixed",
        left: "16px",
        right: "16px",
        bottom: "calc(var(--install-prompt-offset, 18px) + env(safe-area-inset-bottom, 0px))",
        maxWidth: "420px",
        margin: "0 auto",
        zIndex: 9998,
        borderRadius: "22px",
        padding: "15px 15px 13px",
        background: `linear-gradient(135deg, ${brand.dark || "#0c2522"} 0%, ${brand.accent || "#1c9a74"} 58%, ${brand.highlight || "#f0c978"} 180%)`,
        color: "white",
        boxShadow: "0 22px 44px rgba(12, 37, 34, 0.28)",
        border: "1px solid rgba(255,255,255,0.14)",
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fechar instalação"
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          width: "30px",
          height: "30px",
          borderRadius: "999px",
          border: "none",
          background: "rgba(255,255,255,0.16)",
          color: "white",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={15} />
      </button>

      <div style={{ display: "grid", gap: "10px", paddingRight: "30px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.86 }}>
          <Smartphone size={13} /> Instalar app
        </div>
        <div style={{ fontSize: "20px", lineHeight: 1.08, fontWeight: "800", fontFamily: "var(--font-display)" }}>
          Leva o painel contigo.
        </div>
        <div style={{ fontSize: "13px", lineHeight: 1.65, opacity: 0.92 }}>
          {canPromptInstall
            ? "Abre em 1 toque, com aspeto de app e acesso rápido a pedidos, loja e vitrine."
            : "No iPhone, usa Partilhar -> Adicionar ao Ecrã principal para instalar."}
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
          {canPromptInstall ? (
            <button
              type="button"
              onClick={handleInstall}
              style={{
                padding: "10px 14px",
                borderRadius: "14px",
                border: "none",
                background: "rgba(255,255,255,0.94)",
                color: brand.dark || "#0c2522",
                fontSize: "13px",
                fontWeight: "800",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Download size={14} /> Instalar
            </button>
          ) : (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.14)",
                fontSize: "12px",
                fontWeight: "700",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Share2 size={14} /> Partilhar {"->"} Ecrã principal
            </div>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            style={{
              padding: "10px 14px",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.24)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Mais tarde
          </button>
        </div>
      </div>
    </div>
  );
}
