import assert from "node:assert/strict";
import {
  computeNotificationJobRetryDelaySeconds,
  createQueuedMerchantNotificationResult,
  isNotificationDispatchAuthorized,
  normalizeNotificationJobBatchSize,
} from "../netlify/functions/_notification-jobs.js";
import notificationsDispatchScheduled from "../netlify/functions/notifications-dispatch-scheduled.js";

export async function runNotificationJobsTests() {
  assert.equal(computeNotificationJobRetryDelaySeconds(1), 15);
  assert.equal(computeNotificationJobRetryDelaySeconds(2), 30);
  assert.equal(computeNotificationJobRetryDelaySeconds(10), 900);
  assert.equal(normalizeNotificationJobBatchSize(999), 100);
  assert.equal(normalizeNotificationJobBatchSize("abc", 20), 20);

  assert.deepEqual(createQueuedMerchantNotificationResult({ trackingUrl: "https://example.com/t/abc" }), {
    channel: "whatsapp_cloud_api",
    attempted: false,
    delivered: false,
    queued: true,
    usedTemplate: false,
    mode: "async_outbox",
    messageCount: 0,
    trackingUrl: "https://example.com/t/abc",
    warnings: [],
    error: "",
  });

  const previousSecret = process.env.NOTIFICATION_DISPATCH_SECRET;
  const previousInternalQueueSecret = process.env.INTERNAL_QUEUE_SECRET;
  const previousCronSecret = process.env.CRON_SECRET;

  try {
    process.env.NOTIFICATION_DISPATCH_SECRET = "dispatch-secret";
    assert.equal(
      isNotificationDispatchAuthorized({
        headers: {
          authorization: "Bearer dispatch-secret",
        },
      }),
      true,
    );
    assert.equal(
      isNotificationDispatchAuthorized({
        headers: {
          authorization: "Bearer wrong-secret",
        },
      }),
      false,
    );

    delete process.env.NOTIFICATION_DISPATCH_SECRET;
    delete process.env.INTERNAL_QUEUE_SECRET;
    delete process.env.CRON_SECRET;

    await assert.rejects(
      () =>
        notificationsDispatchScheduled(
          new Request("http://127.0.0.1/api/notifications-dispatch-scheduled", {
            method: "POST",
            body: JSON.stringify({ next_run: "2026-04-27T21:30:00.000Z" }),
            headers: {
              "content-type": "application/json",
            },
          }),
        ),
      /NOTIFICATION_DISPATCH_SECRET/i,
    );
  } finally {
    if (previousSecret == null) {
      delete process.env.NOTIFICATION_DISPATCH_SECRET;
    } else {
      process.env.NOTIFICATION_DISPATCH_SECRET = previousSecret;
    }

    if (previousInternalQueueSecret == null) {
      delete process.env.INTERNAL_QUEUE_SECRET;
    } else {
      process.env.INTERNAL_QUEUE_SECRET = previousInternalQueueSecret;
    }

    if (previousCronSecret == null) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousCronSecret;
    }
  }
}
