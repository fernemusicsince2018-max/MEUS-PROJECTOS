create extension if not exists pgcrypto;

create table if not exists public.catalogs (
  id text primary key,
  store jsonb not null default '{}'::jsonb,
  products jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_catalogs_updated_at on public.catalogs;

create trigger trg_catalogs_updated_at
before update on public.catalogs
for each row
execute function public.set_catalog_updated_at();
