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
