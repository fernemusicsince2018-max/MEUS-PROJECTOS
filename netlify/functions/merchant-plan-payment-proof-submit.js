import { randomUUID } from "node:crypto";
import { getSessionContext } from "./_auth.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";
import {
  PLAN_REQUEST_RETURNING_SQL,
  PLAN_REQUEST_SELECT_SQL,
  assertPlanPaymentFlowSchema,
  mapPlanRequestsWithProofs,
  parseIsoDateOrNull,
  parseMoneyOrNull,
} from "./_plan-requests.js";
import { uploadPrivateFileAsset } from "./_storage.js";

const MERCHANT_PROOF_SUBMITTABLE_STATUSES = new Set(["pending_payment", "needs_correction"]);

function cleanText(value, maxLength = null) {
  const text = String(value || "").trim();
  return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
}

function cleanDigits(value, maxLength = 32) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
}

async function handle(event) {
  try {
    await ensureDatabaseReady();
    const session = await getSessionContext(event);
    if (!session?.userId || !session?.storeId) {
      return jsonResponse(401, { error: "Precisas de iniciar sessao para enviar o comprovativo." });
    }

    if (session.role === "super_admin") {
      return jsonResponse(403, { error: "Este envio so pode ser feito por contas lojistas." });
    }

    const payload = JSON.parse(event.body || "{}");
    const requestId = cleanText(payload.requestId, 120);
    if (!requestId) {
      return jsonResponse(400, { error: "O pedido do plano e obrigatorio." });
    }

    const payerName = cleanText(payload.payerName, 160);
    const payerPhone = cleanDigits(payload.payerPhone, 32);
    const paymentReferenceText = cleanText(payload.paymentReferenceText, 120);
    const note = cleanText(payload.note, 4000);
    const fileName = cleanText(payload.fileName, 160) || "comprovativo-plano";
    const dataUrl = cleanText(payload.dataUrl);
    const paidAmount = parseMoneyOrNull(payload.paidAmount);
    const paidAt = parseIsoDateOrNull(payload.paidAt);
    const paidCurrencyCode = cleanText(payload.paidCurrencyCode, 3).toUpperCase() || "AOA";

    if (!payerName) {
      return jsonResponse(400, { error: "Indica o nome do pagador." });
    }

    if (!payerPhone) {
      return jsonResponse(400, { error: "Indica o telefone do pagador." });
    }

    if (!dataUrl) {
      return jsonResponse(400, { error: "Anexa o comprovativo em imagem ou PDF." });
    }

    if (paidAmount == null) {
      return jsonResponse(400, { error: "Indica o valor pago." });
    }

    if (!paidAt) {
      return jsonResponse(400, { error: "Indica a data do pagamento." });
    }

    const pool = getPool();
    const connection = await pool.connect();
    let transactionStarted = false;

    try {
      await assertPlanPaymentFlowSchema(connection);

      const requestResult = await connection.query(
        `select
           ${PLAN_REQUEST_SELECT_SQL}
         from public.catalog_plan_activation_requests requests
         where requests.id = $1
           and requests.store_id = $2
           and requests.user_id = $3
         limit 1`,
        [requestId, session.storeId, session.userId],
      );

      const requestRow = requestResult.rows[0];
      if (!requestRow) {
        return jsonResponse(404, { error: "Pedido de plano nao encontrado." });
      }

      const requestStatus = String(requestRow.status || "").trim().toLowerCase();
      if (!MERCHANT_PROOF_SUBMITTABLE_STATUSES.has(requestStatus)) {
        return jsonResponse(400, {
          error: requestStatus === "proof_submitted" || requestStatus === "under_review"
            ? "O comprovativo ja foi enviado e esta em analise."
            : "Este pedido ja nao aceita novos comprovativos.",
        });
      }

      const upload = await uploadPrivateFileAsset({
        dataUrl,
        scope: "plan-payment-proofs",
        ownerId: requestRow.store_id || session.storeId,
        fileName,
      });

      await connection.query("begin");
      transactionStarted = true;

      await connection.query(
        `insert into public.catalog_plan_payment_proofs (
           id,
           request_id,
           submitted_by_user_id,
           original_file_name,
           mime_type,
           size_bytes,
           storage_bucket,
           storage_path,
           payer_name,
           payer_phone,
           payment_reference_text,
           paid_amount,
           paid_currency_code,
           paid_at,
           note,
           review_status
         ) values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'submitted'
         )`,
        [
          randomUUID(),
          requestId,
          session.userId,
          fileName,
          upload.mimeType,
          upload.sizeBytes,
          upload.bucket,
          upload.objectPath,
          payerName,
          payerPhone,
          paymentReferenceText,
          paidAmount,
          paidCurrencyCode,
          paidAt,
          note,
        ],
      );

      const updatedRequestResult = await connection.query(
        `update public.catalog_plan_activation_requests requests
            set status = 'proof_submitted',
                payment_proof_status = 'submitted',
                merchant_note = $2,
                review_note = '',
                paid_amount = $3,
                paid_currency_code = $4,
                paid_at = $5,
                last_proof_submitted_at = now(),
                requested_at = coalesce(requests.requested_at, now()),
                resolved_at = null,
                resolved_by_user_id = null
           where requests.id = $1
           returning
             ${PLAN_REQUEST_RETURNING_SQL}`,
         [
          requestId,
          note,
          paidAmount,
          paidCurrencyCode,
          paidAt,
        ],
      );

      await connection.query("commit");
      transactionStarted = false;

      const mappedRequests = await mapPlanRequestsWithProofs(connection, updatedRequestResult.rows);

      return jsonResponse(200, {
        ok: true,
        request: mappedRequests[0] || null,
      });
    } catch (error) {
      if (transactionStarted) {
        await connection.query("rollback").catch(() => {});
      }
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(error.status || 500, {
      error: error.message || "Nao foi possivel enviar o comprovativo do plano.",
    });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
