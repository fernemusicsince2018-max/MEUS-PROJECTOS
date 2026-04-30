import { deleteSessionsByUser, getEffectiveUserRole, getSuperAdminSession, requireSuperAdminAccess } from "./_auth.js";
import { invalidatePublicCatalogCache } from "./_catalog-cache.js";
import { getPool, jsonResponse, withCors } from "./_postgres.js";

const LIFECYCLE_ACTIONS = new Set(["trash", "restore", "delete_forever"]);

function normalizeLifecycleAction(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return LIFECYCLE_ACTIONS.has(normalized) ? normalized : "";
}

async function handle(event) {
  try {
    const session = await getSuperAdminSession(event);
    const payload = JSON.parse(event.body || "{}");
    const action = normalizeLifecycleAction(payload.action);
    const userId = String(payload.userId || "").trim();

    if (!userId) {
      return jsonResponse(400, { error: "A empresa a gerir e obrigatoria." });
    }

    if (!action) {
      return jsonResponse(400, { error: "A acao pedida nao e valida." });
    }

    requireSuperAdminAccess(
      session,
      action === "trash" ? "clientes" : "lixo",
      action === "trash"
        ? "Nao tens permissao para mover empresas para o lixo."
        : "Nao tens permissao para gerir o lixo do super admin.",
    );

    if (session.userId === userId) {
      return jsonResponse(400, { error: "Nao podes mover a tua propria conta para o lixo nem elimina-la." });
    }

    const pool = getPool();
    const connection = await pool.connect();

    try {
      await connection.query("begin");

      const clientResult = await connection.query(
        `select
           users.id,
           users.email,
           users.full_name,
           users.role,
           users.deleted_at as user_deleted_at,
           stores.id as store_id,
           stores.deleted_at as store_deleted_at
         from catalog_users users
         left join catalog_stores stores on stores.owner_user_id = users.id
         where users.id = $1
         limit 1`,
        [userId],
      );

      const client = clientResult.rows[0];
      if (!client) {
        await connection.query("rollback");
        return jsonResponse(404, { error: "Empresa nao encontrada." });
      }

      if (getEffectiveUserRole(client) === "super_admin") {
        await connection.query("rollback");
        return jsonResponse(400, { error: "Contas de super admin nao podem ser geridas por esta acao." });
      }

      if (action === "trash") {
        await connection.query(
          `update catalog_users
           set deleted_at = now(),
               deleted_by_user_id = $2,
               account_status = 'suspended'
           where id = $1`,
          [userId, session.userId],
        );

        await connection.query(
          `update catalog_stores
           set deleted_at = now(),
               deleted_by_user_id = $2
           where owner_user_id = $1`,
          [userId, session.userId],
        );

        await connection.query(
          `delete from catalog_password_reset_tokens
           where user_id = $1`,
          [userId],
        );

        await deleteSessionsByUser(connection, userId);
        await connection.query("commit");
        if (client.store_id) {
          invalidatePublicCatalogCache(client.store_id);
        }

        return jsonResponse(200, { ok: true, action });
      }

      if (action === "restore") {
        await connection.query(
          `update catalog_users
           set deleted_at = null,
               deleted_by_user_id = null,
               account_status = 'active'
           where id = $1`,
          [userId],
        );

        await connection.query(
          `update catalog_stores
           set deleted_at = null,
               deleted_by_user_id = null
           where owner_user_id = $1`,
          [userId],
        );

        await connection.query("commit");
        if (client.store_id) {
          invalidatePublicCatalogCache(client.store_id);
        }
        return jsonResponse(200, { ok: true, action });
      }

      if (!client.user_deleted_at && !client.store_deleted_at) {
        await connection.query("rollback");
        return jsonResponse(400, { error: "Move primeiro esta empresa para o lixo antes de a eliminares para sempre." });
      }

      await connection.query(
        `delete from catalog_users
         where id = $1`,
        [userId],
      );

      await connection.query("commit");
      if (client.store_id) {
        invalidatePublicCatalogCache(client.store_id);
      }
      return jsonResponse(200, { ok: true, action });
    } catch (error) {
      await connection.query("rollback");
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return jsonResponse(error.status || 500, {
      error: error.message || "Nao foi possivel atualizar o estado desta empresa.",
    });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
