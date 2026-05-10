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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

alter table if exists public.catalog_store_reviews
  add column if not exists customer_key text not null default '',
  add column if not exists customer_name varchar(160) not null default '',
  add column if not exists customer_phone varchar(32) not null default '',
  add column if not exists rating integer not null default 5,
  add column if not exists comment text not null default '',
  add column if not exists is_public boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.catalog_store_reviews
  drop constraint if exists catalog_store_reviews_order_id_not_blank_chk;

alter table public.catalog_store_reviews
  add constraint catalog_store_reviews_order_id_not_blank_chk
  check (btrim(order_id) <> '');

alter table public.catalog_store_reviews
  drop constraint if exists catalog_store_reviews_rating_range_chk;

alter table public.catalog_store_reviews
  add constraint catalog_store_reviews_rating_range_chk
  check (rating >= 1 and rating <= 5);

create index if not exists idx_catalog_store_reviews_store
  on public.catalog_store_reviews (store_id, created_at desc);

create index if not exists idx_catalog_store_reviews_store_public
  on public.catalog_store_reviews (store_id, is_public, created_at desc);

drop trigger if exists trg_catalog_store_reviews_updated_at on public.catalog_store_reviews;
create trigger trg_catalog_store_reviews_updated_at
before update on public.catalog_store_reviews
for each row
execute function public.set_catalog_updated_at();
