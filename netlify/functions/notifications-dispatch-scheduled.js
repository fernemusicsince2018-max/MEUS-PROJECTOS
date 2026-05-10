import { getNotificationDispatchSecret } from "./_notification-jobs.js";
import { handler as notificationsDispatchHandler } from "./notifications-dispatch.js";

function parseJsonSafely(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

async function readSchedulePayload(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

export default async function notificationsDispatchScheduled(request) {
  const payload = await readSchedulePayload(request);
  const dispatchSecret = getNotificationDispatchSecret();

  if (!dispatchSecret) {
    throw new Error(
      "NOTIFICATION_DISPATCH_SECRET precisa de estar configurado para o agendamento do envio automatico.",
    );
  }

  const result = await notificationsDispatchHandler({
    httpMethod: "POST",
    headers: {
      authorization: `Bearer ${dispatchSecret}`,
      host: "internal.netlify",
      "x-scheduled-function": "notifications-dispatch-scheduled",
    },
    queryStringParameters: {},
    path: "/api/notifications-dispatch",
    rawUrl: "https://internal.netlify/api/notifications-dispatch",
    body: JSON.stringify({
      scheduled: true,
      nextRun: payload?.next_run || "",
    }),
    isBase64Encoded: false,
  });

  const responsePayload = parseJsonSafely(result?.body);

  if ((result?.statusCode || 500) >= 400) {
    throw new Error(
      responsePayload?.error
      || `Falha no envio automatico agendado com status ${result?.statusCode || 500}.`,
    );
  }

  console.log(
    JSON.stringify({
      source: "notifications-dispatch-scheduled",
      nextRun: payload?.next_run || "",
      statusCode: result?.statusCode || 200,
      summary: responsePayload || {},
    }),
  );

  return new Response(null, {
    status: 200,
  });
}
