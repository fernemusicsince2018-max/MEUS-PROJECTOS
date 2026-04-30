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

drop trigger if exists trg_catalog_order_stats_updated_at on public.catalog_order_stats;
create trigger trg_catalog_order_stats_updated_at
before update on public.catalog_order_stats
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists trg_catalog_notification_jobs_updated_at on public.catalog_notification_jobs;
create trigger trg_catalog_notification_jobs_updated_at
before update on public.catalog_notification_jobs
for each row
execute function public.set_catalog_updated_at();
