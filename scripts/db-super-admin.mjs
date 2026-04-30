import { randomUUID } from "node:crypto";
import { loadLocalEnv } from "./loadEnv.mjs";
import { ensureModernSchema } from "./ensureModernSchema.mjs";

loadLocalEnv();

const [, , rawEmail, rawPassword, ...rawNameParts] = process.argv;

if (!rawEmail || !rawPassword) {
  console.error("Uso: npm run db:super-admin -- <email> <password> [nome completo]");
  process.exit(1);
}

const { getPool } = await import("../netlify/functions/_postgres.js");
const { hashPassword } = await import("../netlify/functions/_auth.js");
const { normalizeEmail, validatePasswordStrength } = await import("../netlify/functions/_security.js");

const email = normalizeEmail(rawEmail);
const password = String(rawPassword || "");
const fullName = rawNameParts.join(" ").trim();

if (!email || !email.includes("@")) {
  console.error("Indica um email valido para o super admin.");
  process.exit(1);
}

const passwordError = validatePasswordStrength(password);
if (passwordError) {
  console.warn(`Aviso: ${passwordError}`);
  console.warn("A password sera aplicada apenas por este bootstrap local.");
}

async function main() {
  const pool = getPool();
  await ensureModernSchema(pool);
  const connection = await pool.connect();

  try {
    await connection.query("begin");

    const existingUserResult = await connection.query(
      `select id, full_name
       from catalog_users
       where lower(email) = $1
       limit 1
       for update`,
      [email],
    );

    const passwordHash = await hashPassword(password);
    const existingUser = existingUserResult.rows[0];

    if (existingUser) {
      await connection.query(
        `update catalog_users
         set password_hash = $2,
             full_name = case
               when $3 <> '' then $3
               else full_name
             end,
             role = 'super_admin',
             account_status = 'active',
             updated_at = now()
         where id = $1`,
        [existingUser.id, passwordHash, fullName],
      );

      await connection.query("commit");
      console.log(`Super admin atualizado com sucesso: ${email}`);
      return;
    }

    await connection.query(
      `insert into catalog_users (
         id, email, password_hash, full_name, role, account_status
       ) values ($1, $2, $3, $4, 'super_admin', 'active')`,
      [randomUUID(), email, passwordHash, fullName],
    );

    await connection.query("commit");
    console.log(`Super admin criado com sucesso: ${email}`);
  } catch (error) {
    await connection.query("rollback");
    throw error;
  } finally {
    connection.release();
  }
}

main()
  .catch((error) => {
    console.error("Falha ao criar/atualizar o super admin.");
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const pool = getPool();
    await pool.end().catch(() => {});
  });
