import { getSessionContext } from "./_auth.js";
import { registerOrderMetricsStatusTransition } from "./_order-metrics.js";
import { applyOrderStatusUpdate, mapOrder, normalizeOrderStatusUpdateInput } from "./_orders.js";
import { registerOrderStatusTransition } from "./_order-stats.js";
import { ensureDatabaseReady, getPool, jsonResponse, withCors } from "./_postgres.js";

async function handle(event) {
  try {
    const session = await getSessionContext(event);
    if (!session?.storeId || !session?.userId) {
      return jsonResponse(401, { error: "Precisas de iniciar sessao para atualizar a encomenda." });
    }

    await ensureDatabaseReady();
    const payload = JSON.parse(event.body || "{}");
    const normalizedResult = normalizeOrderStatusUpdateInput(payload);
    if (normalizedResult.error) {
      return jsonResponse(400, { error: normalizedResult.error });
    }

    const { orderId, status, statusDurations } = normalizedResult.value;
    const pool = getPool();
    const connection = await pool.connect();

    try {
      await connection.query("begin");
      const currentOrderResult = await connection.query(
        `select *
         from catalog_orders
         where id = $1
           and store_id = $2
         limit 1`,
        [orderId, session.storeId],
      );

      if (!currentOrderResult.rows.length) {
        await connection.query("rollback");
        return jsonResponse(404, { error: "Encomenda nao encontrada." });
      }

      const currentOrder = mapOrder(currentOrderResult.rows[0]);
      const nextState = applyOrderStatusUpdate(currentOrder, status, statusDurations, new Date());
      const updateResult = await connection.query(
        `update catalog_orders
         set status = $1,
             status_updated_at = $2::timestamptz,
             status_timeline = $3::jsonb
         where id = $4
           and store_id = $5
         returning *`,
        [
          nextState.status,
          nextState.statusUpdatedAt,
          JSON.stringify(nextState.statusTimeline),
          orderId,
          session.storeId,
        ],
      );

      await registerOrderStatusTransition(
        connection,
        session.storeId,
        currentOrder.status,
        nextState.status,
      );
      await registerOrderMetricsStatusTransition(connection, {
        storeId: session.storeId,
        createdAt: currentOrder.createdAt,
        totalAmount: currentOrder.totalAmount,
        previousStatus: currentOrder.status,
        nextStatus: nextState.status,
      });
      await connection.query("commit");

      return jsonResponse(200, {
        ok: true,
        order: mapOrder(updateResult.rows[0]),
      });
    } catch (error) {
      await connection.query("rollback").catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Erro interno." });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
