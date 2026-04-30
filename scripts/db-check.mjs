import { loadLocalEnv } from "./loadEnv.mjs";

loadLocalEnv();

const { getPool } = await import("../netlify/functions/_postgres.js");

async function main() {
  const pool = getPool();
  const result = await pool.query(`
    select
      current_database() as database_name,
      current_user as database_user,
      to_regclass('public.catalog_users') as users_table,
      to_regclass('public.catalog_sessions') as sessions_table,
      to_regclass('public.catalog_stores') as stores_table,
      to_regclass('public.catalog_products') as products_table,
      to_regclass('public.catalog_plan_definitions') as plans_table
  `);

  const row = result.rows[0];

  console.log("Ligacao PostgreSQL OK.");
  console.log(`Database: ${row.database_name}`);
  console.log(`User: ${row.database_user}`);
  console.log(`Tabela users: ${row.users_table || "nao encontrada"}`);
  console.log(`Tabela sessions: ${row.sessions_table || "nao encontrada"}`);
  console.log(`Tabela stores: ${row.stores_table || "nao encontrada"}`);
  console.log(`Tabela products: ${row.products_table || "nao encontrada"}`);
  console.log(`Tabela plans: ${row.plans_table || "nao encontrada"}`);
}

main()
  .catch((error) => {
    console.error("Falha ao validar a ligacao PostgreSQL.");
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const pool = getPool();
    await pool.end().catch(() => {});
  });
