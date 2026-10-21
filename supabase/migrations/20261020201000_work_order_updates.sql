create table public.work_order_update (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  work_order_id uuid not null references public.work_order(id) on delete cascade,
  membership_id uuid references public.membership(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create unique index labor_one_timer_per_user
  on public.labor (work_order_id, membership_id)
  where logged;

alter table public.work_order_update enable row level security;

create policy work_order_update_isolation on public.work_order_update
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
