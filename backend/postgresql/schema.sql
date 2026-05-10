create extension if not exists pg_trgm;

create table if not exists public.catalog_users (
  id text primary key,
  email varchar(255) not null unique,
  password_hash text not null,
  full_name varchar(160) not null default '',
  avatar_url text not null default '',
  super_admin_access jsonb not null default '{"clientes": true, "equipa": false, "financeiro": false, "lixo": false, "planos": false, "configuracoes": false}'::jsonb,
  role varchar(24) not null default 'merchant',
  account_status varchar(24) not null default 'active',
  deleted_at timestamptz,
  deleted_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_catalog_users_email_lower
  on public.catalog_users (lower(email));

alter table if exists public.catalog_users
  add column if not exists role varchar(24);

alter table if exists public.catalog_users
  add column if not exists account_status varchar(24);

alter table if exists public.catalog_users
  add column if not exists deleted_at timestamptz;

alter table if exists public.catalog_users
  add column if not exists deleted_by_user_id text;

alter table if exists public.catalog_users
  add column if not exists avatar_url text;

alter table if exists public.catalog_users
  add column if not exists super_admin_access jsonb;

update public.catalog_users
set role = 'merchant'
where role is null
   or btrim(role) = '';

update public.catalog_users
set account_status = 'active'
where account_status is null
   or btrim(account_status) = '';

update public.catalog_users
set avatar_url = ''
where avatar_url is null;

update public.catalog_users
set super_admin_access = '{"clientes": true, "equipa": false, "financeiro": false, "lixo": false, "planos": false, "configuracoes": false}'::jsonb
where super_admin_access is null
   or jsonb_typeof(super_admin_access) <> 'object';

alter table if exists public.catalog_users
  alter column role set default 'merchant';

alter table if exists public.catalog_users
  alter column role set not null;

alter table if exists public.catalog_users
  alter column account_status set default 'active';

alter table if exists public.catalog_users
  alter column account_status set not null;

alter table if exists public.catalog_users
  alter column avatar_url set default '';

alter table if exists public.catalog_users
  alter column avatar_url set not null;

alter table if exists public.catalog_users
  alter column super_admin_access set default '{"clientes": true, "equipa": false, "financeiro": false, "lixo": false, "planos": false, "configuracoes": false}'::jsonb;

alter table if exists public.catalog_users
  alter column super_admin_access set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_users_role_chk'
  ) then
    alter table public.catalog_users
      add constraint catalog_users_role_chk
      check (role in ('merchant', 'super_admin'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_users_super_admin_access_object_chk'
  ) then
    alter table public.catalog_users
      add constraint catalog_users_super_admin_access_object_chk
      check (jsonb_typeof(super_admin_access) = 'object');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_users_account_status_chk'
  ) then
    alter table public.catalog_users
      add constraint catalog_users_account_status_chk
      check (account_status in ('active', 'suspended'));
  end if;
end;
$$;

create table if not exists public.catalog_stores (
  id text primary key,
  owner_user_id text unique references public.catalog_users(id) on delete cascade,
  name varchar(160) not null default '',
  description text,
  whatsapp varchar(32),
  logo text,
  color varchar(16) not null default '#16a34a',
  currency_code varchar(3) not null default 'AOA',
  pickup_note varchar(255),
  whatsapp_order_format varchar(32) not null default 'text_only',
  public_enabled boolean not null default false,
  legal_name varchar(180),
  tax_id varchar(64),
  business_email varchar(255),
  business_phone varchar(32),
  address_line text,
  city varchar(120),
  country varchar(120),
  payment_method varchar(80) not null default '',
  payment_bank_name varchar(160) not null default '',
  payment_account_name varchar(160) not null default '',
  payment_account_number varchar(80) not null default '',
  payment_iban varchar(80) not null default '',
  public_slug varchar(63),
  custom_domain varchar(255),
  plan_id text,
  reference_id varchar(20),
  plan_status varchar(24) not null default 'trial',
  plan_started_at timestamptz,
  plan_expires_at timestamptz,
  plan_duration_days integer,
  plan_total_price numeric(10, 2),
  internal_notes text,
  deleted_at timestamptz,
  deleted_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.catalog_stores
  add column if not exists owner_user_id text references public.catalog_users(id) on delete cascade;

alter table if exists public.catalog_stores
  add column if not exists currency_code varchar(3);

alter table if exists public.catalog_stores
  add column if not exists public_enabled boolean;

alter table if exists public.catalog_stores
  add column if not exists whatsapp_order_format varchar(32);

alter table if exists public.catalog_stores
  add column if not exists legal_name varchar(180);

alter table if exists public.catalog_stores
  add column if not exists tax_id varchar(64);

alter table if exists public.catalog_stores
  add column if not exists business_email varchar(255);

alter table if exists public.catalog_stores
  add column if not exists business_phone varchar(32);

alter table if exists public.catalog_stores
  add column if not exists address_line text;

alter table if exists public.catalog_stores
  add column if not exists city varchar(120);

alter table if exists public.catalog_stores
  add column if not exists country varchar(120);

alter table if exists public.catalog_stores
  add column if not exists payment_method varchar(80) not null default '';

alter table if exists public.catalog_stores
  add column if not exists payment_bank_name varchar(160) not null default '';

alter table if exists public.catalog_stores
  add column if not exists payment_account_name varchar(160) not null default '';

alter table if exists public.catalog_stores
  add column if not exists payment_account_number varchar(80) not null default '';

alter table if exists public.catalog_stores
  add column if not exists payment_iban varchar(80) not null default '';

alter table if exists public.catalog_stores
  add column if not exists public_slug varchar(63);

alter table if exists public.catalog_stores
  add column if not exists custom_domain varchar(255);

alter table if exists public.catalog_stores
  add column if not exists plan_id text;

alter table if exists public.catalog_stores
  add column if not exists reference_id varchar(20);

alter table if exists public.catalog_stores
  add column if not exists plan_status varchar(24);

alter table if exists public.catalog_stores
  add column if not exists plan_started_at timestamptz;

alter table if exists public.catalog_stores
  add column if not exists plan_expires_at timestamptz;

alter table if exists public.catalog_stores
  add column if not exists plan_duration_days integer;

alter table if exists public.catalog_stores
  add column if not exists plan_total_price numeric(10, 2);

alter table if exists public.catalog_stores
  add column if not exists internal_notes text;

alter table if exists public.catalog_stores
  add column if not exists deleted_at timestamptz;

alter table if exists public.catalog_stores
  add column if not exists deleted_by_user_id text;

update public.catalog_stores
set currency_code = 'AOA'
where currency_code is null
   or btrim(currency_code) = '';

update public.catalog_stores
set public_enabled = false
where public_enabled is null;

update public.catalog_stores
set whatsapp_order_format = 'text_only'
where whatsapp_order_format is null
   or btrim(whatsapp_order_format) = '';

update public.catalog_stores
set plan_status = 'trial'
where plan_status is null
   or btrim(plan_status) = '';

alter table if exists public.catalog_stores
  alter column currency_code set default 'AOA';

alter table if exists public.catalog_stores
  alter column currency_code set not null;

alter table if exists public.catalog_stores
  alter column public_enabled set default false;

alter table if exists public.catalog_stores
  alter column public_enabled set not null;

alter table if exists public.catalog_stores
  alter column whatsapp_order_format set default 'text_only';

alter table if exists public.catalog_stores
  alter column whatsapp_order_format set not null;

alter table if exists public.catalog_stores
  alter column plan_status set default 'trial';

alter table if exists public.catalog_stores
  alter column plan_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_stores_currency_code_chk'
  ) then
    alter table public.catalog_stores
      add constraint catalog_stores_currency_code_chk
      check (currency_code in ('AOA', 'BRL', 'USD', 'EUR'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_stores_whatsapp_order_format_chk'
  ) then
    alter table public.catalog_stores
      add constraint catalog_stores_whatsapp_order_format_chk
      check (whatsapp_order_format in ('text_only', 'with_image_links'));
  end if;
end;
$$;

alter table if exists public.catalog_stores
  drop constraint if exists catalog_stores_plan_duration_chk;

alter table public.catalog_stores
  add constraint catalog_stores_plan_duration_chk
  check (
    plan_duration_days is null
    or plan_duration_days = 7
    or (
      plan_duration_days >= 30
      and mod(plan_duration_days, 30) = 0
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_stores_plan_total_price_chk'
  ) then
    alter table public.catalog_stores
      add constraint catalog_stores_plan_total_price_chk
      check (plan_total_price is null or plan_total_price >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_stores_plan_status_chk'
  ) then
    alter table public.catalog_stores
      add constraint catalog_stores_plan_status_chk
      check (plan_status in ('trial', 'active', 'past_due', 'canceled'));
  end if;
end;
$$;

create unique index if not exists idx_catalog_stores_public_slug_lower
  on public.catalog_stores (lower(public_slug))
  where public_slug is not null
    and btrim(public_slug) <> '';

create unique index if not exists idx_catalog_stores_custom_domain_lower
  on public.catalog_stores (lower(custom_domain))
  where custom_domain is not null
    and btrim(custom_domain) <> '';

create table if not exists public.catalog_plan_definitions (
  id text primary key,
  code varchar(64) not null unique,
  name varchar(120) not null,
  description text,
  price_monthly numeric(10, 2) not null default 0,
  currency_code varchar(3) not null default 'AOA',
  max_products integer,
  max_team_members integer,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_definitions_code_not_blank_chk'
  ) then
    alter table public.catalog_plan_definitions
      add constraint catalog_plan_definitions_code_not_blank_chk
      check (btrim(code) <> '');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_definitions_name_not_blank_chk'
  ) then
    alter table public.catalog_plan_definitions
      add constraint catalog_plan_definitions_name_not_blank_chk
      check (btrim(name) <> '');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_definitions_price_nonnegative_chk'
  ) then
    alter table public.catalog_plan_definitions
      add constraint catalog_plan_definitions_price_nonnegative_chk
      check (price_monthly >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_definitions_products_nonnegative_chk'
  ) then
    alter table public.catalog_plan_definitions
      add constraint catalog_plan_definitions_products_nonnegative_chk
      check (max_products is null or max_products >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_definitions_team_nonnegative_chk'
  ) then
    alter table public.catalog_plan_definitions
      add constraint catalog_plan_definitions_team_nonnegative_chk
      check (max_team_members is null or max_team_members >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_definitions_currency_code_chk'
  ) then
    alter table public.catalog_plan_definitions
      add constraint catalog_plan_definitions_currency_code_chk
      check (currency_code in ('AOA', 'BRL', 'USD', 'EUR'));
  end if;
end;
$$;

alter table if exists public.catalog_stores
  drop constraint if exists catalog_stores_plan_id_fkey;

alter table public.catalog_stores
  add constraint catalog_stores_plan_id_fkey
  foreign key (plan_id) references public.catalog_plan_definitions(id) on delete set null;

create index if not exists idx_catalog_stores_plan
  on public.catalog_stores (plan_id, plan_status);

create index if not exists idx_catalog_users_deleted_at
  on public.catalog_users (deleted_at);

create index if not exists idx_catalog_stores_deleted_at
  on public.catalog_stores (deleted_at);

create index if not exists idx_catalog_users_active_created_at_id
  on public.catalog_users (created_at desc, id desc)
  where deleted_at is null;

create index if not exists idx_catalog_users_deleted_at_id
  on public.catalog_users (deleted_at desc, id desc)
  where deleted_at is not null;

create index if not exists idx_catalog_stores_active_plan_started_owner
  on public.catalog_stores (plan_started_at desc, owner_user_id)
  where deleted_at is null
    and plan_started_at is not null;

create index if not exists idx_catalog_stores_deleted_at_owner
  on public.catalog_stores (deleted_at desc, owner_user_id)
  where deleted_at is not null;

create index if not exists idx_catalog_users_email_trgm
  on public.catalog_users using gin ((lower(email)) gin_trgm_ops)
  where deleted_at is null;

create index if not exists idx_catalog_users_full_name_trgm
  on public.catalog_users using gin ((lower(full_name)) gin_trgm_ops)
  where deleted_at is null
    and btrim(full_name) <> '';

create index if not exists idx_catalog_stores_name_trgm
  on public.catalog_stores using gin ((lower(name)) gin_trgm_ops)
  where deleted_at is null
    and btrim(name) <> '';

create index if not exists idx_catalog_stores_reference_id_trgm
  on public.catalog_stores using gin ((lower(reference_id)) gin_trgm_ops)
  where deleted_at is null
    and reference_id is not null
    and btrim(reference_id) <> '';

create index if not exists idx_catalog_plan_definitions_name_trgm
  on public.catalog_plan_definitions using gin ((lower(name)) gin_trgm_ops)
  where btrim(name) <> '';

create index if not exists idx_catalog_plan_definitions_code_trgm
  on public.catalog_plan_definitions using gin ((lower(code)) gin_trgm_ops)
  where btrim(code) <> '';

create index if not exists idx_catalog_stores_business_email_lookup
  on public.catalog_stores ((lower(business_email)))
  where deleted_at is null
    and business_email is not null
    and btrim(business_email) <> '';

create index if not exists idx_catalog_stores_tax_id_lookup
  on public.catalog_stores ((lower(regexp_replace(tax_id, '[^a-zA-Z0-9]+', '', 'g'))))
  where deleted_at is null
    and tax_id is not null
    and btrim(tax_id) <> '';

create unique index if not exists idx_catalog_stores_business_email_unique_active
  on public.catalog_stores ((lower(business_email)))
  where deleted_at is null
    and business_email is not null
    and btrim(business_email) <> '';

create index if not exists idx_catalog_stores_business_phone_lookup
  on public.catalog_stores (business_phone)
  where deleted_at is null
    and business_phone is not null
    and btrim(business_phone) <> '';

create index if not exists idx_catalog_stores_whatsapp_lookup
  on public.catalog_stores (whatsapp)
  where deleted_at is null
    and whatsapp is not null
    and btrim(whatsapp) <> '';

create unique index if not exists idx_catalog_stores_business_phone_unique_active
  on public.catalog_stores (business_phone)
  where deleted_at is null
    and business_phone is not null
    and btrim(business_phone) <> '';

create unique index if not exists idx_catalog_stores_whatsapp_unique_active
  on public.catalog_stores (whatsapp)
  where deleted_at is null
    and whatsapp is not null
    and btrim(whatsapp) <> '';

create unique index if not exists idx_catalog_stores_tax_id_unique_active
  on public.catalog_stores ((lower(regexp_replace(tax_id, '[^a-zA-Z0-9]+', '', 'g'))))
  where deleted_at is null
    and tax_id is not null
    and btrim(tax_id) <> '';

create unique index if not exists idx_catalog_plan_definitions_code
  on public.catalog_plan_definitions (code);

create table if not exists public.catalog_plan_activation_events (
  id text primary key,
  store_id text not null references public.catalog_stores(id) on delete cascade,
  user_id text not null references public.catalog_users(id) on delete cascade,
  recorded_by_user_id text references public.catalog_users(id) on delete set null,
  plan_id text not null references public.catalog_plan_definitions(id) on delete restrict,
  event_type varchar(24) not null default 'activation',
  plan_code varchar(64) not null default '',
  plan_name varchar(120) not null default '',
  store_name varchar(160) not null default '',
  merchant_email varchar(255) not null default '',
  reference_id varchar(20) not null default '',
  plan_status varchar(24) not null default 'active',
  duration_days integer not null default 30,
  total_price numeric(10, 2) not null default 0,
  currency_code varchar(3) not null default 'AOA',
  plan_started_at timestamptz not null,
  plan_expires_at timestamptz not null,
  recorded_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_activation_events_type_chk'
  ) then
    alter table public.catalog_plan_activation_events
      add constraint catalog_plan_activation_events_type_chk
      check (event_type in ('activation', 'renewal', 'plan_change', 'backfill'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_activation_events_status_chk'
  ) then
    alter table public.catalog_plan_activation_events
      add constraint catalog_plan_activation_events_status_chk
      check (plan_status in ('trial', 'active', 'past_due', 'canceled'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_activation_events_total_price_chk'
  ) then
    alter table public.catalog_plan_activation_events
      add constraint catalog_plan_activation_events_total_price_chk
      check (total_price >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_activation_events_duration_chk'
  ) then
    alter table public.catalog_plan_activation_events
      add constraint catalog_plan_activation_events_duration_chk
      check (duration_days >= 1);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_activation_events_currency_code_chk'
  ) then
    alter table public.catalog_plan_activation_events
      add constraint catalog_plan_activation_events_currency_code_chk
      check (currency_code in ('AOA', 'BRL', 'USD', 'EUR'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_plan_activation_events_period_unique'
  ) then
    alter table public.catalog_plan_activation_events
      add constraint catalog_plan_activation_events_period_unique
      unique (store_id, plan_id, plan_started_at, plan_expires_at, total_price);
  end if;
end;
$$;

create index if not exists idx_catalog_plan_activation_events_recorded_at
  on public.catalog_plan_activation_events (recorded_at desc);

create index if not exists idx_catalog_plan_activation_events_plan_started_at
  on public.catalog_plan_activation_events (plan_started_at desc);

create index if not exists idx_catalog_plan_activation_events_store
  on public.catalog_plan_activation_events (store_id, plan_started_at desc);

create index if not exists idx_catalog_plan_activation_events_sort_cursor
  on public.catalog_plan_activation_events ((coalesce(plan_started_at, recorded_at)) desc, id desc);

create table if not exists public.catalog_plan_activation_requests (
  id text primary key,
  store_id text not null references public.catalog_stores(id) on delete cascade,
  user_id text not null references public.catalog_users(id) on delete cascade,
  plan_id text not null references public.catalog_plan_definitions(id) on delete restrict,
  resolved_by_user_id text references public.catalog_users(id) on delete set null,
  activated_by_user_id text references public.catalog_users(id) on delete set null,
  plan_code varchar(64) not null default '',
  plan_name varchar(120) not null default '',
  store_name varchar(160) not null default '',
  merchant_email varchar(255) not null default '',
  reference_id varchar(20) not null default '',
  store_whatsapp varchar(32) not null default '',
  product_count integer not null default 0,
  current_plan_status varchar(24) not null default 'trial',
  current_plan_name varchar(120) not null default '',
  duration_days integer not null default 30,
  total_price numeric(10, 2) not null default 0,
  currency_code varchar(3) not null default 'AOA',
  message_text text not null default '',
  whatsapp_link text not null default '',
  payment_reference varchar(64) not null default '',
  payment_method varchar(80) not null default '',
  payment_instructions text not null default '',
  payment_bank_name varchar(160) not null default '',
  payment_account_name varchar(160) not null default '',
  payment_account_number varchar(80) not null default '',
  payment_iban varchar(80) not null default '',
  payment_proof_status varchar(24) not null default 'not_submitted',
  merchant_note text not null default '',
  review_note text not null default '',
  paid_amount numeric(10, 2),
  paid_currency_code varchar(3) not null default 'AOA',
  paid_at timestamptz,
  payment_due_at timestamptz,
  last_proof_submitted_at timestamptz,
  status varchar(24) not null default 'pending_payment',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  activated_at timestamptz
);

alter table public.catalog_plan_activation_requests
  add column if not exists activated_by_user_id text references public.catalog_users(id) on delete set null,
  add column if not exists payment_reference varchar(64) not null default '',
  add column if not exists payment_method varchar(80) not null default '',
  add column if not exists payment_instructions text not null default '',
  add column if not exists payment_bank_name varchar(160) not null default '',
  add column if not exists payment_account_name varchar(160) not null default '',
  add column if not exists payment_account_number varchar(80) not null default '',
  add column if not exists payment_iban varchar(80) not null default '',
  add column if not exists payment_proof_status varchar(24) not null default 'not_submitted',
  add column if not exists merchant_note text not null default '',
  add column if not exists review_note text not null default '',
  add column if not exists paid_amount numeric(10, 2),
  add column if not exists paid_currency_code varchar(3) not null default 'AOA',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_due_at timestamptz,
  add column if not exists last_proof_submitted_at timestamptz,
  add column if not exists activated_at timestamptz;

update public.catalog_plan_activation_requests
set status = case
  when status = 'pending' then 'pending_payment'
  when status = 'resolved' then 'activated'
  when status = 'dismissed' then 'rejected'
  else status
end
where status in ('pending', 'resolved', 'dismissed');

update public.catalog_plan_activation_requests
set payment_proof_status = case
  when status = 'activated' then 'accepted'
  when status = 'rejected' then 'rejected'
  when status = 'under_review' then 'reviewing'
  when status = 'proof_submitted' then 'submitted'
  else 'not_submitted'
end
where coalesce(payment_proof_status, '') = '';

alter table public.catalog_plan_activation_requests
  drop constraint if exists catalog_plan_activation_requests_status_chk;

alter table public.catalog_plan_activation_requests
  add constraint catalog_plan_activation_requests_status_chk
  check (status in ('pending_payment', 'proof_submitted', 'under_review', 'needs_correction', 'activated', 'rejected', 'expired'));

alter table public.catalog_plan_activation_requests
  drop constraint if exists catalog_plan_activation_requests_current_status_chk;

alter table public.catalog_plan_activation_requests
  add constraint catalog_plan_activation_requests_current_status_chk
  check (current_plan_status in ('trial', 'active', 'past_due', 'canceled'));

alter table public.catalog_plan_activation_requests
  drop constraint if exists catalog_plan_activation_requests_total_price_chk;

alter table public.catalog_plan_activation_requests
  add constraint catalog_plan_activation_requests_total_price_chk
  check (total_price >= 0);

alter table public.catalog_plan_activation_requests
  drop constraint if exists catalog_plan_activation_requests_duration_chk;

alter table public.catalog_plan_activation_requests
  add constraint catalog_plan_activation_requests_duration_chk
  check (duration_days >= 1);

alter table public.catalog_plan_activation_requests
  drop constraint if exists catalog_plan_activation_requests_currency_code_chk;

alter table public.catalog_plan_activation_requests
  add constraint catalog_plan_activation_requests_currency_code_chk
  check (currency_code in ('AOA', 'BRL', 'USD', 'EUR'));

alter table public.catalog_plan_activation_requests
  drop constraint if exists catalog_plan_activation_requests_product_count_chk;

alter table public.catalog_plan_activation_requests
  add constraint catalog_plan_activation_requests_product_count_chk
  check (product_count >= 0);

alter table public.catalog_plan_activation_requests
  drop constraint if exists catalog_plan_activation_requests_payment_proof_status_chk;

alter table public.catalog_plan_activation_requests
  add constraint catalog_plan_activation_requests_payment_proof_status_chk
  check (payment_proof_status in ('not_submitted', 'submitted', 'reviewing', 'accepted', 'rejected'));

alter table public.catalog_plan_activation_requests
  drop constraint if exists catalog_plan_activation_requests_paid_amount_chk;

alter table public.catalog_plan_activation_requests
  add constraint catalog_plan_activation_requests_paid_amount_chk
  check (paid_amount is null or paid_amount >= 0);

alter table public.catalog_plan_activation_requests
  drop constraint if exists catalog_plan_activation_requests_paid_currency_code_chk;

alter table public.catalog_plan_activation_requests
  add constraint catalog_plan_activation_requests_paid_currency_code_chk
  check (paid_currency_code in ('AOA', 'BRL', 'USD', 'EUR'));

create index if not exists idx_catalog_plan_activation_requests_status_requested_at
  on public.catalog_plan_activation_requests (status, requested_at desc);

create index if not exists idx_catalog_plan_activation_requests_store_open
  on public.catalog_plan_activation_requests (store_id, requested_at desc)
  where status in ('pending_payment', 'proof_submitted', 'under_review', 'needs_correction');

create table if not exists public.catalog_plan_payment_proofs (
  id text primary key,
  request_id text not null references public.catalog_plan_activation_requests(id) on delete cascade,
  submitted_by_user_id text not null references public.catalog_users(id) on delete cascade,
  reviewed_by_user_id text references public.catalog_users(id) on delete set null,
  original_file_name varchar(255) not null default '',
  mime_type varchar(120) not null default '',
  size_bytes integer not null default 0,
  storage_bucket varchar(120) not null default '',
  storage_path text not null default '',
  payer_name varchar(160) not null default '',
  payer_phone varchar(32) not null default '',
  payment_reference_text varchar(120) not null default '',
  paid_amount numeric(10, 2),
  paid_currency_code varchar(3) not null default 'AOA',
  paid_at timestamptz,
  note text not null default '',
  review_status varchar(24) not null default 'submitted',
  review_note text not null default '',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.catalog_plan_payment_proofs
  drop constraint if exists catalog_plan_payment_proofs_size_bytes_chk;

alter table public.catalog_plan_payment_proofs
  add constraint catalog_plan_payment_proofs_size_bytes_chk
  check (size_bytes >= 0);

alter table public.catalog_plan_payment_proofs
  drop constraint if exists catalog_plan_payment_proofs_paid_amount_chk;

alter table public.catalog_plan_payment_proofs
  add constraint catalog_plan_payment_proofs_paid_amount_chk
  check (paid_amount is null or paid_amount >= 0);

alter table public.catalog_plan_payment_proofs
  drop constraint if exists catalog_plan_payment_proofs_paid_currency_code_chk;

alter table public.catalog_plan_payment_proofs
  add constraint catalog_plan_payment_proofs_paid_currency_code_chk
  check (paid_currency_code in ('AOA', 'BRL', 'USD', 'EUR'));

alter table public.catalog_plan_payment_proofs
  drop constraint if exists catalog_plan_payment_proofs_review_status_chk;

alter table public.catalog_plan_payment_proofs
  add constraint catalog_plan_payment_proofs_review_status_chk
  check (review_status in ('submitted', 'reviewing', 'accepted', 'rejected'));

create index if not exists idx_catalog_plan_payment_proofs_request_submitted_at
  on public.catalog_plan_payment_proofs (request_id, submitted_at desc);

create table if not exists public.catalog_settings (
  key text primary key,
  value text not null,
  category varchar(64) not null default 'general',
  description text,
  updated_at timestamptz not null default now()
);

insert into public.catalog_settings (key, value, category, description) values
  ('support_whatsapp', '244900000000', 'general', 'Número de WhatsApp para suporte e vendas.'),
  ('trial_days', '7', 'plans', 'Quantidade de dias de teste gratuito para novos lojistas.'),
  ('maintenance_mode', 'false', 'system', 'Se "true", bloqueia o acesso público a todos os catálogos.'),
  ('merchant_registration_enabled', 'true', 'system', 'Se "false", bloqueia novos cadastros publicos de lojistas.'),
  ('max_free_products', '10', 'plans', 'Limite de produtos para o plano Trial.'),
  ('payment_proof_deadline_hours', '72', 'payments', 'Prazo em horas para envio do comprovativo do plano.'),
  ('payment_method_label', 'Transferencia bancaria', 'payments', 'Nome do metodo de pagamento mostrado ao lojista.'),
  ('payment_instructions', '', 'payments', 'Instrucoes para pagamento do plano.'),
  ('payment_bank_name', '', 'payments', 'Banco que recebe os pagamentos dos planos.'),
  ('payment_account_name', '', 'payments', 'Nome da conta que recebe os pagamentos dos planos.'),
  ('payment_account_number', '', 'payments', 'Numero da conta usada nos pagamentos dos planos.'),
  ('payment_iban', '', 'payments', 'IBAN ou referencia bancaria usada para pagamento dos planos.')
on conflict (key) do nothing;

insert into public.catalog_plan_definitions (
  id,
  code,
  name,
  description,
  price_monthly,
  currency_code,
  max_products,
  max_team_members,
  active,
  sort_order
) values
  ('trial', 'trial', 'Plano Zero (Teste)', 'Periodo de degustacao gratuita para novos lojistas.', 0, 'AOA', 10, 1, true, 0),
  ('starter', 'starter', 'Starter', 'Plano base para operacao inicial e validacao do catalogo.', 5000, 'AOA', 50, 1, true, 10),
  ('pro', 'pro', 'Pro', 'Plano para lojas com catalogo maior e operacao recorrente.', 5000, 'AOA', 250, 3, true, 20),
  ('scale', 'scale', 'Scale', 'Plano para lojas com maior volume, equipa e crescimento.', 5000, 'AOA', 1000, 10, true, 30)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  description = excluded.description,
  price_monthly = excluded.price_monthly,
  currency_code = excluded.currency_code,
  max_products = excluded.max_products,
  max_team_members = excluded.max_team_members,
  active = excluded.active,
  sort_order = excluded.sort_order;

update public.catalog_stores
set plan_id = 'starter'
where plan_id is null
  and owner_user_id is not null;

insert into public.catalog_plan_activation_events (
  id,
  store_id,
  user_id,
  recorded_by_user_id,
  plan_id,
  event_type,
  plan_code,
  plan_name,
  store_name,
  merchant_email,
  reference_id,
  plan_status,
  duration_days,
  total_price,
  currency_code,
  plan_started_at,
  plan_expires_at,
  recorded_at
)
select
  concat(
    'evt_backfill_',
    stores.id,
    '_',
    stores.plan_id,
    '_',
    to_char(stores.plan_started_at at time zone 'UTC', 'YYYYMMDDHH24MISSMS')
  ) as id,
  stores.id,
  users.id,
  null,
  stores.plan_id,
  'backfill',
  coalesce(plans.code, ''),
  coalesce(plans.name, 'Plano ativo'),
  coalesce(stores.name, users.full_name, users.email, ''),
  coalesce(users.email, ''),
  coalesce(stores.reference_id, ''),
  stores.plan_status,
  greatest(coalesce(stores.plan_duration_days, 30), 1),
  coalesce(stores.plan_total_price, 0),
  coalesce(plans.currency_code, stores.currency_code, 'AOA'),
  stores.plan_started_at,
  stores.plan_expires_at,
  coalesce(stores.plan_started_at, stores.created_at, now())
from public.catalog_stores stores
join public.catalog_users users
  on users.id = stores.owner_user_id
left join public.catalog_plan_definitions plans
  on plans.id = stores.plan_id
where stores.deleted_at is null
  and users.deleted_at is null
  and stores.plan_id is not null
  and stores.plan_status = 'active'
  and coalesce(stores.plan_total_price, 0) > 0
  and stores.plan_started_at is not null
  and stores.plan_expires_at is not null
on conflict on constraint catalog_plan_activation_events_period_unique do nothing;

alter table if exists public.catalog_stores
  drop constraint if exists catalog_stores_logo_public_url_chk;

alter table if exists public.catalog_stores
  drop constraint if exists catalog_stores_logo_length_chk;

alter table public.catalog_stores
  add constraint catalog_stores_logo_length_chk
  check (logo is null or char_length(logo) <= 400000);

create table if not exists public.catalog_products (
  id text primary key,
  catalog_id text not null references public.catalog_stores(id) on delete cascade,
  name varchar(180) not null,
  description text,
  price numeric(10, 2) not null default 0,
  compare_at numeric(10, 2) not null default 0,
  image text,
  images jsonb not null default '[]'::jsonb,
  category varchar(120),
  stock integer,
  featured boolean not null default false,
  on_promotion boolean not null default false,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.catalog_products
  add column if not exists images jsonb;

alter table if exists public.catalog_products
  add column if not exists on_promotion boolean;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_products_name_not_blank_chk'
  ) then
    alter table public.catalog_products
      add constraint catalog_products_name_not_blank_chk
      check (btrim(name) <> '');
  end if;
end;
$$;

update public.catalog_products
set images = case
  when image is not null and btrim(image) <> '' then jsonb_build_array(image)
  else '[]'::jsonb
end
where images is null
   or jsonb_typeof(images) <> 'array'
   or (
     image is not null
     and btrim(image) <> ''
     and case
       when jsonb_typeof(images) = 'array' then jsonb_array_length(images) = 0
       else false
     end
   );

update public.catalog_products
set image = images ->> 0
where (image is null or btrim(image) = '')
  and images is not null
  and case
    when jsonb_typeof(images) = 'array' then jsonb_array_length(images) > 0
    else false
  end;

update public.catalog_products
set on_promotion = false
where on_promotion is null;

update public.catalog_products
set on_promotion = true
where compare_at > price;

alter table if exists public.catalog_products
  alter column images set default '[]'::jsonb;

alter table if exists public.catalog_products
  alter column images set not null;

alter table if exists public.catalog_products
  alter column on_promotion set default false;

alter table if exists public.catalog_products
  alter column on_promotion set not null;

alter table if exists public.catalog_products
  drop constraint if exists catalog_products_image_public_url_chk;

alter table if exists public.catalog_products
  drop constraint if exists catalog_products_image_length_chk;

alter table if exists public.catalog_products
  drop constraint if exists catalog_products_images_array_chk;

alter table if exists public.catalog_products
  drop constraint if exists catalog_products_images_length_chk;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_products_image_length_chk'
  ) then
    alter table public.catalog_products
      add constraint catalog_products_image_length_chk
      check (image is null or char_length(image) <= 700000);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_products_images_array_chk'
  ) then
    alter table public.catalog_products
      add constraint catalog_products_images_array_chk
      check (
        images is not null
        and case
          when jsonb_typeof(images) = 'array' then jsonb_array_length(images) <= 4
          else false
        end
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_products_images_length_chk'
  ) then
    alter table public.catalog_products
      add constraint catalog_products_images_length_chk
      check (char_length(images::text) <= 2800000);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_products_price_nonnegative_chk'
  ) then
    alter table public.catalog_products
      add constraint catalog_products_price_nonnegative_chk
      check (price >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_products_compare_at_nonnegative_chk'
  ) then
    alter table public.catalog_products
      add constraint catalog_products_compare_at_nonnegative_chk
      check (compare_at >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_products_stock_nonnegative_chk'
  ) then
    alter table public.catalog_products
      add constraint catalog_products_stock_nonnegative_chk
      check (stock is null or stock >= 0);
  end if;
end;
$$;

create index if not exists idx_catalog_products_store
  on public.catalog_products (catalog_id);

create index if not exists idx_catalog_products_category
  on public.catalog_products (catalog_id, category);

create index if not exists idx_catalog_products_featured
  on public.catalog_products (catalog_id, featured);

create unique index if not exists idx_catalog_stores_owner_user
  on public.catalog_stores (owner_user_id)
  where owner_user_id is not null;

create table if not exists public.catalog_public_snapshots (
  store_id text primary key references public.catalog_stores(id) on delete cascade,
  response_body text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_orders (
  id text primary key,
  store_id text not null references public.catalog_stores(id) on delete cascade,
  tracking_code varchar(24) not null unique,
  tracking_token text not null unique,
  customer_name varchar(160) not null default '',
  customer_phone varchar(32) not null default '',
  customer_key text not null default '',
  fulfillment_type varchar(24) not null default 'delivery',
  region varchar(160) not null default '',
  area varchar(160) not null default '',
  pickup_time varchar(16) not null default '',
  delivery_time varchar(16) not null default '',
  notes text not null default '',
  status varchar(24) not null default 'pending',
  subtotal_amount numeric(10, 2) not null default 0,
  discount_percent numeric(5, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  total_amount numeric(10, 2) not null default 0,
  currency_code varchar(3) not null default 'AOA',
  item_count integer not null default 0,
  status_updated_at timestamptz not null default now(),
  status_timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.catalog_orders
  add column if not exists status_timeline jsonb;

alter table if exists public.catalog_orders
  add column if not exists customer_phone varchar(32) not null default '';

alter table if exists public.catalog_orders
  add column if not exists customer_key text not null default '';

alter table if exists public.catalog_orders
  add column if not exists subtotal_amount numeric(10, 2) not null default 0;

alter table if exists public.catalog_orders
  add column if not exists discount_percent numeric(5, 2) not null default 0;

alter table if exists public.catalog_orders
  add column if not exists discount_amount numeric(10, 2) not null default 0;

update public.catalog_orders
set status_timeline = '[]'::jsonb
where status_timeline is null
   or jsonb_typeof(status_timeline) <> 'array';

update public.catalog_orders
set subtotal_amount = coalesce(total_amount, 0)
where subtotal_amount is null
   or subtotal_amount = 0;

update public.catalog_orders
set discount_percent = 0
where discount_percent is null;

update public.catalog_orders
set discount_amount = 0
where discount_amount is null;

alter table if exists public.catalog_orders
  alter column status_timeline set default '[]'::jsonb;

alter table if exists public.catalog_orders
  alter column status_timeline set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_orders_tracking_code_not_blank_chk'
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_tracking_code_not_blank_chk
      check (btrim(tracking_code) <> '');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_orders_tracking_token_not_blank_chk'
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_tracking_token_not_blank_chk
      check (btrim(tracking_token) <> '');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_orders_fulfillment_type_chk'
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_fulfillment_type_chk
      check (fulfillment_type in ('delivery', 'pickup'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_orders_status_chk'
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_status_chk
      check (status in ('pending', 'in_progress', 'on_the_way', 'delivered'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_orders_status_timeline_array_chk'
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_status_timeline_array_chk
      check (jsonb_typeof(status_timeline) = 'array');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_orders_subtotal_amount_nonnegative_chk'
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_subtotal_amount_nonnegative_chk
      check (subtotal_amount >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_orders_discount_percent_range_chk'
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_discount_percent_range_chk
      check (discount_percent >= 0 and discount_percent <= 100);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_orders_discount_amount_nonnegative_chk'
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_discount_amount_nonnegative_chk
      check (discount_amount >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_orders_total_amount_nonnegative_chk'
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_total_amount_nonnegative_chk
      check (total_amount >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_orders_item_count_nonnegative_chk'
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_item_count_nonnegative_chk
      check (item_count >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_orders_currency_code_chk'
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_currency_code_chk
      check (currency_code in ('AOA', 'BRL', 'USD', 'EUR'));
  end if;
end;
$$;

create index if not exists idx_catalog_orders_store
  on public.catalog_orders (store_id, created_at desc);

create index if not exists idx_catalog_orders_status
  on public.catalog_orders (store_id, status, created_at desc);

create index if not exists idx_catalog_orders_customer
  on public.catalog_orders (store_id, customer_key, created_at desc);

create unique index if not exists idx_catalog_orders_tracking_code
  on public.catalog_orders (tracking_code);

create unique index if not exists idx_catalog_orders_tracking_token
  on public.catalog_orders (tracking_token);

create table if not exists public.catalog_order_customers (
  id text primary key,
  store_id text not null references public.catalog_stores(id) on delete cascade,
  customer_key text not null,
  customer_name varchar(160) not null default '',
  customer_phone varchar(32) not null default '',
  loyalty_discount_percent numeric(5, 2) not null default 0,
  order_count integer not null default 0,
  last_order_id text references public.catalog_orders(id) on delete set null,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, customer_key)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_customers_customer_key_not_blank_chk'
  ) then
    alter table public.catalog_order_customers
      add constraint catalog_order_customers_customer_key_not_blank_chk
      check (btrim(customer_key) <> '');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_customers_loyalty_discount_percent_chk'
  ) then
    alter table public.catalog_order_customers
      add constraint catalog_order_customers_loyalty_discount_percent_chk
      check (loyalty_discount_percent >= 0 and loyalty_discount_percent <= 100);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_customers_order_count_nonnegative_chk'
  ) then
    alter table public.catalog_order_customers
      add constraint catalog_order_customers_order_count_nonnegative_chk
      check (order_count >= 0);
  end if;
end;
$$;

create index if not exists idx_catalog_order_customers_store
  on public.catalog_order_customers (store_id, updated_at desc);

create table if not exists public.catalog_order_items (
  id text primary key,
  order_id text not null references public.catalog_orders(id) on delete cascade,
  product_id text,
  product_name varchar(180) not null,
  product_image text not null default '',
  unit_price numeric(10, 2) not null default 0,
  quantity integer not null default 1,
  line_total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_items_product_name_not_blank_chk'
  ) then
    alter table public.catalog_order_items
      add constraint catalog_order_items_product_name_not_blank_chk
      check (btrim(product_name) <> '');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_items_unit_price_nonnegative_chk'
  ) then
    alter table public.catalog_order_items
      add constraint catalog_order_items_unit_price_nonnegative_chk
      check (unit_price >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_items_quantity_positive_chk'
  ) then
    alter table public.catalog_order_items
      add constraint catalog_order_items_quantity_positive_chk
      check (quantity > 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_items_line_total_nonnegative_chk'
  ) then
    alter table public.catalog_order_items
      add constraint catalog_order_items_line_total_nonnegative_chk
      check (line_total >= 0);
  end if;
end;
$$;

create index if not exists idx_catalog_order_items_order
  on public.catalog_order_items (order_id, created_at asc);

create table if not exists public.catalog_store_reviews (
  id text primary key,
  store_id text not null references public.catalog_stores(id) on delete cascade,
  order_id text not null references public.catalog_orders(id) on delete cascade,
  customer_key text not null default '',
  customer_name varchar(160) not null default '',
  customer_phone varchar(32) not null default '',
  rating integer not null default 5,
  comment text not null default '',
  is_public boolean not null default true,
  is_featured boolean not null default false,
  featured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

alter table if exists public.catalog_store_reviews
  add column if not exists is_featured boolean;

alter table if exists public.catalog_store_reviews
  add column if not exists featured_at timestamptz;

update public.catalog_store_reviews
set is_featured = false
where is_featured is null;

alter table if exists public.catalog_store_reviews
  alter column is_featured set default false;

alter table if exists public.catalog_store_reviews
  alter column is_featured set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_store_reviews_order_id_not_blank_chk'
  ) then
    alter table public.catalog_store_reviews
      add constraint catalog_store_reviews_order_id_not_blank_chk
      check (btrim(order_id) <> '');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_store_reviews_rating_range_chk'
  ) then
    alter table public.catalog_store_reviews
      add constraint catalog_store_reviews_rating_range_chk
      check (rating >= 1 and rating <= 5);
  end if;
end;
$$;

create index if not exists idx_catalog_store_reviews_store
  on public.catalog_store_reviews (store_id, created_at desc);

create index if not exists idx_catalog_store_reviews_store_public
  on public.catalog_store_reviews (store_id, is_public, created_at desc);

create index if not exists idx_catalog_store_reviews_store_featured_public
  on public.catalog_store_reviews (
    store_id,
    is_public,
    is_featured,
    featured_at desc,
    updated_at desc,
    created_at desc
  );

create table if not exists public.catalog_order_stats (
  store_id text primary key references public.catalog_stores(id) on delete cascade,
  total_count integer not null default 0,
  pending_count integer not null default 0,
  in_progress_count integer not null default 0,
  on_the_way_count integer not null default 0,
  delivered_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_stats_total_count_chk'
  ) then
    alter table public.catalog_order_stats
      add constraint catalog_order_stats_total_count_chk
      check (total_count >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_stats_pending_count_chk'
  ) then
    alter table public.catalog_order_stats
      add constraint catalog_order_stats_pending_count_chk
      check (pending_count >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_stats_in_progress_count_chk'
  ) then
    alter table public.catalog_order_stats
      add constraint catalog_order_stats_in_progress_count_chk
      check (in_progress_count >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_stats_on_the_way_count_chk'
  ) then
    alter table public.catalog_order_stats
      add constraint catalog_order_stats_on_the_way_count_chk
      check (on_the_way_count >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_stats_delivered_count_chk'
  ) then
    alter table public.catalog_order_stats
      add constraint catalog_order_stats_delivered_count_chk
      check (delivered_count >= 0);
  end if;
end;
$$;

insert into public.catalog_order_stats (
  store_id,
  total_count,
  pending_count,
  in_progress_count,
  on_the_way_count,
  delivered_count
)
select
  orders.store_id,
  count(*)::int as total_count,
  count(*) filter (where orders.status = 'pending')::int as pending_count,
  count(*) filter (where orders.status = 'in_progress')::int as in_progress_count,
  count(*) filter (where orders.status = 'on_the_way')::int as on_the_way_count,
  count(*) filter (where orders.status = 'delivered')::int as delivered_count
from public.catalog_orders orders
group by orders.store_id
on conflict (store_id) do update set
  total_count = excluded.total_count,
  pending_count = excluded.pending_count,
  in_progress_count = excluded.in_progress_count,
  on_the_way_count = excluded.on_the_way_count,
  delivered_count = excluded.delivered_count,
  updated_at = now();

create table if not exists public.catalog_order_metrics_hourly (
  store_id text not null references public.catalog_stores(id) on delete cascade,
  bucket_hour timestamptz not null,
  order_count integer not null default 0,
  revenue_total numeric(12, 2) not null default 0,
  delivered_count integer not null default 0,
  delivered_revenue_total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, bucket_hour)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_metrics_hourly_order_count_chk'
  ) then
    alter table public.catalog_order_metrics_hourly
      add constraint catalog_order_metrics_hourly_order_count_chk
      check (order_count >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_metrics_hourly_revenue_total_chk'
  ) then
    alter table public.catalog_order_metrics_hourly
      add constraint catalog_order_metrics_hourly_revenue_total_chk
      check (revenue_total >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_metrics_hourly_delivered_count_chk'
  ) then
    alter table public.catalog_order_metrics_hourly
      add constraint catalog_order_metrics_hourly_delivered_count_chk
      check (delivered_count >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_metrics_hourly_delivered_revenue_total_chk'
  ) then
    alter table public.catalog_order_metrics_hourly
      add constraint catalog_order_metrics_hourly_delivered_revenue_total_chk
      check (delivered_revenue_total >= 0);
  end if;
end;
$$;

insert into public.catalog_order_metrics_hourly (
  store_id,
  bucket_hour,
  order_count,
  revenue_total,
  delivered_count,
  delivered_revenue_total
)
select
  orders.store_id,
  date_trunc('hour', orders.created_at) as bucket_hour,
  count(*)::int as order_count,
  coalesce(sum(orders.total_amount), 0)::numeric(12, 2) as revenue_total,
  count(*) filter (where orders.status = 'delivered')::int as delivered_count,
  coalesce(sum(orders.total_amount) filter (where orders.status = 'delivered'), 0)::numeric(12, 2) as delivered_revenue_total
from public.catalog_orders orders
group by orders.store_id, date_trunc('hour', orders.created_at)
on conflict (store_id, bucket_hour) do update set
  order_count = excluded.order_count,
  revenue_total = excluded.revenue_total,
  delivered_count = excluded.delivered_count,
  delivered_revenue_total = excluded.delivered_revenue_total,
  updated_at = now();

create table if not exists public.catalog_notification_jobs (
  id text primary key,
  type varchar(64) not null,
  status varchar(24) not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  max_attempts integer not null default 8,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by varchar(120) not null default '',
  last_error text not null default '',
  last_result jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_notification_jobs_status_chk'
  ) then
    alter table public.catalog_notification_jobs
      add constraint catalog_notification_jobs_status_chk
      check (status in ('pending', 'processing', 'failed', 'completed', 'dead'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_notification_jobs_attempt_count_chk'
  ) then
    alter table public.catalog_notification_jobs
      add constraint catalog_notification_jobs_attempt_count_chk
      check (attempt_count >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_notification_jobs_max_attempts_chk'
  ) then
    alter table public.catalog_notification_jobs
      add constraint catalog_notification_jobs_max_attempts_chk
      check (max_attempts >= 1);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_notification_jobs_payload_object_chk'
  ) then
    alter table public.catalog_notification_jobs
      add constraint catalog_notification_jobs_payload_object_chk
      check (jsonb_typeof(payload) = 'object');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_notification_jobs_result_object_chk'
  ) then
    alter table public.catalog_notification_jobs
      add constraint catalog_notification_jobs_result_object_chk
      check (jsonb_typeof(last_result) = 'object');
  end if;
end;
$$;

create index if not exists idx_catalog_order_stats_updated_at
  on public.catalog_order_stats (updated_at desc);

create index if not exists idx_catalog_order_metrics_hourly_store_bucket
  on public.catalog_order_metrics_hourly (store_id, bucket_hour desc);

create index if not exists idx_catalog_notification_jobs_claim
  on public.catalog_notification_jobs (type, status, available_at asc, created_at asc);

create index if not exists idx_catalog_notification_jobs_processing
  on public.catalog_notification_jobs (status, locked_at asc)
  where status = 'processing';

create table if not exists public.catalog_sessions (
  id text primary key,
  user_id text not null references public.catalog_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_catalog_sessions_user
  on public.catalog_sessions (user_id);

create index if not exists idx_catalog_sessions_expires_at
  on public.catalog_sessions (expires_at);

create table if not exists public.catalog_auth_rate_limits (
  action varchar(64) not null,
  scope_key text not null,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (action, scope_key)
);

create index if not exists idx_catalog_auth_rate_limits_blocked_until
  on public.catalog_auth_rate_limits (blocked_until);

create table if not exists public.catalog_password_reset_tokens (
  id text primary key,
  user_id text not null references public.catalog_users(id) on delete cascade,
  email varchar(255) not null,
  code_hash text not null,
  requested_ip varchar(120),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_catalog_password_reset_tokens_email
  on public.catalog_password_reset_tokens (email, expires_at);

create index if not exists idx_catalog_password_reset_tokens_lookup
  on public.catalog_password_reset_tokens (email, code_hash);

create index if not exists idx_catalog_password_reset_tokens_user
  on public.catalog_password_reset_tokens (user_id, expires_at);

create table if not exists public.catalog_pending_store_registrations (
  id text primary key,
  email varchar(255) not null,
  phone varchar(32) not null,
  full_name varchar(160) not null default '',
  store_name varchar(160) not null default '',
  password_hash text not null,
  code_hash text not null,
  requested_ip varchar(120),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_catalog_pending_store_registrations_email
  on public.catalog_pending_store_registrations (email, expires_at);

create index if not exists idx_catalog_pending_store_registrations_phone
  on public.catalog_pending_store_registrations (phone, expires_at);

create index if not exists idx_catalog_pending_store_registrations_lookup
  on public.catalog_pending_store_registrations (email, code_hash);

create or replace function public.set_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_catalog_stores_updated_at on public.catalog_stores;
create trigger trg_catalog_stores_updated_at
before update on public.catalog_stores
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists trg_catalog_users_updated_at on public.catalog_users;
create trigger trg_catalog_users_updated_at
before update on public.catalog_users
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists trg_catalog_products_updated_at on public.catalog_products;
create trigger trg_catalog_products_updated_at
before update on public.catalog_products
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists trg_catalog_orders_updated_at on public.catalog_orders;
create trigger trg_catalog_orders_updated_at
before update on public.catalog_orders
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists trg_catalog_order_customers_updated_at on public.catalog_order_customers;
create trigger trg_catalog_order_customers_updated_at
before update on public.catalog_order_customers
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists trg_catalog_store_reviews_updated_at on public.catalog_store_reviews;
create trigger trg_catalog_store_reviews_updated_at
before update on public.catalog_store_reviews
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists trg_catalog_order_stats_updated_at on public.catalog_order_stats;
create trigger trg_catalog_order_stats_updated_at
before update on public.catalog_order_stats
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists trg_catalog_order_metrics_hourly_updated_at on public.catalog_order_metrics_hourly;
create trigger trg_catalog_order_metrics_hourly_updated_at
before update on public.catalog_order_metrics_hourly
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists trg_catalog_notification_jobs_updated_at on public.catalog_notification_jobs;
create trigger trg_catalog_notification_jobs_updated_at
before update on public.catalog_notification_jobs
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists trg_catalog_plan_definitions_updated_at on public.catalog_plan_definitions;
create trigger trg_catalog_plan_definitions_updated_at
before update on public.catalog_plan_definitions
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists trg_catalog_auth_rate_limits_updated_at on public.catalog_auth_rate_limits;
create trigger trg_catalog_auth_rate_limits_updated_at
before update on public.catalog_auth_rate_limits
for each row
execute function public.set_catalog_updated_at();
