alter table if exists public.catalog_stores
  add column if not exists public_slug varchar(63);

alter table if exists public.catalog_stores
  add column if not exists custom_domain varchar(255);

create unique index if not exists idx_catalog_stores_public_slug_lower
  on public.catalog_stores (lower(public_slug))
  where public_slug is not null
    and btrim(public_slug) <> '';

create unique index if not exists idx_catalog_stores_custom_domain_lower
  on public.catalog_stores (lower(custom_domain))
  where custom_domain is not null
    and btrim(custom_domain) <> '';
