import { randomUUID } from "node:crypto";

const DEFAULT_MAX_ATTEMPTS = 8;
const MAX_BATCH_SIZE = 100;
const STALE_PROCESSING_LOCK_SECONDS = 300;

function cleanText(value, maxLength = 4000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function parsePositiveInteger(value, fallback, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.floor(numeric);
  if (rounded < minimum) return fallback;
  return Math.min(maximum, rounded);
}

function readHeader(event, name) {
  const expected = String(name || "").toLowerCase();
  for (const [key, value] of Object.entries(event?.headers || {})) {
    if (String(key || "").toLowerCase() === expected) {
      return Array.isArray(value) ? String(value[0] || "") : String(value || "");
    }
  }
  return "";
}

function getNotificationDispatchSecret() {
  return cleanText(
    process.env.NOTIFICATION_DISPATCH_SECRET
    || process.env.INTERNAL_QUEUE_SECRET
    || process.env.CRON_SECRET,
    200,
  );
}

function isLocalDispatchRequest(event) {
  const host = readHeader(event, "host").toLowerCase();
  return host.includes("localhost") || host.includes("127.0.0.1");
}

function isNotificationDispatchAuthorized(event) {
  const configuredSecret = getNotificationDispatchSecret();
  if (!configuredSecret) {
    return isLocalDispatchRequest(event);
  }

  const bearerHeader = readHeader(event, "authorization");
  const bearerToken = bearerHeader.toLowerCase().startsWith("bearer ")
    ? bearerHeader.slice(7).trim()
    : "";
  const directSecret = cleanText(
    readHeader(event, "x-notification-dispatch-secret")
    || readHeader(event, "x-cron-secret"),
    200,
  );

  return bearerToken === configuredSecret || directSecret === configuredSecret;
}

function computeNotificationJobRetryDelaySeconds(attemptCount) {
  const safeAttemptCount = Math.max(1, parsePositiveInteger(attemptCount, 1));
  return Math.min(15 * (2 ** Math.max(0, safeAttemptCount - 1)), 15 * 60);
}

function parseJsonBody(event) {
  if (!event?.body) return {};

  try {
    return JSON.parse(event.body);
  } catch (error) {
    return {};
  }
}

function normalizeNotificationJobBatchSize(value, fallback = 20) {
  return parsePositiveInteger(value, fallback, 1, MAX_BATCH_SIZE);
}

function createQueuedMerchantNotificationResult(options = {}) {
  return {
    channel: "whatsapp_cloud_api",
    attempted: false,
    delivered: false,
    queued: true,
    usedTemplate: false,
    mode: "async_outbox",
    messageCount: 0,
    trackingUrl: cleanText(options.trackingUrl, 2048),
    warnings: [],
    error: "",
  };
}

async function enqueueNotificationJob(queryable, job = {}) {
  const type = cleanText(job.type, 64);
  if (!type) {
    throw new Error("O tipo do job de notificacao e obrigatorio.");
  }

  const payload =
    job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
      ? job.payload
      : {};

  const maxAttempts = parsePositiveInteger(job.maxAttempts, DEFAULT_MAX_ATTEMPTS, 1, 50);

  const result = await queryable.query(
    `insert into catalog_notification_jobs (
       id,
       type,
       status,
       payload,
       attempt_count,
       max_attempts,
       available_at
     ) values (
       $1,
       $2,
       'pending',
       $3::jsonb,
       0,
       $4,
       coalesce($5::timestamptz, now())
     )
     returning *`,
    [
      cleanText(job.id, 120) || randomUUID(),
      type,
      JSON.stringify(payload),
      maxAttempts,
      job.availableAt || null,
    ],
  );

  return result.rows[0] || null;
}

async function claimNotificationJobs(pool, options = {}) {
  const connection = await pool.connect();

  try {
    await connection.query("begin");
    const types = Array.isArray(options.types)
      ? options.types.map((entry) => cleanText(entry, 64)).filter(Boolean)
      : [];
    if (!types.length) {
      await connection.query("commit");
      return [];
    }

    const batchSize = normalizeNotificationJobBatchSize(
      options.batchSize,
      parsePositiveInteger(process.env.NOTIFICATION_JOB_BATCH_SIZE, 20, 1, MAX_BATCH_SIZE),
    );
    const workerId = cleanText(options.workerId, 120) || randomUUID();
    const staleLockSeconds = parsePositiveInteger(
      options.staleLockSeconds,
      STALE_PROCESSING_LOCK_SECONDS,
      30,
      3600,
    );

    const result = await connection.query(
      `with candidates as (
         select id
         from catalog_notification_jobs
         where type = any($1::text[])
           and (
             (
               status in ('pending', 'failed')
               and available_at <= now()
             )
             or (
               status = 'processing'
               and locked_at is not null
               and locked_at <= now() - ($4::int * interval '1 second')
             )
           )
           and attempt_count < max_attempts
         order by available_at asc, created_at asc
         limit $2
         for update skip locked
       )
       update catalog_notification_jobs jobs
       set status = 'processing',
           attempt_count = jobs.attempt_count + 1,
           locked_at = now(),
           locked_by = $3,
           last_error = '',
           updated_at = now()
       from candidates
       where jobs.id = candidates.id
       returning jobs.*`,
      [types, batchSize, workerId, staleLockSeconds],
    );

    await connection.query("commit");
    return result.rows;
  } catch (error) {
    await connection.query("rollback").catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function markNotificationJobCompleted(queryable, jobId, resultPayload = {}) {
  await queryable.query(
    `update catalog_notification_jobs
     set status = 'completed',
         completed_at = now(),
         locked_at = null,
         locked_by = '',
         last_error = '',
         last_result = $2::jsonb,
         updated_at = now()
     where id = $1`,
    [cleanText(jobId, 120), JSON.stringify(resultPayload || {})],
  );
}

async function markNotificationJobFailed(queryable, job, error, options = {}) {
  const attemptCount = Number(job?.attempt_count || 0);
  const maxAttempts = Number(job?.max_attempts || DEFAULT_MAX_ATTEMPTS);
  const terminal = attemptCount >= maxAttempts || Boolean(options.terminal);
  const retryDelaySeconds = computeNotificationJobRetryDelaySeconds(attemptCount);

  await queryable.query(
    `update catalog_notification_jobs
     set status = $2,
         available_at = case
           when $2 = 'failed' then now() + ($3::int * interval '1 second')
           else now()
         end,
         locked_at = null,
         locked_by = '',
         completed_at = case when $2 = 'dead' then now() else completed_at end,
         last_error = $4,
         last_result = $5::jsonb,
         updated_at = now()
     where id = $1`,
    [
      cleanText(job?.id, 120),
      terminal ? "dead" : "failed",
      retryDelaySeconds,
      cleanText(error?.message || error || "Falha desconhecida ao processar o job.", 4000),
      JSON.stringify(options.resultPayload || {}),
    ],
  );
}

export {
  claimNotificationJobs,
  computeNotificationJobRetryDelaySeconds,
  createQueuedMerchantNotificationResult,
  enqueueNotificationJob,
  getNotificationDispatchSecret,
  isNotificationDispatchAuthorized,
  markNotificationJobCompleted,
  markNotificationJobFailed,
  normalizeNotificationJobBatchSize,
  parseJsonBody,
  readHeader,
};
