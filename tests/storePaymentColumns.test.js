import assert from "node:assert/strict";
import {
  buildCatalogStorePaymentUpsertFragments,
  ensureCatalogStorePaymentColumns,
  getCatalogStorePaymentSelectFragments,
} from "../netlify/functions/_store-payment-columns.js";

export async function runStorePaymentColumnsTests() {
  const noColumns = {
    payment_method: false,
    payment_bank_name: false,
    payment_account_name: false,
    payment_account_number: false,
    payment_iban: false,
  };

  assert.deepEqual(getCatalogStorePaymentSelectFragments(noColumns), [
    "''::varchar(80) as payment_method",
    "''::varchar(160) as payment_bank_name",
    "''::varchar(160) as payment_account_name",
    "''::varchar(80) as payment_account_number",
    "''::varchar(80) as payment_iban",
  ]);

  const partialColumns = {
    payment_method: true,
    payment_bank_name: false,
    payment_account_name: true,
    payment_account_number: false,
    payment_iban: true,
  };

  const fragments = buildCatalogStorePaymentUpsertFragments(
    {
      paymentMethod: "Transferencia",
      paymentBankName: "Banco Teste",
      paymentAccountName: "Loja Teste",
      paymentAccountNumber: "12345",
      paymentIban: "AO0600440000012345",
    },
    partialColumns,
    19,
  );

  assert.deepEqual(fragments.insertColumns, [
    "payment_method",
    "payment_account_name",
    "payment_iban",
  ]);
  assert.deepEqual(fragments.valuePlaceholders, ["$19", "$20", "$21"]);
  assert.deepEqual(fragments.updateAssignments, [
    "payment_method = excluded.payment_method",
    "payment_account_name = excluded.payment_account_name",
    "payment_iban = excluded.payment_iban",
  ]);
  assert.deepEqual(fragments.values, [
    "Transferencia",
    "Loja Teste",
    "AO0600440000012345",
  ]);
  assert.equal(fragments.nextIndex, 22);

  const executedSql = [];
  const availableSet = new Set(["payment_method", "payment_account_name"]);
  const mockQueryable = {
    async query(sql, params = []) {
      executedSql.push({ sql: String(sql), params });

      if (String(sql).includes("information_schema.columns")) {
        const columnName = params[2];
        return { rowCount: availableSet.has(columnName) ? 1 : 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  await ensureCatalogStorePaymentColumns(mockQueryable);

  const alterStatements = executedSql
    .map((entry) => entry.sql)
    .filter((sql) => sql.includes("alter table if exists public.catalog_stores"));

  assert.equal(alterStatements.some((sql) => sql.includes("payment_method")), false);
  assert.equal(alterStatements.some((sql) => sql.includes("payment_account_name")), false);
  assert.equal(alterStatements.some((sql) => sql.includes("payment_bank_name")), true);
  assert.equal(alterStatements.some((sql) => sql.includes("payment_account_number")), true);
  assert.equal(alterStatements.some((sql) => sql.includes("payment_iban")), true);
}
