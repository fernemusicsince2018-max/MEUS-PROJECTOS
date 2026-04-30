create table if not exists public.catalog_public_snapshots (
  store_id text primary key references public.catalog_stores(id) on delete cascade,
  response_body text not null default '',
  updated_at timestamptz not null default now()
);
