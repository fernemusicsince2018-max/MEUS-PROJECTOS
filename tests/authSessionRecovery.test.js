import assert from "node:assert/strict";
import { ensureSessionStoreContext } from "../netlify/functions/_auth.js";

export async function runAuthSessionRecoveryTests() {
  const calls = [];
  const merchantSession = await ensureSessionStoreContext(
    {},
    {
      user_id: "user-1",
      email: "lojista@exemplo.com",
      full_name: "Loja Exemplo",
      role: "merchant",
      store_id: "",
      store_name: "",
      plan_status: "",
      plan_expires_at: null,
      reference_id: "",
    },
    async (_queryable, userId, preferredName) => {
      calls.push({ userId, preferredName });
      return {
        id: "store-1",
        name: "Loja Exemplo",
        plan_status: "trial",
        plan_expires_at: "2026-05-31T00:00:00.000Z",
        reference_id: "123456",
      };
    },
  );

  assert.deepEqual(calls, [{ userId: "user-1", preferredName: "Loja Exemplo" }]);
  assert.equal(merchantSession.store_id, "store-1");
  assert.equal(merchantSession.store_name, "Loja Exemplo");
  assert.equal(merchantSession.plan_status, "trial");
  assert.equal(merchantSession.plan_expires_at, "2026-05-31T00:00:00.000Z");
  assert.equal(merchantSession.reference_id, "123456");

  let superAdminRecovered = false;
  const superAdminSession = await ensureSessionStoreContext(
    {},
    {
      user_id: "admin-1",
      email: "admin@exemplo.com",
      full_name: "Admin Exemplo",
      role: "super_admin",
      store_id: "",
      store_name: "",
    },
    async () => {
      superAdminRecovered = true;
      return { id: "unexpected" };
    },
  );

  assert.equal(superAdminRecovered, false);
  assert.equal(superAdminSession.store_id, "");

  let existingStoreRecovered = false;
  const existingStoreSession = await ensureSessionStoreContext(
    {},
    {
      user_id: "user-2",
      email: "lojista2@exemplo.com",
      full_name: "Loja Existente",
      role: "merchant",
      store_id: "store-existing",
      store_name: "Loja Existente",
    },
    async () => {
      existingStoreRecovered = true;
      return { id: "unexpected" };
    },
  );

  assert.equal(existingStoreRecovered, false);
  assert.equal(existingStoreSession.store_id, "store-existing");
}
