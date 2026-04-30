import { handler as notificationsDispatchHandler } from "../netlify/functions/notifications-dispatch.js";

function cleanText(value) {
  return String(value || "").trim();
}

async function main() {
  const dispatchSecret = cleanText(
    process.env.NOTIFICATION_DISPATCH_SECRET
    || process.env.INTERNAL_QUEUE_SECRET
    || process.env.CRON_SECRET,
  );

  if (!dispatchSecret) {
    throw new Error(
      "NOTIFICATION_DISPATCH_SECRET precisa de estar configurado para correr o dispatcher por cron.",
    );
  }

  const batchSize = cleanText(process.env.NOTIFICATION_JOB_BATCH_SIZE);
  const result = await notificationsDispatchHandler({
    httpMethod: "POST",
    headers: {
      authorization: `Bearer ${dispatchSecret}`,
      host: "127.0.0.1",
      "x-cron-runner": "node-script",
    },
    queryStringParameters: batchSize ? { batchSize } : {},
    path: "/api/notifications-dispatch",
    rawUrl: "http://127.0.0.1/api/notifications-dispatch",
    body: JSON.stringify({
      scheduled: true,
      source: "cron",
    }),
    isBase64Encoded: false,
  });

  const statusCode = Number(result?.statusCode || 500);
  const bodyText = String(result?.body || "");

  if (statusCode >= 400) {
    console.error(bodyText || `Falha no dispatcher com status ${statusCode}.`);
    process.exitCode = 1;
    return;
  }

  console.log(bodyText || JSON.stringify({ ok: true, statusCode }));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
