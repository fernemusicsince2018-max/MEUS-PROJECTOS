import { loadLocalEnv } from "./loadEnv.mjs";

loadLocalEnv();

const { getPool } = await import("../netlify/functions/_postgres.js");

const REQUIRED_STORE_COLUMNS = [
  "id",
  "owner_user_id",
  "name",
  "description",
  "whatsapp",
  "logo",
  "color",
  "currency_code",
  "pickup_note",
  "whatsapp_order_format",
  "public_enabled",
  "legal_name",
  "tax_id",
  "business_email",
  "business_phone",
  "address_line",
  "city",
  "country",
  "public_slug",
  "custom_domain",
  "plan_id",
  "plan_status",
  "plan_started_at",
  "plan_expires_at",
  "plan_duration_days",
  "plan_total_price",
  "internal_notes",
  "deleted_at",
  "deleted_by_user_id",
  "created_at",
  "updated_at",
];

const REQUIRED_USER_COLUMNS = [
  "id",
  "email",
  "password_hash",
  "full_name",
  "avatar_url",
  "super_admin_access",
  "role",
  "account_status",
  "deleted_at",
  "deleted_by_user_id",
  "created_at",
  "updated_at",
];

const REQUIRED_PRODUCT_COLUMNS = [
  "id",
  "catalog_id",
  "name",
  "description",
  "price",
  "compare_at",
  "image",
  "category",
  "stock",
  "featured",
  "available",
  "created_at",
  "updated_at",
];

const REQUIRED_ORDER_COLUMNS = [
  "id",
  "store_id",
  "tracking_code",
  "tracking_token",
  "customer_name",
  "fulfillment_type",
  "region",
  "area",
  "pickup_time",
  "delivery_time",
  "notes",
  "status",
  "total_amount",
  "currency_code",
  "item_count",
  "status_updated_at",
  "status_timeline",
  "created_at",
  "updated_at",
];

const REQUIRED_SETTINGS_COLUMNS = [
  "key",
  "value",
  "category",
  "description",
  "updated_at",
];

const REQUIRED_ORDER_STATS_COLUMNS = [
  "store_id",
  "total_count",
  "pending_count",
  "in_progress_count",
  "on_the_way_count",
  "delivered_count",
  "created_at",
  "updated_at",
];

const REQUIRED_NOTIFICATION_JOB_COLUMNS = [
  "id",
  "type",
  "status",
  "payload",
  "attempt_count",
  "max_attempts",
  "available_at",
  "locked_at",
  "locked_by",
  "last_error",
  "last_result",
  "completed_at",
  "created_at",
  "updated_at",
];

const REQUIRED_PUBLIC_SNAPSHOT_COLUMNS = [
  "store_id",
  "response_body",
  "updated_at",
];

const REQUIRED_PLAN_EVENT_COLUMNS = [
  "id",
  "store_id",
  "user_id",
  "recorded_by_user_id",
  "plan_id",
  "event_type",
  "plan_code",
  "plan_name",
  "store_name",
  "merchant_email",
  "reference_id",
  "plan_status",
  "duration_days",
  "total_price",
  "currency_code",
  "plan_started_at",
  "plan_expires_at",
  "recorded_at",
];

const REQUIRED_PLAN_REQUEST_COLUMNS = [
  "id",
  "store_id",
  "user_id",
  "plan_id",
  "resolved_by_user_id",
  "activated_by_user_id",
  "plan_code",
  "plan_name",
  "store_name",
  "merchant_email",
  "reference_id",
  "store_whatsapp",
  "product_count",
  "current_plan_status",
  "current_plan_name",
  "duration_days",
  "total_price",
  "currency_code",
  "message_text",
  "whatsapp_link",
  "payment_reference",
  "payment_method",
  "payment_instructions",
  "payment_bank_name",
  "payment_account_name",
  "payment_account_number",
  "payment_iban",
  "payment_proof_status",
  "merchant_note",
  "review_note",
  "paid_amount",
  "paid_currency_code",
  "paid_at",
  "payment_due_at",
  "last_proof_submitted_at",
  "status",
  "requested_at",
  "resolved_at",
  "activated_at",
];

const REQUIRED_PLAN_PROOF_COLUMNS = [
  "id",
  "request_id",
  "submitted_by_user_id",
  "reviewed_by_user_id",
  "original_file_name",
  "mime_type",
  "size_bytes",
  "storage_bucket",
  "storage_path",
  "payer_name",
  "payer_phone",
  "payment_reference_text",
  "paid_amount",
  "paid_currency_code",
  "paid_at",
  "note",
  "review_status",
  "review_note",
  "submitted_at",
  "reviewed_at",
];

async function main() {
  const pool = getPool();
  const columnsResult = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_stores'
      order by ordinal_position
    `,
  );

  const availableColumns = columnsResult.rows.map((row) => row.column_name);
  const missingColumns = REQUIRED_STORE_COLUMNS.filter((column) => !availableColumns.includes(column));

  const userColumnsResult = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_users'
      order by ordinal_position
    `,
  );

  const availableUserColumns = userColumnsResult.rows.map((row) => row.column_name);
  const missingUserColumns = REQUIRED_USER_COLUMNS.filter((column) => !availableUserColumns.includes(column));

  const productColumnsResult = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_products'
      order by ordinal_position
    `,
  );

  const availableProductColumns = productColumnsResult.rows.map((row) => row.column_name);
  const missingProductColumns = REQUIRED_PRODUCT_COLUMNS.filter((column) => !availableProductColumns.includes(column));

  const orderColumnsResult = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_orders'
      order by ordinal_position
    `,
  );

  const availableOrderColumns = orderColumnsResult.rows.map((row) => row.column_name);
  const missingOrderColumns = REQUIRED_ORDER_COLUMNS.filter((column) => !availableOrderColumns.includes(column));

  const settingsColumnsResult = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_settings'
      order by ordinal_position
    `,
  );

  const availableSettingsColumns = settingsColumnsResult.rows.map((row) => row.column_name);
  const missingSettingsColumns = REQUIRED_SETTINGS_COLUMNS.filter((column) => !availableSettingsColumns.includes(column));

  const orderStatsColumnsResult = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_order_stats'
      order by ordinal_position
    `,
  );

  const availableOrderStatsColumns = orderStatsColumnsResult.rows.map((row) => row.column_name);
  const missingOrderStatsColumns = REQUIRED_ORDER_STATS_COLUMNS.filter((column) => !availableOrderStatsColumns.includes(column));

  const notificationJobColumnsResult = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_notification_jobs'
      order by ordinal_position
    `,
  );

  const availableNotificationJobColumns = notificationJobColumnsResult.rows.map((row) => row.column_name);
  const missingNotificationJobColumns = REQUIRED_NOTIFICATION_JOB_COLUMNS.filter((column) => !availableNotificationJobColumns.includes(column));

  const publicSnapshotColumnsResult = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_public_snapshots'
      order by ordinal_position
    `,
  );

  const availablePublicSnapshotColumns = publicSnapshotColumnsResult.rows.map((row) => row.column_name);
  const missingPublicSnapshotColumns = REQUIRED_PUBLIC_SNAPSHOT_COLUMNS.filter((column) => !availablePublicSnapshotColumns.includes(column));

  const planEventColumnsResult = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_plan_activation_events'
      order by ordinal_position
    `,
  );

  const availablePlanEventColumns = planEventColumnsResult.rows.map((row) => row.column_name);
  const missingPlanEventColumns = REQUIRED_PLAN_EVENT_COLUMNS.filter((column) => !availablePlanEventColumns.includes(column));

  const planRequestColumnsResult = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_plan_activation_requests'
      order by ordinal_position
    `,
  );

  const availablePlanRequestColumns = planRequestColumnsResult.rows.map((row) => row.column_name);
  const missingPlanRequestColumns = REQUIRED_PLAN_REQUEST_COLUMNS.filter((column) => !availablePlanRequestColumns.includes(column));

  const planProofColumnsResult = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'catalog_plan_payment_proofs'
      order by ordinal_position
    `,
  );

  const availablePlanProofColumns = planProofColumnsResult.rows.map((row) => row.column_name);
  const missingPlanProofColumns = REQUIRED_PLAN_PROOF_COLUMNS.filter((column) => !availablePlanProofColumns.includes(column));

  const dbInfoResult = await pool.query(`
    select
      current_database() as database_name,
      current_user as database_user
  `);

  const dbInfo = dbInfoResult.rows[0];
  const extraTablesResult = await pool.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'catalog_auth_rate_limits',
        'catalog_notification_jobs',
        'catalog_password_reset_tokens',
        'catalog_public_snapshots',
        'catalog_order_stats',
        'catalog_plan_definitions',
        'catalog_plan_activation_events',
        'catalog_plan_activation_requests',
        'catalog_plan_payment_proofs'
      )
    order by table_name
  `);

  const extraTables = extraTablesResult.rows.map((row) => row.table_name);
  const missingTables = [
    "catalog_auth_rate_limits",
    "catalog_notification_jobs",
    "catalog_order_stats",
    "catalog_password_reset_tokens",
    "catalog_public_snapshots",
    "catalog_plan_definitions",
    "catalog_plan_activation_events",
    "catalog_plan_activation_requests",
    "catalog_plan_payment_proofs",
  ].filter((tableName) => !extraTables.includes(tableName));

  console.log("Verificacao do schema da tabela catalog_stores");
  console.log(`Database: ${dbInfo.database_name}`);
  console.log(`User: ${dbInfo.database_user}`);
  console.log(`Colunas encontradas: ${availableColumns.join(", ")}`);
  console.log(`Colunas de users encontradas: ${availableUserColumns.join(", ")}`);
  console.log(`Colunas de products encontradas: ${availableProductColumns.join(", ")}`);
  console.log(`Colunas de orders encontradas: ${availableOrderColumns.join(", ")}`);
  console.log(`Colunas de settings encontradas: ${availableSettingsColumns.join(", ")}`);
  console.log(`Colunas de order_stats encontradas: ${availableOrderStatsColumns.join(", ")}`);
  console.log(`Colunas de notification_jobs encontradas: ${availableNotificationJobColumns.join(", ")}`);
  console.log(`Colunas de public_snapshots encontradas: ${availablePublicSnapshotColumns.join(", ")}`);
  console.log(`Colunas de plan_activation_events encontradas: ${availablePlanEventColumns.join(", ")}`);
  console.log(`Colunas de plan_activation_requests encontradas: ${availablePlanRequestColumns.join(", ")}`);
  console.log(`Colunas de plan_payment_proofs encontradas: ${availablePlanProofColumns.join(", ")}`);
  console.log(`Tabelas extra encontradas: ${extraTables.join(", ") || "(nenhuma)"}`);

  if (
    missingColumns.length
    || missingUserColumns.length
    || missingProductColumns.length
    || missingOrderColumns.length
    || missingSettingsColumns.length
    || missingOrderStatsColumns.length
    || missingNotificationJobColumns.length
    || missingPublicSnapshotColumns.length
    || missingPlanEventColumns.length
    || missingPlanRequestColumns.length
    || missingPlanProofColumns.length
    || missingTables.length
  ) {
    console.log(`Colunas em falta: ${missingColumns.join(", ")}`);
    console.log(`Colunas de users em falta: ${missingUserColumns.join(", ")}`);
    console.log(`Colunas de products em falta: ${missingProductColumns.join(", ")}`);
    console.log(`Colunas de orders em falta: ${missingOrderColumns.join(", ")}`);
    console.log(`Colunas de settings em falta: ${missingSettingsColumns.join(", ")}`);
    console.log(`Colunas de order_stats em falta: ${missingOrderStatsColumns.join(", ")}`);
    console.log(`Colunas de notification_jobs em falta: ${missingNotificationJobColumns.join(", ")}`);
    console.log(`Colunas de public_snapshots em falta: ${missingPublicSnapshotColumns.join(", ")}`);
    console.log(`Colunas de plan_activation_events em falta: ${missingPlanEventColumns.join(", ")}`);
    console.log(`Colunas de plan_activation_requests em falta: ${missingPlanRequestColumns.join(", ")}`);
    console.log(`Colunas de plan_payment_proofs em falta: ${missingPlanProofColumns.join(", ")}`);
    console.log(`Tabelas em falta: ${missingTables.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log("Schema OK: colunas da empresa, utilizadores, produtos, pedidos, snapshots públicos, filas de notificacao, estatisticas, configuracoes, planos, comprovativos, eventos financeiros, controlos de seguranca e reset de password estao presentes.");
}

main()
  .catch((error) => {
    console.error("Falha ao verificar o schema da tabela catalog_stores.");
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const pool = getPool();
    await pool.end().catch(() => {});
  });
