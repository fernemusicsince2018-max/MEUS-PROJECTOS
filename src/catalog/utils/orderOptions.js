import { normalizeCustomerPhone } from "./orders.js";
import { ANGOLA_AREA_SUGGESTIONS, ANGOLA_PROVINCES } from "./angolaRegions.js";

export const FULFILLMENT_OPTIONS = [
  { value: "delivery", label: "Entrega" },
  { value: "pickup", label: "Retirada na loja" },
];

export const ORDER_TIME_OPTIONS = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
];

export function getAreaSuggestionsByProvince(province) {
  return ANGOLA_AREA_SUGGESTIONS[String(province || "").trim()] || [];
}

export function getFulfillmentLabel(value) {
  if (value === "delivery") return "Entrega";
  if (value === "pickup") return "Retirada na loja";
  return "";
}

export function getOrderValidationError(orderMeta = {}, regionLabel = "Provincia") {
  const customerPhone = normalizeCustomerPhone(orderMeta.customerPhone);
  const fulfillmentType = String(orderMeta.fulfillmentType || "").trim();
  const province = String(orderMeta.province || "").trim();
  const area = String(orderMeta.area || "").trim();
  const pickupTime = String(orderMeta.pickupTime || "").trim();
  const deliveryTime = String(orderMeta.deliveryTime || "").trim();
  const normalizedRegionLabel = String(regionLabel || "Provincia").trim().toLowerCase();

  if (!customerPhone) {
    return "Indica o telefone ou WhatsApp do cliente.";
  }

  if (customerPhone.length < 8) {
    return "Indica um telefone ou WhatsApp valido do cliente.";
  }

  if (!fulfillmentType) {
    return "Seleciona se o pedido sera para entrega ou retirada.";
  }

  if (!province) {
    return `Seleciona ${normalizedRegionLabel} do pedido.`;
  }

  if (!area) {
    return "Indica a area, municipio ou bairro do pedido.";
  }

  if (fulfillmentType === "pickup" && !pickupTime) {
    return "Seleciona o horario preferido para a retirada.";
  }

  if (fulfillmentType === "delivery" && !deliveryTime) {
    return "Seleciona o horario preferido para a entrega.";
  }

  return "";
}
