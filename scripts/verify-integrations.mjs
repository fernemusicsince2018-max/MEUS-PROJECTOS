import { randomUUID } from "node:crypto";
import { loadLocalEnv } from "./loadEnv.mjs";

loadLocalEnv();

const TEST_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=";

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || "");
    if (!current.startsWith("--")) continue;

    const [rawKey, inlineValue] = current.slice(2).split("=", 2);
    const key = rawKey.trim();
    if (!key) continue;

    if (inlineValue != null) {
      parsed[key] = inlineValue;
      continue;
    }

    const next = String(argv[index + 1] || "");
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
      continue;
    }

    parsed[key] = true;
  }

  return parsed;
}

function printUsage() {
  console.log("Uso:");
  console.log("  npm run verify:integrations -- [opcoes]");
  console.log("");
  console.log("Opcoes:");
  console.log("  --email-to <email>       Envia um email real de teste via Resend.");
  console.log("  --whatsapp-to <numero>   Envia uma notificacao real de teste via WhatsApp Cloud.");
  console.log("  --skip-email             Ignora a verificacao de email.");
  console.log("  --skip-whatsapp          Ignora a verificacao de WhatsApp.");
  console.log("  --skip-storage           Ignora a verificacao de storage.");
  console.log("  --help                   Mostra esta ajuda.");
  console.log("");
  console.log("Exemplo:");
  console.log("  npm run verify:integrations -- --email-to qa@dominio.com --whatsapp-to 244923000000");
}

function buildBaseUrl() {
  return cleanText(process.env.APP_BASE_URL) || "http://127.0.0.1:5173";
}

function createSyntheticEvent(baseUrl = buildBaseUrl()) {
  try {
    const url = new URL(baseUrl);
    return {
      headers: {
        host: url.host,
        "x-forwarded-host": url.host,
        "x-forwarded-proto": url.protocol.replace(":", ""),
      },
    };
  } catch (error) {
    return {
      headers: {
        host: "127.0.0.1:5173",
        "x-forwarded-host": "127.0.0.1:5173",
        "x-forwarded-proto": "http",
      },
    };
  }
}

function createResult(id, title, options = {}) {
  return {
    id,
    title,
    ok: Boolean(options.ok),
    skipped: Boolean(options.skipped),
    details: options.details || "",
    warnings: Array.isArray(options.warnings) ? options.warnings : [],
  };
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensurePublicAssetReachable(url) {
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }

      lastError = new Error(`Storage respondeu ${response.status} ao abrir o asset publico.`);
    } catch (error) {
      lastError = error;
    }

    await wait(600);
  }

  throw lastError || new Error("Nao foi possivel confirmar o asset publico.");
}

async function verifyPasswordResetEmail({ toEmail }) {
  const { isEmailDeliveryConfigured, sendPasswordResetEmail } = await import("../netlify/functions/_email.js");
  const resendConfigured = isEmailDeliveryConfigured();

  if (!resendConfigured) {
    return createResult("email", "Reset de senha por email", {
      ok: false,
      details: "Faltam RESEND_API_KEY e/ou PASSWORD_RESET_FROM_EMAIL para envio real pelo Resend.",
    });
  }

  if (!cleanText(toEmail)) {
    return createResult("email", "Reset de senha por email", {
      ok: true,
      skipped: true,
      details: "Configurado. Nenhum --email-to foi fornecido, por isso o envio real nao foi disparado.",
    });
  }

  const resetLink = `${buildBaseUrl().replace(/\/$/, "")}/?reset_email=${encodeURIComponent(cleanText(toEmail))}&reset_token=${encodeURIComponent(`manual-${randomUUID()}`)}`;
  await sendPasswordResetEmail({
    event: createSyntheticEvent(),
    toEmail: cleanText(toEmail),
    resetLink,
  });

  return createResult("email", "Reset de senha por email", {
    ok: true,
    details: `Email real de teste enviado para ${cleanText(toEmail)}.`,
  });
}

async function verifyWhatsAppCloud({ to }) {
  const { sendMerchantOrderWhatsAppNotification } = await import("../netlify/functions/_whatsapp.js");
  const token = cleanText(process.env.WHATSAPP_CLOUD_API_TOKEN);
  const phoneNumberId = cleanText(process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID);

  if (!token || !phoneNumberId) {
    return createResult("whatsapp", "WhatsApp Cloud API", {
      ok: false,
      details: "Faltam WHATSAPP_CLOUD_API_TOKEN e/ou WHATSAPP_CLOUD_PHONE_NUMBER_ID para envio real.",
    });
  }

  const recipient = normalizeDigits(to);
  if (!recipient) {
    return createResult("whatsapp", "WhatsApp Cloud API", {
      ok: true,
      skipped: true,
      details: "Configurado. Nenhum --whatsapp-to foi fornecido, por isso o envio real nao foi disparado.",
    });
  }

  const nowIso = new Date().toISOString();
  const notification = await sendMerchantOrderWhatsAppNotification({
    event: createSyntheticEvent(),
    store: {
      name: "Loja de teste",
      whatsapp: recipient,
      pickup_note: "Entrega de teste",
      currency_code: "AOA",
    },
    order: {
      trackingCode: `TST-${Date.now().toString().slice(-6)}`,
      trackingToken: randomUUID(),
      customerName: "Cliente QA",
      customerPhone: recipient,
      fulfillmentType: "delivery",
      region: "Luanda",
      area: "Maianga",
      notes: "Verificacao manual da Cloud API.",
      totalAmount: 1500,
      subtotalAmount: 1500,
      discountPercent: 0,
      discountAmount: 0,
      currencyCode: "AOA",
      itemCount: 1,
      createdAt: nowIso,
      statusUpdatedAt: nowIso,
    },
    items: [
      {
        productName: "Produto de teste",
        productImage: TEST_IMAGE_DATA_URL,
        quantity: 1,
        unitPrice: 1500,
        lineTotal: 1500,
      },
    ],
  });

  if (!notification.delivered) {
    throw new Error(
      notification.error
      || "O teste nao conseguiu confirmar entrega no WhatsApp Cloud.",
    );
  }

  return createResult("whatsapp", "WhatsApp Cloud API", {
    ok: true,
    details: `${notification.messageCount} mensagem(ns) enviada(s) com sucesso para ${recipient}.`,
    warnings: notification.warnings,
  });
}

async function verifyStorageUpload() {
  const { uploadPublicImageAsset } = await import("../netlify/functions/_storage.js");
  const supabaseUrl = cleanText(process.env.SUPABASE_URL);
  const serviceRoleKey = cleanText(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    return createResult("storage", "Storage/CDN de imagens", {
      ok: false,
      details: "Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY para upload real.",
    });
  }

  const upload = await uploadPublicImageAsset({
    dataUrl: TEST_IMAGE_DATA_URL,
    scope: "integration-checks",
    ownerId: "manual-verification",
    fileName: `smoke-${Date.now()}.png`,
  });

  await ensurePublicAssetReachable(upload.publicUrl);

  return createResult("storage", "Storage/CDN de imagens", {
    ok: true,
    details: `Upload confirmado com URL publica: ${upload.publicUrl}`,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const checks = [];
  if (!args["skip-email"]) {
    checks.push(() => verifyPasswordResetEmail({ toEmail: args["email-to"] || process.env.INTEGRATION_TEST_EMAIL_TO }));
  }
  if (!args["skip-whatsapp"]) {
    checks.push(() => verifyWhatsAppCloud({ to: args["whatsapp-to"] || process.env.WHATSAPP_TEST_TO }));
  }
  if (!args["skip-storage"]) {
    checks.push(() => verifyStorageUpload());
  }

  if (!checks.length) {
    console.log("Nenhuma verificacao selecionada.");
    printUsage();
    process.exitCode = 1;
    return;
  }

  const results = [];

  console.log("Verificacao operacional das integracoes");

  for (const runCheck of checks) {
    try {
      const result = await runCheck();
      results.push(result);
      console.log(`- ${result.title}: ${result.skipped ? "IGNORADO" : result.ok ? "OK" : "FALHOU"}`);
      if (result.details) {
        console.log(`  ${result.details}`);
      }
      for (const warning of result.warnings) {
        console.log(`  Aviso: ${warning}`);
      }
    } catch (error) {
      const failedResult = createResult("runtime", "Verificacao", {
        ok: false,
        details: error.message || String(error),
      });
      results.push(failedResult);
      console.log(`- Verificacao: FALHOU`);
      console.log(`  ${failedResult.details}`);
    }
  }

  const hasFailure = results.some((result) => !result.ok && !result.skipped);
  console.log("");
  console.log(`Resumo final: ${hasFailure ? "PENDENTE" : "OK"}`);
  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Falha ao verificar as integracoes.");
  console.error(error.message || error);
  process.exitCode = 1;
});
