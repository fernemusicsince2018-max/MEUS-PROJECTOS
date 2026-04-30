import { randomUUID } from "node:crypto";
import { getSuperAdminSession, requireSuperAdminAccess } from "./_auth.js";
import { getPool, jsonResponse, withCors } from "./_postgres.js";

const CURRENCY_CODES = new Set(["AOA", "BRL", "USD", "EUR"]);

function normalizeCurrencyCode(value) {
  const normalized = String(value || "AOA").trim().toUpperCase();
  return CURRENCY_CODES.has(normalized) ? normalized : "AOA";
}

function parsePrice(value) {
  if (value === "" || value == null) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error("O valor do plano deve ser um numero valido e nao negativo.");
    error.status = 400;
    throw error;
  }
  return parsed;
}

function parseNullableInteger(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    const error = new Error("Os limites do plano devem ser numeros inteiros iguais ou maiores que zero.");
    error.status = 400;
    throw error;
  }

  return parsed;
}

async function handle(event) {
  try {
    const session = await getSuperAdminSession(event);
    requireSuperAdminAccess(session, "planos", "Nao tens permissao para gerir os planos da plataforma.");

    const payload = JSON.parse(event.body || "{}");
    const id = String(payload.id || "").trim() || randomUUID();
    const code = String(payload.code || "").trim().toLowerCase();
    const name = String(payload.name || "").trim();
    const description = String(payload.description || "").trim();
    const priceMonthly = parsePrice(payload.priceMonthly);
    const currencyCode = normalizeCurrencyCode(payload.currencyCode);
    const maxProducts = parseNullableInteger(payload.maxProducts);
    const maxTeamMembers = parseNullableInteger(payload.maxTeamMembers);
    const active = Boolean(payload.active);
    const sortOrder = Number.isInteger(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0;

    if (!code) {
      return jsonResponse(400, { error: "Indica um codigo curto para o plano." });
    }

    if (!/^[a-z0-9_-]+$/.test(code)) {
      return jsonResponse(400, { error: "O codigo do plano deve usar apenas letras minusculas, numeros, underscore ou hifen." });
    }

    if (!name) {
      return jsonResponse(400, { error: "Indica o nome do plano." });
    }

    const pool = getPool();
    const existing = await pool.query(
      `select id
       from catalog_plan_definitions
       where code = $1
         and id <> $2
       limit 1`,
      [code, id],
    );

    if (existing.rows.length) {
      return jsonResponse(409, { error: "Ja existe outro plano com este codigo." });
    }

    const result = await pool.query(
      `insert into catalog_plan_definitions (
         id,
         code,
         name,
         description,
         price_monthly,
         currency_code,
         max_products,
         max_team_members,
         active,
         sort_order
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (id) do update set
         code = excluded.code,
         name = excluded.name,
         description = excluded.description,
         price_monthly = excluded.price_monthly,
         currency_code = excluded.currency_code,
         max_products = excluded.max_products,
         max_team_members = excluded.max_team_members,
         active = excluded.active,
         sort_order = excluded.sort_order
       returning id`,
      [id, code, name, description, priceMonthly, currencyCode, maxProducts, maxTeamMembers, active, sortOrder],
    );

    return jsonResponse(200, {
      ok: true,
      id: result.rows[0]?.id || id,
    });
  } catch (error) {
    return jsonResponse(error.status || 500, {
      error: error.message || "Nao foi possivel guardar o plano.",
    });
  }
}

export const handler = withCors(handle, { allowMethods: ["POST"] });
