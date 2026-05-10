const GRAPH_API_BASE_URL = "https://graph.facebook.com";
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

function getHeader(event, name) {
  const headers = event?.headers || {};
  const expected = String(name || "").toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === expected) {
      return String(value || "");
    }
  }

  return "";
}

function normalizeAppBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function getAppBaseUrl(event, explicitBaseUrl = "") {
  const explicit = normalizeAppBaseUrl(explicitBaseUrl);
  if (explicit) {
    return explicit;
  }

  const configured = normalizeAppBaseUrl(
    process.env.APP_BASE_URL
    || process.env.PUBLIC_APP_URL
    || process.env.SITE_URL
    || process.env.URL,
  );

  if (configured) {
    return configured;
  }

  const forwardedProto = getHeader(event, "x-forwarded-proto");
  const host = getHeader(event, "x-forwarded-host") || getHeader(event, "host");
  const protocol = forwardedProto || (String(host).includes("localhost") || String(host).includes("127.0.0.1") ? "http" : "https");

  if (!host) {
    return "";
  }

  return normalizeAppBaseUrl(`${protocol}://${host}`);
}

function cleanText(value, maxLength = null) {
  const text = String(value ?? "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeMimeType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  return SUPPORTED_IMAGE_MIME_TYPES.has(normalized) ? normalized : "";
}

function inferMimeTypeFromPath(value) {
  const text = String(value || "").toLowerCase();
  if (text.endsWith(".jpg") || text.endsWith(".jpeg")) return "image/jpeg";
  if (text.endsWith(".png")) return "image/png";
  return "";
}

function getFileExtension(mimeType) {
  return mimeType === "image/png" ? "png" : "jpg";
}

function buildImageFileName(value, mimeType) {
  const fallback = `catalog-order-image.${getFileExtension(mimeType)}`;

  try {
    const url = new URL(String(value || ""));
    const candidate = url.pathname.split("/").filter(Boolean).pop() || "";
    const cleaned = candidate.replace(/[^a-zA-Z0-9._-]/g, "");
    if (cleaned) return cleaned;
  } catch (error) {}

  return fallback;
}

function formatMoney(value, currencyCode = "AOA") {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: currencyCode || "AOA",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    return `${amount.toFixed(2)} ${currencyCode || "AOA"}`;
  }
}

function formatDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  try {
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  } catch (error) {
    return date.toISOString().slice(0, 10);
  }
}

function getFulfillmentLabel(value) {
  return String(value || "").trim().toLowerCase() === "pickup" ? "Retirada na loja" : "Entrega";
}

function buildTrackingUrlFromBaseUrl(baseUrl, trackingToken) {
  if (!trackingToken) return "";
  const normalizedBaseUrl = normalizeAppBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return "";

  try {
    const url = new URL(normalizedBaseUrl);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/tracking/${encodeURIComponent(trackingToken)}`;
    url.hash = "";
    return url.toString();
  } catch (error) {
    return `${normalizedBaseUrl}/tracking/${encodeURIComponent(trackingToken)}`;
  }
}

function buildTrackingUrl(event, trackingToken, explicitBaseUrl = "") {
  return buildTrackingUrlFromBaseUrl(getAppBaseUrl(event, explicitBaseUrl), trackingToken);
}

function resolveAbsoluteImageUrl(value, event, explicitBaseUrl = "") {
  const image = cleanText(value);
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) return image;

  if (/^\//.test(image)) {
    const baseUrl = getAppBaseUrl(event, explicitBaseUrl);
    if (!baseUrl) return "";
    return new URL(image, `${baseUrl}/`).toString();
  }

  return "";
}

function parseDataUrlImage(value) {
  const match = String(value || "").match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) return null;

  const mimeType = normalizeMimeType(match[1]);
  if (!mimeType) {
    throw new Error("A imagem do produto precisa estar em PNG ou JPG para seguir anexada no WhatsApp.");
  }

  return {
    buffer: Buffer.from(match[2], "base64"),
    mimeType,
    fileName: `catalog-order-image.${getFileExtension(mimeType)}`,
  };
}

async function loadImageBinary(value, event, explicitBaseUrl = "") {
  const image = cleanText(value);
  if (!image) return null;

  const dataUrlResult = parseDataUrlImage(image);
  if (dataUrlResult) return dataUrlResult;

  if (/^data:/i.test(image)) {
    throw new Error("A imagem do produto precisa estar em PNG ou JPG para seguir anexada no WhatsApp.");
  }

  const absoluteUrl = resolveAbsoluteImageUrl(image, event, explicitBaseUrl);
  if (!absoluteUrl) return null;

  const response = await fetch(absoluteUrl);
  if (!response.ok) {
    throw new Error("Nao foi possivel obter a imagem do produto para enviar ao WhatsApp.");
  }

  const headerMimeType = normalizeMimeType(String(response.headers.get("content-type") || "").split(";")[0]);
  const mimeType = headerMimeType || inferMimeTypeFromPath(absoluteUrl);
  if (!mimeType) {
    throw new Error("A imagem do produto precisa estar em PNG ou JPG para seguir anexada no WhatsApp.");
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType,
    fileName: buildImageFileName(absoluteUrl, mimeType),
  };
}

function getWhatsAppCloudConfig() {
  const token = cleanText(process.env.WHATSAPP_CLOUD_API_TOKEN);
  const phoneNumberId = cleanText(process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID);

  return {
    enabled: Boolean(token && phoneNumberId),
    token,
    phoneNumberId,
    version: cleanText(process.env.WHATSAPP_CLOUD_API_VERSION) || "v23.0",
    templateLanguage: cleanText(process.env.WHATSAPP_CLOUD_TEMPLATE_LANGUAGE) || "pt_PT",
    summaryTemplateName: cleanText(process.env.WHATSAPP_CLOUD_ORDER_SUMMARY_TEMPLATE_NAME),
    itemTemplateName: cleanText(process.env.WHATSAPP_CLOUD_ORDER_ITEM_TEMPLATE_NAME),
    planActivationTemplateName: cleanText(process.env.WHATSAPP_CLOUD_PLAN_ACTIVATION_TEMPLATE_NAME),
  };
}

function getMerchantOrderWhatsAppCapability(store) {
  const config = getWhatsAppCloudConfig();
  const recipient = normalizeDigits(store?.whatsapp);

  if (!recipient) {
    return {
      enabled: false,
      recipient: "",
      config,
      error: "A loja nao tem um numero de WhatsApp valido para receber notificacoes.",
    };
  }

  if (!config.enabled) {
    return {
      enabled: false,
      recipient,
      config,
      error: "O envio automatico pelo WhatsApp ainda nao esta configurado.",
    };
  }

  return {
    enabled: true,
    recipient,
    config,
    error: "",
  };
}

async function requestWhatsAppJson(config, path, options = {}, fallbackMessage = "Nao foi possivel comunicar com o WhatsApp.") {
  const response = await fetch(`${GRAPH_API_BASE_URL}/${config.version}${path}`, {
    method: options.method || "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(options.headers || {}),
    },
    body: options.body,
  });

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      (typeof payload === "string" ? payload : "") ||
      fallbackMessage;
    throw new Error(message);
  }

  return payload;
}

async function uploadImageToWhatsApp(config, imageBinary) {
  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append(
    "file",
    new Blob([imageBinary.buffer], { type: imageBinary.mimeType }),
    imageBinary.fileName,
  );

  const payload = await requestWhatsAppJson(
    config,
    `/${config.phoneNumberId}/media`,
    {
      method: "POST",
      body: formData,
    },
    "Falha ao carregar a imagem para o WhatsApp.",
  );

  if (!payload?.id) {
    throw new Error("O WhatsApp nao devolveu o ID da imagem enviada.");
  }

  return payload.id;
}

async function deleteUploadedMedia(config, mediaId) {
  if (!mediaId) return;

  try {
    await requestWhatsAppJson(
      config,
      `/${mediaId}`,
      {
        method: "DELETE",
      },
      "",
    );
  } catch (error) {}
}

async function sendTextMessage(config, to, bodyText) {
  return requestWhatsAppJson(
    config,
    `/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          body: cleanText(bodyText, 4096),
        },
      }),
    },
    "Falha ao enviar o resumo do pedido para o WhatsApp.",
  );
}

async function sendImageMessage(config, to, mediaId, caption) {
  return requestWhatsAppJson(
    config,
    `/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "image",
        image: {
          id: mediaId,
          caption: cleanText(caption, 1024),
        },
      }),
    },
    "Falha ao enviar a imagem do produto para o WhatsApp.",
  );
}

async function sendTemplateMessage(config, to, templateName, bodyParameters = [], extraComponents = []) {
  const components = [];

  if (Array.isArray(extraComponents) && extraComponents.length > 0) {
    components.push(...extraComponents);
  }

  if (bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParameters.map((value) => ({
        type: "text",
        text: String(value ?? ""),
      })),
    });
  }

  return requestWhatsAppJson(
    config,
    `/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: config.templateLanguage,
          },
          components,
        },
      }),
    },
    "Falha ao enviar o template do WhatsApp.",
  );
}

function buildOrderSummaryText({ store, order, items, trackingUrl }) {
  const location = [order?.area, order?.region].filter(Boolean).join(", ");
  const currencyCode = store?.currency_code || order?.currencyCode || "AOA";
  const lines = [
    `Novo pedido - ${store?.name || "Loja"}`,
    `Codigo: ${order?.trackingCode || "-"}`,
  ];

  if (order?.customerName) lines.push(`Cliente: ${order.customerName}`);
  if (order?.customerPhone) lines.push(`Telefone: ${order.customerPhone}`);
  lines.push(`Recebimento: ${getFulfillmentLabel(order?.fulfillmentType)}`);
  if (location) lines.push(`Localidade: ${location}`);
  if (order?.pickupTime) lines.push(`Horario de retirada: ${order.pickupTime}`);
  if (order?.deliveryTime) lines.push(`Horario de entrega: ${order.deliveryTime}`);
  if (store?.pickup_note) lines.push(`Entrega/retirada: ${store.pickup_note}`);
  if (order?.notes) lines.push(`Observacoes: ${order.notes}`);
  if (trackingUrl) lines.push(`Acompanhar: ${trackingUrl}`);

  lines.push("");
  lines.push("Itens:");

  for (const item of items) {
    lines.push(
      `- ${item.quantity}x ${item.productName} | ${formatMoney(item.unitPrice, currencyCode)} | ${formatMoney(item.lineTotal, currencyCode)}`,
    );
  }

  lines.push("");
  if (Number(order?.discountAmount || 0) > 0) {
    lines.push(`Subtotal: ${formatMoney(order?.subtotalAmount, currencyCode)}`);
    lines.push(
      `Desconto fidelidade (${Number(order?.discountPercent || 0).toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%): -${formatMoney(order?.discountAmount, currencyCode)}`,
    );
  }
  lines.push(`Total: ${formatMoney(order?.totalAmount, currencyCode)}`);

  return cleanText(lines.join("\n"), 4096);
}

function buildItemCaption({ order, item, currencyCode, trackingUrl }) {
  const lines = [
    `Pedido ${order?.trackingCode || "-"}`,
    `${item.quantity}x ${item.productName}`,
    `Preco unitario: ${formatMoney(item.unitPrice, currencyCode)}`,
    `Subtotal: ${formatMoney(item.lineTotal, currencyCode)}`,
  ];

  if (trackingUrl) {
    lines.push(`Acompanhar: ${trackingUrl}`);
  }

  return cleanText(lines.join("\n"), 1024);
}

function buildPlanActivationText({ event, store, planName, expiryDate, totalPrice, currencyCode }) {
  const storeName = cleanText(store?.name || "Loja");
  const lines = [
    `O plano ${cleanText(planName || "selecionado")} foi ativado com sucesso.`,
    `Loja: ${storeName}`,
    `Validade: ${formatDateLabel(expiryDate)}`,
    `Valor: ${formatMoney(totalPrice, currencyCode)}`,
  ];
  const panelUrl = getAppBaseUrl(event);
  if (panelUrl) {
    lines.push(`Painel: ${panelUrl}`);
  }
  return cleanText(lines.join("\n"), 4096);
}

async function buildUploadedImageReference(config, event, imageValue, explicitBaseUrl = "") {
  const imageBinary = await loadImageBinary(imageValue, event, explicitBaseUrl);
  if (!imageBinary) return null;

  const mediaId = await uploadImageToWhatsApp(config, imageBinary);
  return {
    mediaId,
    templateParameter: {
      type: "image",
      image: {
        id: mediaId,
      },
    },
  };
}

async function sendTemplateNotifications(config, context, result) {
  const {
    event,
    appBaseUrl,
    store,
    order,
    items,
    recipient,
    trackingUrl,
  } = context;
  const currencyCode = store?.currency_code || order?.currencyCode || "AOA";

  if (config.summaryTemplateName) {
    const location = [order?.area, order?.region].filter(Boolean).join(", ") || "-";
    await sendTemplateMessage(
      config,
      recipient,
      config.summaryTemplateName,
      [
        order?.trackingCode || "-",
        store?.name || "Loja",
        order?.customerName || "Cliente nao identificado",
        getFulfillmentLabel(order?.fulfillmentType),
        location,
        formatMoney(order?.totalAmount, currencyCode),
        trackingUrl || "-",
      ],
    );
    result.messageCount += 1;
  }

  if (!config.itemTemplateName) {
    if (result.messageCount > 0) {
      result.warnings.push("O template com imagem por item nao esta configurado.");
    }
    return;
  }

  for (const item of items) {
    if (!item?.productImage) {
      result.warnings.push(`O item "${item.productName}" ficou sem imagem anexada porque nao tem foto.`);
      continue;
    }

    let uploadedReference = null;
    try {
      uploadedReference = await buildUploadedImageReference(
        config,
        event,
        item.productImage,
        appBaseUrl,
      );
      if (!uploadedReference) {
        result.warnings.push(`Nao foi possivel preparar a imagem do item "${item.productName}".`);
        continue;
      }

      await sendTemplateMessage(
        config,
        recipient,
        config.itemTemplateName,
        [
          order?.trackingCode || "-",
          item.productName || "Produto",
          String(item.quantity || 0),
          formatMoney(item.unitPrice, currencyCode),
          formatMoney(item.lineTotal, currencyCode),
        ],
        [
          {
            type: "header",
            parameters: [uploadedReference.templateParameter],
          },
        ],
      );
      result.messageCount += 1;
    } catch (error) {
      result.warnings.push(`Falha ao enviar a imagem do item "${item.productName}": ${error.message || "erro desconhecido"}.`);
    } finally {
      await deleteUploadedMedia(config, uploadedReference?.mediaId);
    }
  }
}

async function sendSessionNotifications(config, context, result) {
  const {
    event,
    appBaseUrl,
    store,
    order,
    items,
    recipient,
    trackingUrl,
  } = context;
  const currencyCode = store?.currency_code || order?.currencyCode || "AOA";

  await sendTextMessage(config, recipient, buildOrderSummaryText({ store, order, items, trackingUrl }));
  result.messageCount += 1;

  for (const item of items) {
    if (!item?.productImage) {
      continue;
    }

    let uploadedReference = null;
    try {
      uploadedReference = await buildUploadedImageReference(
        config,
        event,
        item.productImage,
        appBaseUrl,
      );
      if (!uploadedReference?.mediaId) continue;

      await sendImageMessage(
        config,
        recipient,
        uploadedReference.mediaId,
        buildItemCaption({ order, item, currencyCode, trackingUrl }),
      );
      result.messageCount += 1;
    } catch (error) {
      result.warnings.push(`Falha ao anexar a imagem do item "${item.productName}": ${error.message || "erro desconhecido"}.`);
    } finally {
      await deleteUploadedMedia(config, uploadedReference?.mediaId);
    }
  }
}

async function sendMerchantOrderWhatsAppNotification({
  event,
  appBaseUrl = "",
  store,
  order,
  items = [],
}) {
  const capability = getMerchantOrderWhatsAppCapability(store);
  const { config, recipient } = capability;
  const trackingUrl = buildTrackingUrl(event, order?.trackingToken, appBaseUrl);
  const result = {
    channel: config.enabled ? "whatsapp_cloud_api" : "none",
    attempted: false,
    delivered: false,
    queued: false,
    usedTemplate: false,
    mode: "none",
    messageCount: 0,
    trackingUrl,
    warnings: [],
    error: "",
  };

  if (!capability.enabled) {
    result.error = capability.error;
    return result;
  }

  result.attempted = true;
  result.usedTemplate = Boolean(config.summaryTemplateName || config.itemTemplateName);
  result.mode = result.usedTemplate ? "template_media" : "session_media";

  try {
    if (result.usedTemplate) {
      await sendTemplateNotifications(
        config,
        {
          event,
          appBaseUrl,
          store,
          order,
          items,
          recipient,
          trackingUrl,
        },
        result,
      );
    } else {
      await sendSessionNotifications(
        config,
        {
          event,
          appBaseUrl,
          store,
          order,
          items,
          recipient,
          trackingUrl,
        },
        result,
      );
    }
  } catch (error) {
    result.error = error.message || "Nao foi possivel entregar a notificacao pelo WhatsApp.";
    return result;
  }

  result.delivered = result.messageCount > 0;
  if (!result.delivered && !result.error) {
    result.error = "O pedido foi criado, mas nenhuma mensagem conseguiu ser enviada pelo WhatsApp.";
  }

  return result;
}

async function sendPlanActivationWhatsAppNotification({ event, store, planName, expiryDate, totalPrice, currencyCode }) {
  const config = getWhatsAppCloudConfig();
  const recipient = normalizeDigits(store?.whatsapp);
  const result = {
    channel: config.enabled ? "whatsapp_cloud_api" : "none",
    attempted: false,
    delivered: false,
    usedTemplate: Boolean(config.planActivationTemplateName),
    mode: config.planActivationTemplateName ? "template" : "text",
    messageCount: 0,
    error: "",
  };

  if (!recipient) {
    result.error = "A loja nao tem um numero de WhatsApp valido para receber a notificacao do plano.";
    return result;
  }

  if (!config.enabled) {
    result.error = "O envio automatico pelo WhatsApp ainda nao esta configurado.";
    return result;
  }

  result.attempted = true;

  try {
    if (config.planActivationTemplateName) {
      await sendTemplateMessage(
        config,
        recipient,
        config.planActivationTemplateName,
        [
          cleanText(store?.name || "Loja", 160),
          cleanText(planName || "Plano", 160),
          formatDateLabel(expiryDate),
          formatMoney(totalPrice, currencyCode),
        ],
      );
    } else {
      await sendTextMessage(
        config,
        recipient,
        buildPlanActivationText({ event, store, planName, expiryDate, totalPrice, currencyCode }),
      );
    }

    result.messageCount = 1;
    result.delivered = true;
    return result;
  } catch (error) {
    result.error = error.message || "Nao foi possivel entregar a notificacao do plano pelo WhatsApp.";
    return result;
  }
}

export {
  buildTrackingUrl,
  buildTrackingUrlFromBaseUrl,
  getAppBaseUrl,
  getMerchantOrderWhatsAppCapability,
  sendMerchantOrderWhatsAppNotification,
  sendPlanActivationWhatsAppNotification,
};
