import {
  claimNotificationJobs,
  isNotificationDispatchAuthorized,
  markNotificationJobCompleted,
  markNotificationJobFailed,
  normalizeNotificationJobBatchSize,
  parseJsonBody,
} from "./_notification-jobs.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import { sendMerchantOrderWhatsAppNotification } from "./_whatsapp.js";

const MERCHANT_ORDER_WHATSAPP_JOB = "merchant_order_whatsapp";

function shouldRetryMerchantNotification(errorMessage = "") {
  const normalized = String(errorMessage || "").trim().toLowerCase();
  if (!normalized) return true;

  if (normalized.includes("numero de whatsapp valido")) return false;
  if (normalized.includes("loja nao tem um numero")) return false;
  if (normalized.includes("nao configurado")) return false;
  return true;
}

function normalizeJobPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const store = payload.store && typeof payload.store === "object" ? payload.store : null;
  const order = payload.order && typeof payload.order === "object" ? payload.order : null;
  const items = Array.isArray(payload.items) ? payload.items : [];
  const appBaseUrl = String(payload.appBaseUrl || "").trim();

  if (!store || !order) {
    return null;
  }

  return {
    appBaseUrl,
    store,
    order,
    items,
  };
}

async function handle(event) {
  if (!isNotificationDispatchAuthorized(event)) {
    return jsonResponse(401, { error: "Nao autorizado para processar a fila." });
  }

  try {
    await ensureDatabaseReady();
    const pool = getPool();
    const body = parseJsonBody(event);
    const requestedBatchSize =
      body.batchSize
      ?? event.queryStringParameters?.batchSize
      ?? process.env.NOTIFICATION_JOB_BATCH_SIZE;
    const batchSize = normalizeNotificationJobBatchSize(requestedBatchSize, 20);
    const jobs = await claimNotificationJobs(pool, {
      types: [MERCHANT_ORDER_WHATSAPP_JOB],
      batchSize,
      workerId: process.env.POSTGRES_APPLICATION_NAME || "kastrozap-dispatcher",
    });

    let completed = 0;
    let failed = 0;
    let dead = 0;
    const errors = [];

    for (const job of jobs) {
      const payload = normalizeJobPayload(job.payload);
      if (!payload) {
        await markNotificationJobFailed(pool, job, new Error("Payload invalido para notificacao de pedido."), {
          terminal: true,
        });
        dead += 1;
        continue;
      }

      try {
        const result = await sendMerchantOrderWhatsAppNotification({
          appBaseUrl: payload.appBaseUrl,
          store: payload.store,
          order: payload.order,
          items: payload.items,
        });

        if (result?.delivered) {
          await markNotificationJobCompleted(pool, job.id, result);
          completed += 1;
          continue;
        }

        const terminal = !shouldRetryMerchantNotification(result?.error);
        await markNotificationJobFailed(
          pool,
          job,
          new Error(result?.error || "A notificacao nao foi entregue."),
          {
            terminal,
            resultPayload: result || {},
          },
        );
        if (terminal) {
          dead += 1;
        } else {
          failed += 1;
        }
      } catch (error) {
        const terminal = !shouldRetryMerchantNotification(error?.message || "");
        await markNotificationJobFailed(pool, job, error, { terminal });
        if (terminal) {
          dead += 1;
        } else {
          failed += 1;
        }
        errors.push({
          jobId: job.id,
          message: error?.message || "Falha desconhecida.",
        });
      }
    }

    return jsonResponse(200, {
      ok: true,
      claimed: jobs.length,
      completed,
      failed,
      dead,
      errors,
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
