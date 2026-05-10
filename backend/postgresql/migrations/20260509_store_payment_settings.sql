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
