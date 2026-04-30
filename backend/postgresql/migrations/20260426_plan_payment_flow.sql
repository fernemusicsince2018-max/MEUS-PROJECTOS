insert into public.catalog_settings (key, value, category, description) values
  ('merchant_registration_enabled', 'true', 'system', 'Se "false", bloqueia novos cadastros publicos de lojistas.'),
  ('payment_proof_deadline_hours', '72', 'payments', 'Prazo em horas para envio do comprovativo do plano.'),
  ('payment_method_label', 'Transferencia bancaria', 'payments', 'Nome do metodo de pagamento mostrado ao lojista.'),
  ('payment_instructions', '', 'payments', 'Instrucoes para pagamento do plano.'),
  ('payment_bank_name', '', 'payments', 'Banco que recebe os pagamentos dos planos.'),
  ('payment_account_name', '', 'payments', 'Nome da conta que recebe os pagamentos dos planos.'),
  ('payment_account_number', '', 'payments', 'Numero da conta usada nos pagamentos dos planos.'),
  ('payment_iban', '', 'payments', 'IBAN ou referencia bancaria usada para pagamento dos planos.')
on conflict (key) do update set
  category = coalesce(nullif(public.catalog_settings.category, ''), excluded.category),
  description = coalesce(public.catalog_settings.description, excluded.description),
  updated_at = now();

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

alter table public.catalog_plan_activation_requests
  drop constraint if exists catalog_plan_activation_requests_status_chk;

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
  add column if not exists reviewed_by_user_id text references public.catalog_users(id) on delete set null,
  add column if not exists original_file_name varchar(255) not null default '',
  add column if not exists mime_type varchar(120) not null default '',
  add column if not exists size_bytes integer not null default 0,
  add column if not exists storage_bucket varchar(120) not null default '',
  add column if not exists storage_path text not null default '',
  add column if not exists payer_name varchar(160) not null default '',
  add column if not exists payer_phone varchar(32) not null default '',
  add column if not exists payment_reference_text varchar(120) not null default '',
  add column if not exists paid_amount numeric(10, 2),
  add column if not exists paid_currency_code varchar(3) not null default 'AOA',
  add column if not exists paid_at timestamptz,
  add column if not exists note text not null default '',
  add column if not exists review_status varchar(24) not null default 'submitted',
  add column if not exists review_note text not null default '',
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz;

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

create index if not exists idx_catalog_plan_activation_events_recorded_at
  on public.catalog_plan_activation_events (recorded_at desc);

create index if not exists idx_catalog_plan_activation_events_plan_started_at
  on public.catalog_plan_activation_events (plan_started_at desc);

create index if not exists idx_catalog_plan_activation_events_store
  on public.catalog_plan_activation_events (store_id, plan_started_at desc);

create index if not exists idx_catalog_plan_activation_events_sort_cursor
  on public.catalog_plan_activation_events ((coalesce(plan_started_at, recorded_at)) desc, id desc);

drop index if exists idx_catalog_plan_activation_requests_store_pending;

create index if not exists idx_catalog_plan_activation_requests_status_requested_at
  on public.catalog_plan_activation_requests (status, requested_at desc);

create index if not exists idx_catalog_plan_activation_requests_store_open
  on public.catalog_plan_activation_requests (store_id, requested_at desc)
  where status in ('pending_payment', 'proof_submitted', 'under_review', 'needs_correction');

create index if not exists idx_catalog_plan_payment_proofs_request_submitted_at
  on public.catalog_plan_payment_proofs (request_id, submitted_at desc);
