import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./loadEnv.mjs";
import { ensureModernSchema } from "./ensureModernSchema.mjs";
import { ensureCatalogStorePaymentColumns } from "../netlify/functions/_store-payment-columns.js";

loadLocalEnv();

const { getPool } = await import("../netlify/functions/_postgres.js");

async function main() {
  const schemaPath = path.resolve("backend/postgresql/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  const pool = getPool();

  await pool.query(sql);
  await ensureModernSchema(pool);
  await ensureCatalogStorePaymentColumns(pool);

  console.log("Base de dados preparada com sucesso.");
  console.log(`Schema aplicado: ${schemaPath}`);
}

main()
  .catch((error) => {
    console.error("Falha ao criar a estrutura da base de dados.");
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const pool = getPool();
    await pool.end().catch(() => {});
  });
