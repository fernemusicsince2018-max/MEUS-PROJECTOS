import { hasColumn } from "./_postgres.js";

const STORE_PAYMENT_COLUMN_DEFINITIONS = Object.freeze([
  {
    storeKey: "paymentMethod",
    columnName: "payment_method",
    columnTypeSql: "varchar(80)",
    fallbackSelectSql: "''::varchar(80) as payment_method",
  },
  {
    storeKey: "paymentBankName",
    columnName: "payment_bank_name",
    columnTypeSql: "varchar(160)",
    fallbackSelectSql: "''::varchar(160) as payment_bank_name",
  },
  {
    storeKey: "paymentAccountName",
    columnName: "payment_account_name",
    columnTypeSql: "varchar(160)",
    fallbackSelectSql: "''::varchar(160) as payment_account_name",
  },
  {
    storeKey: "paymentAccountNumber",
    columnName: "payment_account_number",
    columnTypeSql: "varchar(80)",
    fallbackSelectSql: "''::varchar(80) as payment_account_number",
  },
  {
    storeKey: "paymentIban",
    columnName: "payment_iban",
    columnTypeSql: "varchar(80)",
    fallbackSelectSql: "''::varchar(80) as payment_iban",
  },
]);

async function getCatalogStorePaymentColumnAvailability(queryable) {
  const presenceList = await Promise.all(
    STORE_PAYMENT_COLUMN_DEFINITIONS.map((definition) =>
      hasColumn(queryable, "catalog_stores", definition.columnName, "public", { cacheMissing: true })),
  );

  return STORE_PAYMENT_COLUMN_DEFINITIONS.reduce((acc, definition, index) => {
    acc[definition.columnName] = presenceList[index];
    return acc;
  }, {});
}

function getCatalogStorePaymentSelectFragments(availableColumns = {}) {
  return STORE_PAYMENT_COLUMN_DEFINITIONS.map((definition) =>
    availableColumns?.[definition.columnName]
      ? definition.columnName
      : definition.fallbackSelectSql);
}

function buildCatalogStorePaymentUpsertFragments(store = {}, availableColumns = {}, startIndex = 1) {
  const insertColumns = [];
  const valuePlaceholders = [];
  const updateAssignments = [];
  const values = [];
  let nextIndex = startIndex;

  for (const definition of STORE_PAYMENT_COLUMN_DEFINITIONS) {
    if (!availableColumns?.[definition.columnName]) {
      continue;
    }

    insertColumns.push(definition.columnName);
    valuePlaceholders.push(`$${nextIndex}`);
    updateAssignments.push(`${definition.columnName} = excluded.${definition.columnName}`);
    values.push(store?.[definition.storeKey] || "");
    nextIndex += 1;
  }

  return {
    insertColumns,
    valuePlaceholders,
    updateAssignments,
    values,
    nextIndex,
  };
}

async function ensureCatalogStorePaymentColumns(queryable) {
  const availableColumns = await getCatalogStorePaymentColumnAvailability(queryable);

  for (const definition of STORE_PAYMENT_COLUMN_DEFINITIONS) {
    if (availableColumns?.[definition.columnName]) {
      continue;
    }

    await queryable.query(
      `alter table if exists public.catalog_stores
         add column if not exists ${definition.columnName} ${definition.columnTypeSql} not null default ''`,
    );
  }
}

export {
  buildCatalogStorePaymentUpsertFragments,
  ensureCatalogStorePaymentColumns,
  getCatalogStorePaymentColumnAvailability,
  getCatalogStorePaymentSelectFragments,
  STORE_PAYMENT_COLUMN_DEFINITIONS,
};
