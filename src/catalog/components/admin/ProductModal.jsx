import React from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import { FIELD_STYLE, TEXTAREA_STYLE } from "../../constants.js";
import { assetService } from "../../services/assetService.js";
import { createProductDraft } from "../../utils/catalog.js";
import { buildProductImageDataUrl, validateProductImage } from "../../utils/productImages.js";
import { getCurrencySymbol, parseMoney } from "../../utils/format.js";
import FLabel from "../common/FLabel.jsx";
import { CollapsiblePanel, PreviewLine, ToggleTile } from "../common/UiBits.jsx";

const MAX_PRODUCT_IMAGES = 4;

function toImageSlots(images = []) {
  return Array.from({ length: MAX_PRODUCT_IMAGES }, (_, index) => String(images[index] || ""));
}

function createModalForm(product) {
  const draft = createProductDraft(product);
  return {
    ...draft,
    images: toImageSlots(draft.images),
    imageLinks: toImageSlots(draft.images).map((image) => (/^(https?:\/\/|\/)/i.test(image) ? image : "")),
  };
}

export default function ProductModal({ prod, onSave, onClose, color, currencyCode }) {
  const [form, setForm] = React.useState(createModalForm(prod));
  const [error, setError] = React.useState("");
  const [isPreparingImages, setIsPreparingImages] = React.useState(false);
  const [isFormVisible, setIsFormVisible] = React.useState(true);
  const fileInputRefs = React.useRef([]);
  const bulkFileInputRef = React.useRef(null);
  const currencySymbol = getCurrencySymbol(currencyCode);

  React.useEffect(() => {
    setForm(createModalForm(prod));
    setError("");
    setIsPreparingImages(false);
    setIsFormVisible(true);
  }, [prod]);

  function updateImageSlot(index, value) {
    setForm((current) => ({
      ...current,
      images: current.images.map((entry, slotIndex) => (slotIndex === index ? value : entry)),
    }));
  }

  function updateImageLinkSlot(index, value) {
    setForm((current) => ({
      ...current,
      imageLinks: current.imageLinks.map((entry, slotIndex) => (slotIndex === index ? value : entry)),
      images: current.images.map((entry, slotIndex) => (slotIndex === index ? value : entry)),
    }));
  }

  async function handleImageSelect(index, event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsPreparingImages(true);
    try {
      const imageDataUrl = await buildProductImageDataUrl(file);
      const uploaded = await assetService.uploadAsset({
        kind: "product_image",
        dataUrl: imageDataUrl,
        fileName: file.name || `product-image-${index + 1}`,
      });
      const image = uploaded.url;
      setForm((current) => ({
        ...current,
        images: current.images.map((entry, slotIndex) => (slotIndex === index ? image : entry)),
        imageLinks: current.imageLinks.map((entry, slotIndex) => (slotIndex === index ? "" : entry)),
      }));
      setError("");
    } catch (failure) {
      setError(`Imagem ${index + 1}: ${failure.message || "Nao foi possivel carregar a foto."}`);
    } finally {
      setIsPreparingImages(false);
      event.target.value = "";
    }
  }

  async function handleBulkImageSelect(event) {
    const files = Array.from(event.target.files || []).slice(0, MAX_PRODUCT_IMAGES);
    if (!files.length) return;

    setIsPreparingImages(true);
    try {
      const nextImages = [];
      for (const file of files) {
        const imageDataUrl = await buildProductImageDataUrl(file);
        const uploaded = await assetService.uploadAsset({
          kind: "product_image",
          dataUrl: imageDataUrl,
          fileName: file.name || "product-image",
        });
        nextImages.push(uploaded.url);
      }

      setForm((current) => ({
        ...current,
        images: toImageSlots(nextImages),
        imageLinks: toImageSlots([]),
      }));
      setError("");
    } catch (failure) {
      setError(failure.message || "Nao foi possivel carregar as fotos.");
    } finally {
      setIsPreparingImages(false);
      event.target.value = "";
    }
  }

  function save() {
    if (isPreparingImages) {
      setError("Aguarda um momento. As fotos ainda estao a ser preparadas e enviadas antes de guardar.");
      return;
    }

    const name = form.name.trim();
    const price = parseMoney(form.price);
    const compareAt = form.onPromotion ? parseMoney(form.compareAt) : 0;
    const stock = form.stock === "" ? "" : Math.max(0, Math.floor(Number(form.stock) || 0));
    const images = form.images.map((entry) => String(entry || "").trim()).filter(Boolean);

    if (!name) {
      setError("Define um nome para o produto.");
      return;
    }

    if (price <= 0) {
      setError("Indica um preco valido.");
      return;
    }

    if (compareAt > 0 && compareAt <= price) {
      setError("O preco antigo tem de ser maior do que o preco atual.");
      return;
    }

    for (const [index, image] of images.entries()) {
      const validationError = validateProductImage(image);
      if (validationError) {
        setError(`Imagem ${index + 1}: ${validationError}`);
        return;
      }
    }

    setError("");
    onSave({
      ...form,
      name,
      description: form.description.trim(),
      category: form.category.trim(),
      image: images[0] || "",
      images,
      price,
      compareAt,
      stock,
      featured: Boolean(form.featured),
      onPromotion: Boolean(form.onPromotion),
      available: Boolean(form.available),
    });
  }

  const readyImageCount = form.images.map((entry) => String(entry || "").trim()).filter(Boolean).length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
      <div data-testid="product-modal" style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", width: "100%", maxWidth: "620px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ fontSize: "15px", fontWeight: "600" }}>{prod?.id ? "Editar produto" : "Novo produto"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <CollapsiblePanel
            title={prod?.id ? "Formulario do produto" : "Novo produto"}
            description="Podes ocultar os campos e deixar apenas um resumo visivel antes de guardar."
            open={isFormVisible}
            onToggle={() => setIsFormVisible((current) => !current)}
            summary={
              <div style={{ display: "grid", gap: "10px" }}>
                <PreviewLine label="Nome" value={form.name || "Sem nome"} />
                <PreviewLine label="Preco" value={form.price || "Sem preco"} />
                <PreviewLine label="Categoria" value={form.category || "Sem categoria"} />
                <PreviewLine label="Stock" value={String(form.stock || "Livre")} />
                <PreviewLine label="Fotos prontas" value={`${readyImageCount}/4`} />
                <PreviewLine label="Estado" value={form.available ? "Disponivel" : "Indisponivel"} />
              </div>
            }
            style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}
            bodyStyle={{ gap: "14px" }}
          >
            <FLabel label="Nome do produto *">
              <input data-testid="product-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex: Camiseta Basica" style={FIELD_STYLE} />
            </FLabel>

            <FLabel label="Descricao">
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Cor, tamanho, material..." rows={3} style={TEXTAREA_STYLE} />
            </FLabel>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <FLabel label={`Preco atual (${currencySymbol}) *`}>
                <input data-testid="product-price" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="29,90" inputMode="decimal" style={FIELD_STYLE} />
              </FLabel>

              <FLabel label={`Preco antigo (${currencySymbol})`} hint={form.onPromotion ? "Opcional. Se preencheres, o desconto aparece no catalogo." : "Ativa promocao abaixo para usar este campo."}>
                <input
                  value={form.compareAt}
                  onChange={(event) => setForm({ ...form, compareAt: event.target.value })}
                  placeholder="39,90"
                  inputMode="decimal"
                  disabled={!form.onPromotion}
                  style={{
                    ...FIELD_STYLE,
                    background: form.onPromotion ? FIELD_STYLE.background : "var(--color-background-secondary)",
                    cursor: form.onPromotion ? "text" : "not-allowed",
                    opacity: form.onPromotion ? 1 : 0.7,
                  }}
                />
              </FLabel>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <FLabel label="Categoria">
                <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Roupas, Calcados..." style={FIELD_STYLE} />
              </FLabel>

              <FLabel label="Stock" hint="Deixa vazio para stock livre">
                <input value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} placeholder="10" type="number" min="0" style={FIELD_STYLE} />
              </FLabel>
            </div>

            <FLabel label="Fotos do produto" hint="Podes adicionar ate 4 imagens. A primeira vira a capa do produto no carrinho e nos pedidos. Se quiseres que a foto possa seguir no WhatsApp como link, usa uma URL publica neste campo em vez de carregar apenas do computador.">
              <div style={{ display: "grid", gap: "12px" }}>
                <div style={{ padding: "10px 12px", borderRadius: "var(--border-radius-md)", background: readyImageCount > 0 ? "rgba(22,163,74,0.08)" : "var(--color-background-secondary)", color: readyImageCount > 0 ? "#166534" : "var(--color-text-secondary)", fontSize: "12px", fontWeight: "700" }}>
                  {isPreparingImages ? "A preparar e enviar fotos..." : `Fotos prontas para guardar: ${readyImageCount}/4`}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleBulkImageSelect}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => bulkFileInputRef.current?.click()}
                    style={{
                      padding: "10px 14px",
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
                    <ImagePlus size={14} /> Carregar 1 a 4 fotos de uma vez
                  </button>
                  {readyImageCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          images: toImageSlots([]),
                          imageLinks: toImageSlots([]),
                        }))
                      }
                      style={{
                        padding: "10px 14px",
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
                      <Trash2 size={14} /> Limpar todas
                    </button>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  Forma mais segura: seleciona logo as 4 fotos de uma vez. O sistema otimiza e envia para storage antes de guardar.
                </div>
                {form.images.map((image, index) => (
                  <div
                    key={`product-image-slot-${index + 1}`}
                    style={{
                      display: "grid",
                      gap: "10px",
                      padding: "12px",
                      borderRadius: "var(--border-radius-lg)",
                      border: "0.5px solid var(--color-border-tertiary)",
                      background: index === 0 ? "rgba(22,163,74,0.04)" : "var(--color-background-primary)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "13px", fontWeight: "700" }}>
                        Imagem {index + 1}{index === 0 ? " - capa" : ""}
                      </div>
                      {image && <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>Preview pronto para guardar</div>}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <input
                        ref={(node) => {
                          fileInputRefs.current[index] = node;
                        }}
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleImageSelect(index, event)}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[index]?.click()}
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
                        <ImagePlus size={14} /> {image ? "Trocar foto do PC" : "Carregar foto do PC"}
                      </button>

                      {image && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              images: current.images.map((entry, slotIndex) => (slotIndex === index ? "" : entry)),
                              imageLinks: current.imageLinks.map((entry, slotIndex) => (slotIndex === index ? "" : entry)),
                            }))
                          }
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
                          <Trash2 size={14} /> Remover
                        </button>
                      )}
                    </div>

                    <input
                      data-testid={index === 0 ? "product-image-link-0" : undefined}
                      value={form.imageLinks[index] || ""}
                      onChange={(event) => {
                        updateImageLinkSlot(index, event.target.value);
                        setError("");
                      }}
                      placeholder="https://cdn.exemplo.com/produto.jpg"
                      style={FIELD_STYLE}
                    />

                    {image ? (
                      <div style={{ display: "grid", gap: "8px" }}>
                        <img
                          key={image}
                          src={image}
                          alt={`Preview ${index + 1}`}
                          style={{ width: "100%", height: "170px", objectFit: "cover", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-tertiary)" }}
                          onError={(event) => {
                            event.target.style.display = "none";
                          }}
                        />
                        <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                          {/^(https?:\/\/|\/)/i.test(image)
                            ? "Imagem com URL publica pronta para catalogo, cloud e mobile."
                            : form.imageLinks[index]
                              ? "Imagem vinda de link publico e partilhavel no pedido do WhatsApp."
                              : "Imagem preparada localmente. Confirma o storage antes de publicar."}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                        Sem imagem nesta posicao. Podes usar link ou carregar direto do teu computador.
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  O sistema aceita link publico ou foto do PC enviada para storage para mostrar varias partes do produto.
                </div>
              </div>
            </FLabel>

            <div style={{ display: "grid", gap: "10px" }}>
              <ToggleTile label="Produto disponivel" description="Desativa para esconder a compra sem apagar o item." checked={form.available} onChange={(checked) => setForm({ ...form, available: checked })} />
              <ToggleTile
                label="Produto em promocao"
                description="Mostra selo de promocao. Se quiseres, informa o preco antigo acima para exibir o desconto."
                checked={form.onPromotion}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    onPromotion: checked,
                    compareAt: checked ? current.compareAt : "",
                  }))
                }
              />
              <ToggleTile label="Marcar como destaque" description="Aparece com selo especial e pode ser filtrado no catalogo." checked={form.featured} onChange={(checked) => setForm({ ...form, featured: checked })} />
            </div>
          </CollapsiblePanel>

          {error && <div style={{ padding: "10px 12px", borderRadius: "var(--border-radius-md)", background: "#fee2e2", color: "#b91c1c", fontSize: "12px", fontWeight: "600" }}>{error}</div>}
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", gap: "8px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", background: "transparent", cursor: "pointer", fontSize: "14px" }}>
            Cancelar
          </button>

          <button
            data-testid="product-save"
            onClick={save}
            disabled={isPreparingImages}
            style={{ flex: 1, padding: "10px", background: isPreparingImages ? "var(--color-border-tertiary)" : color, color: "white", border: "none", borderRadius: "var(--border-radius-md)", cursor: isPreparingImages ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: "600" }}
          >
            {isPreparingImages ? "A preparar e enviar fotos..." : prod?.id ? "Guardar alteracoes" : "Adicionar produto"}
          </button>
        </div>
      </div>
    </div>
  );
}
