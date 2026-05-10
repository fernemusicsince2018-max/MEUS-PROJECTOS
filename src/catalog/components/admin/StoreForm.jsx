import React from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, CircleCheckBig, ExternalLink, ImagePlus, PencilLine, Trash2 } from "lucide-react";
import { FIELD_STYLE, PALETTE, STORE_CURRENCY_OPTIONS, STORE_DEFAULTS, SURFACE_STYLE, TEXTAREA_STYLE, WHATSAPP_ORDER_FORMAT_OPTIONS } from "../../constants.js";
import { assetService } from "../../services/assetService.js";
import { normalizeStore } from "../../utils/catalog.js";
import { COUNTRY_OPTIONS, getCanonicalCountry, getCountryRegionLabel, getCountryRegions, isPresetCountry } from "../../utils/countryRegions.js";
import { buildStoreLogoDataUrl, validateStoreLogo } from "../../utils/storeLogo.js";
import { getStoreFieldMeta, validateBusinessEmail, validatePhoneForCountry, validateTaxIdForCountry, validateWhatsAppForCountry } from "../../utils/storeValidation.js";
import { validateCustomDomain, validateStorefrontSlug } from "../../../../shared/storefront.js";
import FLabel from "../common/FLabel.jsx";
import { Badge, PreviewLine, ToggleTile } from "../common/UiBits.jsx";

function formatPreviewValue(value, fallback = "Nao definido") {
  if (typeof value === "boolean") {
    return value ? "Sim" : "Nao";
  }

  const text = String(value || "").trim();
  return text || fallback;
}

function hasFilledValue(value) {
  if (typeof value === "boolean") return true;
  return Boolean(String(value || "").trim());
}

function getSectionStatus(values = [], total = values.length || 1) {
  const filled = values.filter(hasFilledValue).length;
  const configured = filled >= total;

  return {
    configured,
    filled,
    total,
    label: configured ? "Configurado" : "Pendente",
    bg: configured ? "#dcfce7" : "#fff7ed",
    color: configured ? "#166534" : "#c2410c",
    borderColor: configured ? "#bbf7d0" : "#fed7aa",
    detail: `${filled}/${total} campos principais`,
  };
}

function createClosedSections() {
  return {
    identity: false,
    operations: false,
    business: false,
    payment: false,
    location: false,
  };
}

function getInitialOpenSections(store) {
  const normalized = normalizeStore(store);
  const hasIdentity = Boolean(normalized.name || normalized.description || normalized.whatsapp || normalized.logo);
  const hasOperations = Boolean(normalized.pickupNote) || normalized.publicEnabled;
  const hasBusiness = Boolean(normalized.legalName || normalized.taxId || normalized.businessPhone || normalized.businessEmail || normalized.addressLine);
  const hasPayment = Boolean(
    normalized.paymentMethod
    || normalized.paymentBankName
    || normalized.paymentAccountName
    || normalized.paymentAccountNumber
    || normalized.paymentIban,
  );
  const hasLocation = Boolean(normalized.country || normalized.city) || normalized.color !== STORE_DEFAULTS.color;

  return {
    identity: !hasIdentity,
    operations: !hasOperations,
    business: !hasBusiness,
    payment: !hasPayment,
    location: !hasLocation,
  };
}

function SectionCard({ title, description, status, open, onToggle, summary, children }) {
  return (
    <div
      style={{
        ...SURFACE_STYLE,
        padding: "18px 20px",
        display: "grid",
        gap: "14px",
        border: status
          ? `1px solid ${status.configured ? "rgba(34,197,94,0.14)" : "rgba(249,115,22,0.16)"}`
          : SURFACE_STYLE.border,
        background: status
          ? status.configured
            ? "linear-gradient(180deg, rgba(240,253,244,0.52) 0%, rgba(255,255,255,0.99) 100%)"
            : "linear-gradient(180deg, rgba(255,247,237,0.56) 0%, rgba(255,255,255,0.99) 100%)"
          : SURFACE_STYLE.background,
        boxShadow: status
          ? status.configured
            ? "0 14px 28px rgba(22,101,52,0.035)"
            : "0 14px 28px rgba(194,65,12,0.04)"
          : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
            <div style={{ fontSize: "15px", fontWeight: "700" }}>{title}</div>
            {status ? (
              <Badge
                bg={status.bg}
                color={status.color}
                borderColor={status.borderColor}
                style={{
                  fontSize: "10px",
                  fontWeight: "800",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "4px 9px",
                  boxShadow: status.configured ? "0 8px 18px rgba(22,101,52,0.12)" : "0 8px 18px rgba(194,65,12,0.12)",
                }}
              >
                {status.configured ? <CircleCheckBig size={11} /> : <AlertTriangle size={11} />}
                {status.label}
              </Badge>
            ) : null}
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{description}</div>
          {status ? (
            <div style={{ fontSize: "11px", color: status.color, marginTop: "6px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              {status.configured ? <CircleCheckBig size={12} /> : <AlertTriangle size={12} />}
              {status.detail}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          style={{
            padding: "8px 12px",
            borderRadius: "999px",
            border: "0.5px solid var(--color-border-tertiary)",
            background: open ? "var(--color-background-secondary)" : "var(--color-background-primary)",
            cursor: "pointer",
            color: "var(--color-text-primary)",
            fontSize: "12px",
            fontWeight: "700",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
          }}
        >
          <PencilLine size={13} />
          {open ? "Fechar" : "Editar"}
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {open ? children : <div style={{ display: "grid", gap: "10px" }}>{summary}</div>}
    </div>
  );
}

export default function StoreForm({ store, onSave, catalogLocked = false, planAccessMessage = "", activationUrl = "" }) {
  const [form, setForm] = React.useState(normalizeStore(store));
  const [logoError, setLogoError] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [customCountryMode, setCustomCountryMode] = React.useState(() => {
    const normalizedStore = normalizeStore(store);
    return Boolean(normalizedStore.country) && !isPresetCountry(normalizedStore.country);
  });
  const [openSections, setOpenSections] = React.useState(() => getInitialOpenSections(store));
  const fileInputRef = React.useRef(null);
  const collapseAfterSaveRef = React.useRef(false);
  const selectedCurrency = STORE_CURRENCY_OPTIONS.find((option) => option.value === form.currencyCode) || STORE_CURRENCY_OPTIONS[0];
  const canonicalCountry = getCanonicalCountry(form.country);
  const selectedCountryValue = customCountryMode ? "__custom__" : canonicalCountry;
  const regionOptions = getCountryRegions(canonicalCountry);
  const regionLabel = getCountryRegionLabel(canonicalCountry);
  const hasLegacyRegionValue = Boolean(form.city) && regionOptions.length > 0 && !regionOptions.includes(form.city);
  const fieldMeta = getStoreFieldMeta(form.country);
  const identityStatus = getSectionStatus([form.name, form.whatsapp, form.currencyCode], 3);
  const operationsStatus = getSectionStatus([form.pickupNote, form.publicSlug || form.customDomain], 2);
  const businessStatus = getSectionStatus([form.legalName, form.taxId, form.businessPhone, form.businessEmail, form.addressLine], 5);
  const paymentStatus = getSectionStatus(
    [form.paymentMethod, form.paymentBankName, form.paymentAccountName, form.paymentAccountNumber || form.paymentIban],
    4,
  );
  const locationStatus = getSectionStatus([form.country, form.city], 2);

  React.useEffect(() => {
    const normalizedStore = normalizeStore(store);
    setForm(normalizedStore);
    setCustomCountryMode(Boolean(normalizedStore.country) && !isPresetCountry(normalizedStore.country));
    setLogoError("");
    setSaveError("");
    setUploadingLogo(false);
    if (collapseAfterSaveRef.current) {
      collapseAfterSaveRef.current = false;
      setOpenSections(createClosedSections());
      return;
    }
    setOpenSections(getInitialOpenSections(normalizedStore));
  }, [store]);

  async function handleLogoSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const logoDataUrl = await buildStoreLogoDataUrl(file);
      const uploaded = await assetService.uploadAsset({
        kind: "store_logo",
        dataUrl: logoDataUrl,
        fileName: file.name || "store-logo",
      });
      setForm((current) => ({ ...current, logo: uploaded.url }));
      setLogoError("");
    } catch (failure) {
      setLogoError(failure.message || "Nao foi possivel carregar o logo.");
    } finally {
      setUploadingLogo(false);
      event.target.value = "";
    }
  }

  async function handleSave() {
    if (uploadingLogo) {
      setLogoError("Aguarda um momento. O logo ainda esta a ser preparado.");
      return;
    }

    const nextLogoError = validateStoreLogo(form.logo);
    if (nextLogoError) {
      setLogoError(nextLogoError);
      return;
    }

    const whatsappValidation = validateWhatsAppForCountry(form.country, form.whatsapp, "O WhatsApp");
    if (whatsappValidation.error) {
      setSaveError(whatsappValidation.error);
      return;
    }

    const businessPhoneValidation = validatePhoneForCountry(form.country, form.businessPhone, "O telefone da empresa");
    if (businessPhoneValidation.error) {
      setSaveError(businessPhoneValidation.error);
      return;
    }

    const businessEmailValidation = validateBusinessEmail(form.businessEmail, "O email comercial");
    if (businessEmailValidation.error) {
      setSaveError(businessEmailValidation.error);
      return;
    }

    const taxValidation = validateTaxIdForCountry(form.country, form.taxId, fieldMeta.taxLabel);
    if (taxValidation.error) {
      setSaveError(taxValidation.error);
      return;
    }

    const storefrontSlugValidation = validateStorefrontSlug(form.publicSlug);
    if (storefrontSlugValidation.error) {
      setSaveError(storefrontSlugValidation.error);
      return;
    }

    const customDomainValidation = validateCustomDomain(form.customDomain);
    if (customDomainValidation.error) {
      setSaveError(customDomainValidation.error);
      return;
    }

    setLogoError("");
    setSaveError("");
    setSaving(true);
    collapseAfterSaveRef.current = true;
    const preparedForm = {
      ...form,
      whatsapp: whatsappValidation.normalized,
      businessPhone: businessPhoneValidation.normalized,
      businessEmail: businessEmailValidation.normalized,
      taxId: taxValidation.normalized,
      publicSlug: storefrontSlugValidation.normalized,
      customDomain: customDomainValidation.normalized,
    };
    try {
      setForm(preparedForm);
      await onSave(preparedForm);
      setOpenSections(createClosedSections());
    } catch (error) {
      collapseAfterSaveRef.current = false;
      setSaveError(error.message || "Nao foi possivel validar os dados da loja.");
    } finally {
      setSaving(false);
    }
  }

  function handleCountrySelectChange(event) {
    const nextCountry = event.target.value;
    if (nextCountry === "__custom__") {
      setCustomCountryMode(true);
      setForm((current) => ({
        ...current,
        country: isPresetCountry(current.country) ? "" : current.country,
      }));
      return;
    }

    const nextCanonicalCountry = getCanonicalCountry(nextCountry);
    const nextRegions = getCountryRegions(nextCanonicalCountry);
    setCustomCountryMode(false);
    setForm((current) => ({
      ...current,
      country: nextCanonicalCountry,
      city: nextRegions.length > 0 && !nextRegions.includes(current.city) ? "" : current.city,
    }));
  }

  function handleCustomCountryChange(event) {
    const nextCountry = event.target.value;
    const nextCanonicalCountry = getCanonicalCountry(nextCountry);
    const nextRegions = getCountryRegions(nextCanonicalCountry);
    const nextIsPresetCountry = isPresetCountry(nextCanonicalCountry);
    const storedCountry = nextIsPresetCountry ? nextCanonicalCountry : nextCountry;
    setCustomCountryMode(!nextIsPresetCountry);
    setForm((current) => ({
      ...current,
      country: storedCountry,
      city: nextRegions.length > 0 && !nextRegions.includes(current.city) ? "" : current.city,
    }));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "16px", alignItems: "start" }}>
      <div style={{ display: "grid", gap: "16px" }}>
        <div style={{ ...SURFACE_STYLE, padding: "20px" }}>
          <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "6px" }}>Configurar loja</div>
          <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            Depois de guardares, as secoes ficam fechadas com resumo visivel. Usa o botao de editar em cada bloco para alterar apenas o que precisares.
          </div>
        </div>

        <SectionCard
          title="Identidade da loja"
          description="Nome, descrição, WhatsApp, moeda e logo usados na vitrine e no carrinho."
          status={identityStatus}
          open={openSections.identity}
          onToggle={() => setOpenSections((current) => ({ ...current, identity: !current.identity }))}
          summary={
            <>
              <PreviewLine label="Nome" value={formatPreviewValue(form.name, "Ainda sem nome")} />
              <PreviewLine label="Descrição" value={formatPreviewValue(form.description)} />
              <PreviewLine label="WhatsApp" value={formatPreviewValue(form.whatsapp)} />
              <PreviewLine label="Moeda" value={selectedCurrency.label} />
              <PreviewLine label="Logo" value={form.logo ? "Configurado" : "Sem logo"} />
            </>
          }
        >
          <div style={{ display: "grid", gap: "16px" }}>
            <FLabel label="Nome da loja">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Moda & Estilo." style={FIELD_STYLE} />
            </FLabel>

            <FLabel label="Descricao">
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Uma frase curta sobre a tua loja." rows={3} style={TEXTAREA_STYLE} />
            </FLabel>

            <FLabel label="WhatsApp ou link direto" hint={fieldMeta.whatsappHint}>
              <input data-testid="store-whatsapp" value={form.whatsapp} onChange={(event) => { setForm({ ...form, whatsapp: event.target.value }); setSaveError(""); }} placeholder={fieldMeta.whatsappPlaceholder} style={FIELD_STYLE} />
            </FLabel>

            <FLabel label="Moeda principal" hint="Usada nos produtos, no carrinho e na mensagem do WhatsApp.">
              <select value={form.currencyCode} onChange={(event) => setForm({ ...form, currencyCode: event.target.value })} style={FIELD_STYLE}>
                {STORE_CURRENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FLabel>

            <FLabel label="Logo da loja" hint="Podes carregar uma imagem do computador ou colar uma URL pública.">
              <div style={{ display: "grid", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoSelect} style={{ display: "none" }} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "var(--border-radius-md)",
                      border: "0.5px solid var(--color-border-tertiary)",
                      background: "var(--color-background-secondary)",
                      cursor: "pointer",
                      color: "var(--color-text-primary)",
                      fontSize: "12px",
                      fontWeight: "700",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <ImagePlus size={14} /> {uploadingLogo ? "A enviar logo..." : "Carregar foto do PC"}
                  </button>
                  {form.logo && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm((current) => ({ ...current, logo: "" }));
                        setLogoError("");
                      }}
                      style={{
                        padding: "9px 12px",
                        borderRadius: "var(--border-radius-md)",
                        border: "0.5px solid #fecdd3",
                        background: "#fff1f2",
                        cursor: "pointer",
                        color: "#be123c",
                        fontSize: "12px",
                        fontWeight: "700",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Trash2 size={14} /> Remover logo
                    </button>
                  )}
                </div>
                <input
                  value={form.logo}
                  onChange={(event) => {
                    setForm({ ...form, logo: event.target.value });
                    setLogoError("");
                    setSaveError("");
                  }}
                  placeholder="https://cdn.exemplo.com/logo.png"
                  style={FIELD_STYLE}
                />
                {form.logo && (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <img
                      key={form.logo}
                      src={form.logo}
                      alt="Preview do logo"
                      style={{ width: "54px", height: "54px", objectFit: "cover", borderRadius: "14px", border: "0.5px solid var(--color-border-tertiary)" }}
                      onError={(event) => {
                        event.target.style.display = "none";
                      }}
                    />
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      O preview aparece aqui antes de guardares.
                    </div>
                  </div>
                )}
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  Se escolheres um ficheiro local, o sistema otimiza e prepara o logo antes de guardar.
                </div>
                {logoError && <div style={{ padding: "10px 12px", borderRadius: "var(--border-radius-md)", background: "#fee2e2", color: "#b91c1c", fontSize: "12px", fontWeight: "700" }}>{logoError}</div>}
              </div>
            </FLabel>
          </div>
        </SectionCard>

        <SectionCard
          title="Entrega e visibilidade"
          description="Define como o cliente recebe a compra e se o catálogo pode ficar público."
          status={operationsStatus}
          open={openSections.operations}
          onToggle={() => setOpenSections((current) => ({ ...current, operations: !current.operations }))}
          summary={
            <>
              <PreviewLine label="Recebimento" value={formatPreviewValue(form.pickupNote)} />
              <PreviewLine
                label="Formato do pedido"
                value={WHATSAPP_ORDER_FORMAT_OPTIONS.find((option) => option.value === form.whatsappOrderFormat)?.label || "Pedido escrito com quantidades e preços"}
              />
              <PreviewLine label="Catálogo público" value={form.publicEnabled ? "Ativo" : "Desligado"} />
              <PreviewLine label="Subdominio" value={formatPreviewValue(form.publicSlug)} />
              <PreviewLine label="Dominio proprio" value={formatPreviewValue(form.customDomain)} />
            </>
          }
        >
          <div style={{ display: "grid", gap: "16px" }}>
            <FLabel label="Entrega ou retirada do pedido" hint="Escreve como o cliente recebe a compra: entrega, retirada na loja ou os dois.">
              <input data-testid="store-pickup-note" value={form.pickupNote} onChange={(event) => { setForm({ ...form, pickupNote: event.target.value }); setSaveError(""); }} placeholder="Ex.: Entrega em Luanda e retirada na loja das 9h as 18h." style={FIELD_STYLE} />
            </FLabel>

            <FLabel label="Formato da mensagem no WhatsApp" hint="O WhatsApp recebe sempre o pedido escrito com quantidades e preços. As fotos não seguem como anexo automático neste fluxo; se escolheres links das imagens, eles só entram quando a foto do produto for uma URL pública.">
              <select
                value={form.whatsappOrderFormat || "text_only"}
                onChange={(event) => { setForm({ ...form, whatsappOrderFormat: event.target.value }); setSaveError(""); }}
                style={FIELD_STYLE}
              >
                {WHATSAPP_ORDER_FORMAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FLabel>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              <FLabel label="Subdomínio público" hint="Opcional. Define o nome da loja no host público da plataforma, por exemplo `minha-loja`.">
                <input
                  value={form.publicSlug}
                  onChange={(event) => {
                    setForm({ ...form, publicSlug: event.target.value });
                    setSaveError("");
                  }}
                  placeholder="minha-loja"
                  style={FIELD_STYLE}
                />
              </FLabel>

              <FLabel label="Dominio proprio" hint="Opcional. Se tiveres um host teu, escreve so o dominio, por exemplo `loja.exemplo.com`.">
                <input
                  value={form.customDomain}
                  onChange={(event) => {
                    setForm({ ...form, customDomain: event.target.value });
                    setSaveError("");
                  }}
                  placeholder="loja.exemplo.com"
                  style={FIELD_STYLE}
                />
              </FLabel>
            </div>

            <div style={{ paddingTop: "8px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
              {catalogLocked && (
                <div style={{ marginBottom: "12px", padding: "12px 14px", borderRadius: "var(--border-radius-md)", background: "#fee2e2", color: "#b91c1c", display: "grid", gap: "8px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700" }}>
                    {planAccessMessage || "O teu plano nao esta ativo. A loja fica bloqueada para clientes ate ativares um plano."}
                  </div>
                  {activationUrl ? (
                    <a
                      href={activationUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "white", background: "#b91c1c", textDecoration: "none", width: "fit-content", padding: "8px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      Ativar plano agora <ExternalLink size={13} />
                    </a>
                  ) : null}
                </div>
              )}
              <ToggleTile
                data-testid="store-public-enabled"
                label="Catálogo público ativo"
                description={
                  catalogLocked
                    ? "Mesmo ligado, o link público fica bloqueado para clientes enquanto o plano não estiver ativo."
                    : "Quando estiver desligado, o link público deixa de abrir para clientes e o catálogo fica apenas no painel admin."
                }
                checked={form.publicEnabled}
                onChange={(checked) => { setForm({ ...form, publicEnabled: checked }); setSaveError(""); }}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Dados da empresa"
          description="Informacoes internas/comerciais guardadas para gestao da empresa no painel admin."
          status={businessStatus}
          open={openSections.business}
          onToggle={() => setOpenSections((current) => ({ ...current, business: !current.business }))}
          summary={
            <>
              <PreviewLine label="Nome legal" value={formatPreviewValue(form.legalName)} />
              <PreviewLine label="Fiscal" value={formatPreviewValue(form.taxId)} />
              <PreviewLine label="Telefone" value={formatPreviewValue(form.businessPhone)} />
              <PreviewLine label="Email" value={formatPreviewValue(form.businessEmail)} />
              <PreviewLine label="Morada" value={formatPreviewValue(form.addressLine)} />
            </>
          }
        >
          <div style={{ display: "grid", gap: "16px" }}>
            <FLabel label="Nome legal da empresa" hint="Preenche se for diferente do nome da loja.">
              <input value={form.legalName} onChange={(event) => { setForm({ ...form, legalName: event.target.value }); setSaveError(""); }} placeholder="Ex.: Ferna Comercio e Servicos, Lda." style={FIELD_STYLE} />
            </FLabel>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <FLabel label={fieldMeta.taxLabel} hint={fieldMeta.taxHint}>
                <input value={form.taxId} onChange={(event) => { setForm({ ...form, taxId: event.target.value }); setSaveError(""); }} placeholder={fieldMeta.taxPlaceholder} style={FIELD_STYLE} />
              </FLabel>

              <FLabel label="Telefone da empresa" hint={fieldMeta.businessPhoneHint}>
                <input value={form.businessPhone} onChange={(event) => { setForm({ ...form, businessPhone: event.target.value }); setSaveError(""); }} placeholder={fieldMeta.businessPhonePlaceholder} style={FIELD_STYLE} />
              </FLabel>
            </div>

            <FLabel label="Email comercial">
              <input value={form.businessEmail} onChange={(event) => { setForm({ ...form, businessEmail: event.target.value }); setSaveError(""); }} placeholder="contacto@empresa.com" style={FIELD_STYLE} />
            </FLabel>

            <FLabel label="Morada da empresa">
              <textarea value={form.addressLine} onChange={(event) => { setForm({ ...form, addressLine: event.target.value }); setSaveError(""); }} placeholder="Rua, número e referência." rows={2} style={TEXTAREA_STYLE} />
            </FLabel>
          </div>
        </SectionCard>

        <SectionCard
          title="Dados de pagamento"
          description="Campos privados para guardar como a tua empresa recebe pagamentos. Nao aparecem no catalogo publico."
          status={paymentStatus}
          open={openSections.payment}
          onToggle={() => setOpenSections((current) => ({ ...current, payment: !current.payment }))}
          summary={
            <>
              <PreviewLine label="Metodo" value={formatPreviewValue(form.paymentMethod)} />
              <PreviewLine label="Banco" value={formatPreviewValue(form.paymentBankName)} />
              <PreviewLine label="Titular" value={formatPreviewValue(form.paymentAccountName)} />
              <PreviewLine label="Conta" value={formatPreviewValue(form.paymentAccountNumber)} />
              <PreviewLine label="IBAN" value={formatPreviewValue(form.paymentIban)} />
            </>
          }
        >
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <FLabel label="Metodo">
                <input value={form.paymentMethod} onChange={(event) => { setForm({ ...form, paymentMethod: event.target.value }); setSaveError(""); }} placeholder="Ex.: Transferencia bancaria." style={FIELD_STYLE} />
              </FLabel>

              <FLabel label="Banco">
                <input value={form.paymentBankName} onChange={(event) => { setForm({ ...form, paymentBankName: event.target.value }); setSaveError(""); }} placeholder="Ex.: BAI." style={FIELD_STYLE} />
              </FLabel>
            </div>

            <FLabel label="Titular">
              <input value={form.paymentAccountName} onChange={(event) => { setForm({ ...form, paymentAccountName: event.target.value }); setSaveError(""); }} placeholder="Nome do titular da conta." style={FIELD_STYLE} />
            </FLabel>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <FLabel label="Conta">
                <input value={form.paymentAccountNumber} onChange={(event) => { setForm({ ...form, paymentAccountNumber: event.target.value }); setSaveError(""); }} placeholder="Numero da conta." style={FIELD_STYLE} />
              </FLabel>

              <FLabel label="IBAN" hint="Opcional. Preenche quando a tua conta usar IBAN.">
                <input value={form.paymentIban} onChange={(event) => { setForm({ ...form, paymentIban: event.target.value }); setSaveError(""); }} placeholder="AO06 0000 0000 0000 0000 0000 0" style={FIELD_STYLE} />
              </FLabel>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Localizacao e aparencia"
          description="País, região e cor principal usados na interface e nos pedidos."
          status={locationStatus}
          open={openSections.location}
          onToggle={() => setOpenSections((current) => ({ ...current, location: !current.location }))}
          summary={
            <>
              <PreviewLine label="Pais" value={formatPreviewValue(form.country)} />
              <PreviewLine label={regionLabel} value={formatPreviewValue(form.city)} />
              <PreviewLine label="Cor" value={form.color} swatch={form.color} />
            </>
          }
        >
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <FLabel label="País" hint="Seleciona o país para carregar a lista certa de províncias, estados ou regiões.">
                <div style={{ display: "grid", gap: "8px" }}>
                  <select data-testid="store-country" value={selectedCountryValue} onChange={(event) => { handleCountrySelectChange(event); setSaveError(""); }} style={FIELD_STYLE}>
                    <option value="">Seleciona o país</option>
                    {COUNTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value="__custom__">Outro país</option>
                  </select>

                  {selectedCountryValue === "__custom__" && (
                    <input
                      data-testid="store-country-custom"
                      value={form.country}
                      onChange={(event) => { handleCustomCountryChange(event); setSaveError(""); }}
                      placeholder="Escreve o país"
                      style={FIELD_STYLE}
                    />
                  )}
                </div>
              </FLabel>

              <FLabel
                label={regionLabel}
                hint={regionOptions.length > 0 ? "A lista muda automaticamente de acordo com o país escolhido." : "Se o país não tiver lista configurada, podes escrever manualmente."}
              >
                {regionOptions.length > 0 ? (
                  <select
                    data-testid="store-region"
                    value={hasLegacyRegionValue ? "__current__" : form.city}
                    onChange={(event) => { setForm({ ...form, city: event.target.value === "__current__" ? form.city : event.target.value }); setSaveError(""); }}
                    style={FIELD_STYLE}
                  >
                    <option value="">{`Seleciona ${regionLabel.toLowerCase()}`}</option>
                    {hasLegacyRegionValue && <option value="__current__">{`Atual: ${form.city}`}</option>}
                    {regionOptions.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input data-testid="store-region" value={form.city} onChange={(event) => { setForm({ ...form, city: event.target.value }); setSaveError(""); }} placeholder="Ex.: Luanda." style={FIELD_STYLE} />
                )}
              </FLabel>
            </div>

            <FLabel label="Cor principal">
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => { setForm({ ...form, color }); setSaveError(""); }}
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      background: color,
                      cursor: "pointer",
                      border: form.color === color ? "3px solid var(--color-text-primary)" : "2px solid transparent",
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(event) => { setForm({ ...form, color: event.target.value }); setSaveError(""); }}
                  style={{
                    width: "34px",
                    height: "30px",
                    padding: "2px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border: "0.5px solid var(--color-border-tertiary)",
                    background: "transparent",
                  }}
                />
              </div>
            </FLabel>
          </div>
        </SectionCard>

        <div style={{ ...SURFACE_STYLE, padding: "18px 20px" }}>
          {saveError ? (
            <div style={{ marginBottom: "12px", padding: "11px 12px", borderRadius: "var(--border-radius-md)", background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", fontSize: "12px", fontWeight: "700" }}>
              {saveError}
            </div>
          ) : null}
          <button
            data-testid="store-save"
            type="button"
            onClick={handleSave}
            disabled={saving || uploadingLogo}
            style={{
              width: "100%",
              padding: "12px 22px",
              background: form.color,
              color: "white",
              border: "none",
              borderRadius: "var(--border-radius-md)",
              cursor: saving || uploadingLogo ? "not-allowed" : "pointer",
              fontWeight: "700",
              fontSize: "14px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              opacity: saving || uploadingLogo ? 0.75 : 1,
            }}
          >
            <Check size={14} /> {saving ? "A guardar..." : uploadingLogo ? "A enviar logo..." : "Guardar configurações"}
          </button>
        </div>
      </div>

      <div style={{ ...SURFACE_STYLE, padding: "18px 20px", display: "grid", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>Resumo completo</div>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            Este painel mostra tudo o que sera mantido no estado da loja depois de guardar.
          </div>
        </div>
        <div style={{ display: "grid", gap: "10px" }}>
          <PreviewLine label="Nome" value={formatPreviewValue(form.name, "Ainda sem nome")} />
          <PreviewLine label="Descrição" value={formatPreviewValue(form.description)} />
          <PreviewLine label="WhatsApp" value={formatPreviewValue(form.whatsapp)} />
          <PreviewLine label="Moeda" value={selectedCurrency.label} />
          <PreviewLine label="Logo" value={form.logo ? "Configurado" : "Sem logo"} />
          <PreviewLine label="Catálogo público" value={form.publicEnabled ? "Ativo" : "Desligado"} />
          <PreviewLine label="Subdominio" value={formatPreviewValue(form.publicSlug)} />
          <PreviewLine label="Dominio proprio" value={formatPreviewValue(form.customDomain)} />
          <PreviewLine label="Recebimento" value={formatPreviewValue(form.pickupNote)} />
          <PreviewLine label="Nome legal" value={formatPreviewValue(form.legalName)} />
          <PreviewLine label="Fiscal" value={formatPreviewValue(form.taxId)} />
          <PreviewLine label="Telefone empresa" value={formatPreviewValue(form.businessPhone)} />
          <PreviewLine label="Email comercial" value={formatPreviewValue(form.businessEmail)} />
          <PreviewLine label="Morada" value={formatPreviewValue(form.addressLine)} />
          <PreviewLine label="Metodo" value={formatPreviewValue(form.paymentMethod)} />
          <PreviewLine label="Banco" value={formatPreviewValue(form.paymentBankName)} />
          <PreviewLine label="Titular" value={formatPreviewValue(form.paymentAccountName)} />
          <PreviewLine label="Conta" value={formatPreviewValue(form.paymentAccountNumber)} />
          <PreviewLine label="IBAN" value={formatPreviewValue(form.paymentIban)} />
          <PreviewLine label="País" value={formatPreviewValue(form.country)} />
          <PreviewLine label={regionLabel} value={formatPreviewValue(form.city)} />
          <PreviewLine label="Cor" value={form.color} swatch={form.color} />
        </div>
      </div>
    </div>
  );
}
