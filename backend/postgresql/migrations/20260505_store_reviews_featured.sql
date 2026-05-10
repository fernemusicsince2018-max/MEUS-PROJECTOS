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

create index if not exists idx_catalog_store_reviews_store_featured_public
  on public.catalog_store_reviews (
    store_id,
    is_public,
    is_featured,
    featured_at desc,
    updated_at desc,
    created_at desc
  );
