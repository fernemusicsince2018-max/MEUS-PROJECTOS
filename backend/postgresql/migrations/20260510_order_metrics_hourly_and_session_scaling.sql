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

create index if not exists idx_catalog_order_metrics_hourly_store_bucket
  on public.catalog_order_metrics_hourly (store_id, bucket_hour desc);

drop trigger if exists trg_catalog_order_metrics_hourly_updated_at on public.catalog_order_metrics_hourly;
create trigger trg_catalog_order_metrics_hourly_updated_at
before update on public.catalog_order_metrics_hourly
for each row
execute function public.set_catalog_updated_at();
