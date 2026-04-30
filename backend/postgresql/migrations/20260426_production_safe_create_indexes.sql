-- Apply this file with autocommit enabled.
-- Do not wrap it in BEGIN/COMMIT because CREATE INDEX CONCURRENTLY
-- cannot run inside a transaction block.
-- The pg_trgm extension must already exist before running the trigram indexes below.

create unique index concurrently if not exists idx_catalog_users_email_lower
  on public.catalog_users (lower(email));

create index concurrently if not exists idx_catalog_stores_plan
  on public.catalog_stores (plan_id, plan_status);

create index concurrently if not exists idx_catalog_users_deleted_at
  on public.catalog_users (deleted_at);

create index concurrently if not exists idx_catalog_stores_deleted_at
  on public.catalog_stores (deleted_at);

create index concurrently if not exists idx_catalog_users_active_created_at_id
  on public.catalog_users (created_at desc, id desc)
  where deleted_at is null;

create index concurrently if not exists idx_catalog_users_deleted_at_id
  on public.catalog_users (deleted_at desc, id desc)
  where deleted_at is not null;

create index concurrently if not exists idx_catalog_stores_active_plan_started_owner
  on public.catalog_stores (plan_started_at desc, owner_user_id)
  where deleted_at is null
    and plan_started_at is not null;

create index concurrently if not exists idx_catalog_stores_deleted_at_owner
  on public.catalog_stores (deleted_at desc, owner_user_id)
  where deleted_at is not null;

create index concurrently if not exists idx_catalog_users_email_trgm
  on public.catalog_users using gin ((lower(email)) gin_trgm_ops)
  where deleted_at is null;

create index concurrently if not exists idx_catalog_users_full_name_trgm
  on public.catalog_users using gin ((lower(full_name)) gin_trgm_ops)
  where deleted_at is null
    and btrim(full_name) <> '';

create index concurrently if not exists idx_catalog_stores_name_trgm
  on public.catalog_stores using gin ((lower(name)) gin_trgm_ops)
  where deleted_at is null
    and btrim(name) <> '';

create index concurrently if not exists idx_catalog_stores_reference_id_trgm
  on public.catalog_stores using gin ((lower(reference_id)) gin_trgm_ops)
  where deleted_at is null
    and reference_id is not null
    and btrim(reference_id) <> '';

create index concurrently if not exists idx_catalog_plan_definitions_name_trgm
  on public.catalog_plan_definitions using gin ((lower(name)) gin_trgm_ops)
  where btrim(name) <> '';

create index concurrently if not exists idx_catalog_plan_definitions_code_trgm
  on public.catalog_plan_definitions using gin ((lower(code)) gin_trgm_ops)
  where btrim(code) <> '';

create index concurrently if not exists idx_catalog_stores_business_email_lookup
  on public.catalog_stores ((lower(business_email)))
  where deleted_at is null
    and business_email is not null
    and btrim(business_email) <> '';

create index concurrently if not exists idx_catalog_stores_tax_id_lookup
  on public.catalog_stores ((lower(regexp_replace(tax_id, '[^a-zA-Z0-9]+', '', 'g'))))
  where deleted_at is null
    and tax_id is not null
    and btrim(tax_id) <> '';

create unique index concurrently if not exists idx_catalog_stores_business_email_unique_active
  on public.catalog_stores ((lower(business_email)))
  where deleted_at is null
    and business_email is not null
    and btrim(business_email) <> '';

create unique index concurrently if not exists idx_catalog_stores_tax_id_unique_active
  on public.catalog_stores ((lower(regexp_replace(tax_id, '[^a-zA-Z0-9]+', '', 'g'))))
  where deleted_at is null
    and tax_id is not null
    and btrim(tax_id) <> '';

create unique index concurrently if not exists idx_catalog_plan_definitions_code
  on public.catalog_plan_definitions (code);

create index concurrently if not exists idx_catalog_plan_activation_events_recorded_at
  on public.catalog_plan_activation_events (recorded_at desc);

create index concurrently if not exists idx_catalog_plan_activation_events_plan_started_at
  on public.catalog_plan_activation_events (plan_started_at desc);

create index concurrently if not exists idx_catalog_plan_activation_events_store
  on public.catalog_plan_activation_events (store_id, plan_started_at desc);

create index concurrently if not exists idx_catalog_plan_activation_events_sort_cursor
  on public.catalog_plan_activation_events ((coalesce(plan_started_at, recorded_at)) desc, id desc);

create index concurrently if not exists idx_catalog_plan_activation_requests_status_requested_at
  on public.catalog_plan_activation_requests (status, requested_at desc);

drop index concurrently if exists idx_catalog_plan_activation_requests_store_pending;

create index concurrently if not exists idx_catalog_plan_activation_requests_store_open
  on public.catalog_plan_activation_requests (store_id, requested_at desc)
  where status in ('pending_payment', 'proof_submitted', 'under_review', 'needs_correction');

create index concurrently if not exists idx_catalog_plan_payment_proofs_request_submitted_at
  on public.catalog_plan_payment_proofs (request_id, submitted_at desc);

create index concurrently if not exists idx_catalog_products_store
  on public.catalog_products (catalog_id);

create index concurrently if not exists idx_catalog_products_category
  on public.catalog_products (catalog_id, category);

create index concurrently if not exists idx_catalog_products_featured
  on public.catalog_products (catalog_id, featured);

create unique index concurrently if not exists idx_catalog_stores_owner_user
  on public.catalog_stores (owner_user_id)
  where owner_user_id is not null;

create index concurrently if not exists idx_catalog_orders_store
  on public.catalog_orders (store_id, created_at desc);

create index concurrently if not exists idx_catalog_orders_status
  on public.catalog_orders (store_id, status, created_at desc);

create index concurrently if not exists idx_catalog_orders_customer
  on public.catalog_orders (store_id, customer_key, created_at desc);

create unique index concurrently if not exists idx_catalog_orders_tracking_code
  on public.catalog_orders (tracking_code);

create unique index concurrently if not exists idx_catalog_orders_tracking_token
  on public.catalog_orders (tracking_token);

create index concurrently if not exists idx_catalog_order_customers_store
  on public.catalog_order_customers (store_id, updated_at desc);

create index concurrently if not exists idx_catalog_order_items_order
  on public.catalog_order_items (order_id, created_at asc);

create index concurrently if not exists idx_catalog_order_stats_updated_at
  on public.catalog_order_stats (updated_at desc);

create index concurrently if not exists idx_catalog_notification_jobs_claim
  on public.catalog_notification_jobs (type, status, available_at asc, created_at asc);

create index concurrently if not exists idx_catalog_notification_jobs_processing
  on public.catalog_notification_jobs (status, locked_at asc)
  where status = 'processing';

create index concurrently if not exists idx_catalog_sessions_user
  on public.catalog_sessions (user_id);

create index concurrently if not exists idx_catalog_sessions_expires_at
  on public.catalog_sessions (expires_at);

create index concurrently if not exists idx_catalog_auth_rate_limits_blocked_until
  on public.catalog_auth_rate_limits (blocked_until);

create index concurrently if not exists idx_catalog_password_reset_tokens_email
  on public.catalog_password_reset_tokens (email, expires_at);

create index concurrently if not exists idx_catalog_password_reset_tokens_lookup
  on public.catalog_password_reset_tokens (email, code_hash);

create index concurrently if not exists idx_catalog_password_reset_tokens_user
  on public.catalog_password_reset_tokens (user_id, expires_at);
