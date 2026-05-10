import { Client } from "pg";
import { loadLocalEnv } from "./loadEnv.mjs";

loadLocalEnv();

function buildAdminConfig() {
  const {
    POSTGRES_HOST = "127.0.0.1",
    POSTGRES_PORT = "5432",
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_SSL,
  } = process.env;

  if (!POSTGRES_USER || !POSTGRES_PASSWORD) {
    throw new Error("Configura POSTGRES_USER e POSTGRES_PASSWORD para criar a base.");
  }

  return {
    host: POSTGRES_HOST,
    port: Number(POSTGRES_PORT),
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: "postgres",
    ssl: POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

async function main() {
  const databaseName = process.env.POSTGRES_DATABASE || "kastrozap";
  const client = new Client(buildAdminConfig());

  await client.connect();

  const exists = await client.query("select 1 from pg_database where datname = $1", [databaseName]);

  if (exists.rowCount) {
    console.log(`A base ${databaseName} ja existe.`);
    await client.end();
    return;
  }

  const safeName = databaseName.replace(/"/g, "\"\"");
  await client.query(`create database "${safeName}"`);

  console.log(`Base ${databaseName} criada com sucesso.`);
  await client.end();
}

main().catch((error) => {
  console.error("Falha ao criar a base de dados.");
  console.error(error.message || error);
  process.exitCode = 1;
});
