import React from "react";
import { Minus, Phone, Plus, ShoppingCart, X } from "lucide-react";
import { FIELD_STYLE, TEXTAREA_STYLE } from "../../constants.js";
import { getCanonicalCountry, getCountryRegionLabel, getCountryRegions } from "../../utils/countryRegions.js";
import { getMaxQty } from "../../utils/catalog.js";
import { fmtMoney } from "../../utils/format.js";
import { FULFILLMENT_OPTIONS, ORDER_TIME_OPTIONS, getAreaSuggestionsByProvince, getOrderValidationError } from "../../utils/orderOptions.js";
import FLabel from "../common/FLabel.jsx";
import { CollapsiblePanel, PreviewLine } from "../common/UiBits.jsx";

export default function CartDrawer({ store, cart, total, color, orderMeta, setOrderMeta, onUpd, onCheckout, onClose, checkoutBusy = false }) {
  const [isCheckoutFormVisible, setIsCheckoutFormVisible] = React.useState(true);
  const hasWhatsApp = Boolean(store.whatsapp?.replace(/\D/g, ""));
  const canonicalCountry = getCanonicalCountry(store.country);
  const regionOptions = getCountryRegions(canonicalCountry);
  const regionLabel = regionOptions.length > 0 ? getCountryRegionLabel(canonicalCountry) : "Província / Estado / Região";
  const areaSuggestions = canonicalCountry === "Angola" ? getAreaSuggestionsByProvince(orderMeta.province) : [];
  const orderValidationError = getOrderValidationError(orderMeta, regionLabel);
  const checkoutDisabled = checkoutBusy || !hasWhatsApp || cart.length === 0 || Boolean(orderValidationError);
  const currencyCode = store.currencyCode || "AOA";
  const canSuggestAreas = areaSuggestions.length > 0;
  const normalizedRegionLabel = regionLabel.toLowerCase();
  const areaHint = orderMeta.province
    ? canSuggestAreas
      ? "Podes escolher uma sugestão ou escrever a área exata."
      : "Escreve o município, bairro ou área exata."
    : `Seleciona primeiro ${normalizedRegionLabel}.`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div data-testid="cart-drawer" style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--color-background-primary)", borderRadius: "16px 16px 0 0", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ width: "36px", height: "4px", background: "var(--color-border-tertiary)", borderRadius: "2px", margin: "12px auto 4px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px 14px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ fontSize: "15px", fontWeight: "600", display: "flex", alignItems: "center", gap: "7px" }}>
            <ShoppingCart size={16} /> O teu pedido
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 20px 14px" }}>
          {cart.map((item) => {
            const maxQty = getMaxQty(item);
            const canIncrease = item.qty < maxQty;

            return (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                {item.image && <img src={item.image} alt={item.name} style={{ width: "46px", height: "46px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} onError={(event) => { event.target.style.display = "none"; }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "2px" }}>{item.name}</div>
                  <div style={{ fontSize: "12px", color, fontWeight: "600" }}>{fmtMoney(item.price, currencyCode)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button onClick={() => onUpd(item.id, item.qty - 1)} style={{ width: "28px", height: "28px", borderRadius: "50%", border: `1.5px solid ${color}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color }}>
                    <Minus size={11} />
                  </button>
                  <span style={{ fontSize: "14px", fontWeight: "600", minWidth: "18px", textAlign: "center" }}>{item.qty}</span>
                  <button onClick={() => onUpd(item.id, item.qty + 1)} disabled={!canIncrease} style={{ width: "28px", height: "28px", borderRadius: "50%", border: "none", background: canIncrease ? color : "var(--color-background-secondary)", cursor: canIncrease ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", color: canIncrease ? "white" : "var(--color-text-secondary)" }}>
                    <Plus size={11} />
                  </button>
                </div>
                <div style={{ fontSize: "13px", fontWeight: "600", minWidth: "64px", textAlign: "right" }}>{fmtMoney(item.price * item.qty, currencyCode)}</div>
              </div>
            );
          })}

          <div style={{ marginTop: "14px" }}>
            <CollapsiblePanel
              title="Dados para o pedido"
              description="Preenche os dados do cliente e da entrega. Podes ocultar este formulario e continuar a rever apenas o resumo."
              open={isCheckoutFormVisible}
              onToggle={() => setIsCheckoutFormVisible((current) => !current)}
              summary={
                <div style={{ display: "grid", gap: "10px" }}>
                  {store.pickupNote ? (
                    <div style={{ fontSize: "12px" }}>
                      <strong style={{ color: "var(--color-text-primary)" }}>Entrega ou retirada:</strong> {` ${store.pickupNote}`}
                    </div>
                  ) : null}
                  <PreviewLine label="Cliente" value={orderMeta.customerName || "Sem nome"} />
                  <PreviewLine label="Telefone" value={orderMeta.customerPhone || "Sem telefone"} />
                  <PreviewLine label="Recebimento" value={FULFILLMENT_OPTIONS.find((option) => option.value === orderMeta.fulfillmentType)?.label || "Por definir"} />
                  <PreviewLine label={regionLabel} value={orderMeta.province || "Por definir"} />
                  <PreviewLine label="Área" value={orderMeta.area || "Por definir"} />
                  {orderValidationError ? (
                    <div style={{ color: "#b91c1c", fontWeight: "700" }}>
                      Ainda falta: {orderValidationError}
                    </div>
                  ) : (
                    <div style={{ color: "#166534", fontWeight: "700" }}>
                      Resumo pronto. Podes abrir o formulario outra vez quando quiseres editar.
                    </div>
                  )}
                </div>
              }
              style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}
              bodyStyle={{ gap: "12px" }}
            >
              {store.pickupNote && <div style={{ padding: "12px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", fontSize: "12px", color: "var(--color-text-secondary)" }}><strong style={{ color: "var(--color-text-primary)" }}>Entrega ou retirada:</strong> {store.pickupNote}</div>}

              <FLabel label="Nome do cliente">
                <input data-testid="checkout-customer-name" value={orderMeta.customerName} onChange={(event) => setOrderMeta({ ...orderMeta, customerName: event.target.value })} placeholder="Como te devemos identificar?" style={FIELD_STYLE} />
              </FLabel>

              <FLabel label="Telefone / WhatsApp do cliente" hint="Usado para reconhecer clientes recorrentes e aplicar descontos de fidelidade.">
                <input
                  type="tel"
                  data-testid="checkout-customer-phone"
                  value={orderMeta.customerPhone}
                  onChange={(event) => setOrderMeta({ ...orderMeta, customerPhone: event.target.value })}
                  placeholder="Ex.: 244923000000."
                  style={FIELD_STYLE}
                />
              </FLabel>

              <FLabel label="Como queres receber o pedido?">
                <select
                  data-testid="checkout-fulfillment-type"
                  value={orderMeta.fulfillmentType}
                  onChange={(event) =>
                    setOrderMeta({
                      ...orderMeta,
                      fulfillmentType: event.target.value,
                      pickupTime: event.target.value === "pickup" ? orderMeta.pickupTime : "",
                      deliveryTime: event.target.value === "delivery" ? orderMeta.deliveryTime : "",
                    })
                  }
                  style={FIELD_STYLE}
                >
                  <option value="">Seleciona uma opcao</option>
                  {FULFILLMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FLabel>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <FLabel label={regionLabel}>
                  {regionOptions.length > 0 ? (
                    <select
                      data-testid="checkout-region"
                      value={orderMeta.province}
                      onChange={(event) =>
                        setOrderMeta({
                          ...orderMeta,
                          province: event.target.value,
                          area: "",
                        })
                      }
                      style={FIELD_STYLE}
                    >
                      <option value="">{`Seleciona ${normalizedRegionLabel}`}</option>
                      {regionOptions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      data-testid="checkout-region"
                      value={orderMeta.province}
                      onChange={(event) =>
                        setOrderMeta({
                          ...orderMeta,
                          province: event.target.value,
                        })
                      }
                      placeholder="Ex.: Luanda, Sao Paulo ou Lisboa."
                      style={FIELD_STYLE}
                    />
                  )}
                </FLabel>

                <FLabel label="Área / município / bairro" hint={areaHint}>
                  <div>
                    <input
                      data-testid="checkout-area"
                      list={canSuggestAreas ? "country-area-suggestions" : undefined}
                      value={orderMeta.area}
                      onChange={(event) => setOrderMeta({ ...orderMeta, area: event.target.value })}
                      placeholder="Ex.: Maianga, Catete ou Lobito."
                      style={FIELD_STYLE}
                    />
                    {canSuggestAreas && (
                      <datalist id="country-area-suggestions">
                        {areaSuggestions.map((area) => (
                          <option key={area} value={area} />
                        ))}
                      </datalist>
                    )}
                  </div>
                </FLabel>
              </div>

              {orderMeta.fulfillmentType === "pickup" && (
                <FLabel label="Horario preferido para retirada">
                  <select data-testid="checkout-pickup-time" value={orderMeta.pickupTime} onChange={(event) => setOrderMeta({ ...orderMeta, pickupTime: event.target.value })} style={FIELD_STYLE}>
                    <option value="">Seleciona o horario</option>
                    {ORDER_TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </FLabel>
              )}

              {orderMeta.fulfillmentType === "delivery" && (
                <FLabel label="Horario preferido para entrega">
                  <select data-testid="checkout-delivery-time" value={orderMeta.deliveryTime} onChange={(event) => setOrderMeta({ ...orderMeta, deliveryTime: event.target.value })} style={FIELD_STYLE}>
                    <option value="">Seleciona o horario</option>
                    {ORDER_TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </FLabel>
              )}

              <FLabel label="Observacoes do pedido">
                <textarea value={orderMeta.notes} onChange={(event) => setOrderMeta({ ...orderMeta, notes: event.target.value })} placeholder="Ex.: entregar depois das 18h." rows={3} style={TEXTAREA_STYLE} />
              </FLabel>
            </CollapsiblePanel>
          </div>
        </div>

        <div style={{ padding: "16px 20px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "15px", fontWeight: "600" }}>Total do pedido</span>
            <span style={{ fontSize: "20px", fontWeight: "700", color }}>{fmtMoney(total, currencyCode)}</span>
          </div>

          <button data-testid="checkout-submit" onClick={onCheckout} disabled={checkoutDisabled} style={{ width: "100%", padding: "14px", background: checkoutDisabled ? "var(--color-background-secondary)" : "#25D366", color: checkoutDisabled ? "var(--color-text-secondary)" : "white", border: "none", borderRadius: "var(--border-radius-md)", cursor: checkoutDisabled ? "not-allowed" : "pointer", fontSize: "15px", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <Phone size={17} /> {checkoutBusy ? "A gravar pedido..." : "Enviar pedido pelo WhatsApp"}
          </button>

          {hasWhatsApp && orderValidationError && <div style={{ fontSize: "12px", color: "#dc2626", textAlign: "center", marginTop: "8px" }}>{orderValidationError}</div>}
          {!store.whatsapp && <div style={{ fontSize: "12px", color: "#dc2626", textAlign: "center", marginTop: "8px" }}>Configura o número de WhatsApp no painel admin.</div>}
        </div>
      </div>
    </div>
  );
}
