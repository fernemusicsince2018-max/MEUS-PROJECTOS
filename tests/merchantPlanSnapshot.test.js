import assert from "node:assert/strict";
import { resolveMerchantPlanSnapshot } from "../src/catalog/utils/catalog.js";

export async function runMerchantPlanSnapshotTests() {
  const livePlanSnapshot = resolveMerchantPlanSnapshot(
    {
      storeId: "store-1",
      storeName: "Loja Sessao",
      planStatus: null,
      planExpiresAt: null,
      referenceId: "",
    },
    {
      id: "store-1",
      name: "Loja Atualizada",
      currentPlanStatus: "canceled",
      currentPlanExpiresAt: "2026-05-01T00:00:00.000Z",
      referenceId: "654321",
    },
  );

  assert.deepEqual(livePlanSnapshot, {
    storeId: "store-1",
    storeName: "Loja Atualizada",
    planStatus: "canceled",
    planExpiresAt: "2026-05-01T00:00:00.000Z",
    referenceId: "654321",
  });

  const preservedSessionSnapshot = resolveMerchantPlanSnapshot(
    {
      storeId: "store-1",
      storeName: "Loja Principal",
      planStatus: "active",
      planExpiresAt: "2026-06-01T00:00:00.000Z",
      referenceId: "123456",
    },
    {
      id: "store-2",
      name: "Outra Loja",
      currentPlanStatus: "canceled",
      currentPlanExpiresAt: "2026-05-01T00:00:00.000Z",
      referenceId: "999999",
    },
  );

  assert.deepEqual(preservedSessionSnapshot, {
    storeId: "store-1",
    storeName: "Loja Principal",
    planStatus: "active",
    planExpiresAt: "2026-06-01T00:00:00.000Z",
    referenceId: "123456",
  });
}
