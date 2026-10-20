create table public.checklist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.checklist_task (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  checklist_id uuid not null references public.checklist(id) on delete cascade,
  label text not null,
  task_type text not null default 'SUBTASK',
  options jsonb not null default '[]'::jsonb,
  order_index integer not null default 0
);

alter table public.checklist enable row level security;
alter table public.checklist_task enable row level security;

create policy checklist_isolation on public.checklist
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy checklist_task_isolation on public.checklist_task
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
