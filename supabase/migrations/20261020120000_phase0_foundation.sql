-- AtivHub MVP — Fase 0 (tenancy) + schema núcleo do plano.
-- Isolamento multi-tenant por tenant_id + RLS. Ver docs/ativhub-mvp-plan.md.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_self_parent()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null and new.parent_id = new.id then
    raise exception 'parent_id cannot equal id';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenancy e pessoas
-- ---------------------------------------------------------------------------

create table public.tenant (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.role (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  name text not null,
  code text not null default 'USER_CREATED',
  permissions jsonb not null default '{}',
  is_default boolean not null default false,
  unique (tenant_id, code)
);

create table public.membership (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.role(id),
  first_name text not null,
  last_name text not null,
  job_title text,
  phone text,
  rate numeric,
  image_url text,
  is_owner boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.team (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.team_member (
  team_id uuid not null references public.team(id) on delete cascade,
  membership_id uuid not null references public.membership(id) on delete cascade,
  primary key (team_id, membership_id)
);

create table public.counter (
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  entity text not null,
  value integer not null default 0,
  primary key (tenant_id, entity)
);

create or replace function public.next_custom_id(
  p_tenant_id uuid,
  p_entity text,
  p_prefix text
) returns text
language plpgsql
as $$
declare
  v_value integer;
begin
  insert into public.counter (tenant_id, entity, value)
  values (p_tenant_id, p_entity, 1)
  on conflict (tenant_id, entity)
  do update set value = public.counter.value + 1
  returning value into v_value;

  return p_prefix || lpad(v_value::text, 6, '0');
end;
$$;

create or replace function public.assign_custom_id()
returns trigger
language plpgsql
as $$
begin
  if new.custom_id is null or btrim(new.custom_id) = '' then
    if tg_table_name = 'work_order' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'work_order', 'WO-');
    elsif tg_table_name = 'preventive_maintenance' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'preventive_maintenance', 'PM-');
    elsif tg_table_name = 'asset' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'asset', 'A-');
    elsif tg_table_name = 'location' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'location', 'L-');
    elsif tg_table_name = 'request' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'request', 'R-');
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.seed_default_roles(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_all text[] := array[
    'PEOPLE_AND_TEAMS','CATEGORIES','WORK_ORDERS','PREVENTIVE_MAINTENANCES',
    'ASSETS','PARTS','METERS','VENDORS_AND_CUSTOMERS','FILES','LOCATIONS',
    'SETTINGS','REQUESTS','ANALYTICS'
  ];
  v_ops text[] := array[
    'WORK_ORDERS','PREVENTIVE_MAINTENANCES','ASSETS','PARTS','FILES',
    'LOCATIONS','REQUESTS','CATEGORIES'
  ];
begin
  insert into public.role (tenant_id, name, code, is_default, permissions) values
    (
      p_tenant_id, 'Administrador', 'ADMIN', false,
      jsonb_build_object(
        'create', v_all, 'view', v_all, 'viewOther', v_all,
        'editOther', v_all, 'deleteOther', v_all
      )
    ),
    (
      p_tenant_id, 'Administrador limitado', 'LIMITED_ADMIN', false,
      jsonb_build_object(
        'create', v_ops, 'view', v_all, 'viewOther', v_ops,
        'editOther', v_ops, 'deleteOther', v_ops
      )
    ),
    (
      p_tenant_id, 'Técnico', 'TECHNICIAN', true,
      jsonb_build_object(
        'create', v_ops, 'view', v_ops || array['ANALYTICS'],
        'viewOther', array['WORK_ORDERS','ASSETS','PARTS','LOCATIONS'],
        'editOther', array[]::text[], 'deleteOther', array[]::text[]
      )
    ),
    (
      p_tenant_id, 'Técnico limitado', 'LIMITED_TECHNICIAN', false,
      jsonb_build_object(
        'create', array['WORK_ORDERS','REQUESTS'],
        'view', array['WORK_ORDERS','ASSETS','PARTS','LOCATIONS','REQUESTS','FILES'],
        'viewOther', array[]::text[], 'editOther', array[]::text[],
        'deleteOther', array[]::text[]
      )
    ),
    (
      p_tenant_id, 'Somente leitura', 'VIEW_ONLY', false,
      jsonb_build_object(
        'create', array[]::text[], 'view', v_all,
        'viewOther', v_all, 'editOther', array[]::text[],
        'deleteOther', array[]::text[]
      )
    ),
    (
      p_tenant_id, 'Solicitante', 'REQUESTER', false,
      jsonb_build_object(
        'create', array['REQUESTS'], 'view', array['REQUESTS'],
        'viewOther', array[]::text[], 'editOther', array[]::text[],
        'deleteOther', array[]::text[]
      )
    );
end;
$$;

create or replace function public.bootstrap_tenant(
  p_name text,
  p_first_name text,
  p_last_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_admin_role_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.membership m where m.user_id = v_user_id) then
    raise exception 'user already belongs to a tenant';
  end if;

  insert into public.tenant (name) values (p_name) returning id into v_tenant_id;
  perform public.seed_default_roles(v_tenant_id);

  select r.id into v_admin_role_id
  from public.role r
  where r.tenant_id = v_tenant_id and r.code = 'ADMIN';

  insert into public.membership (
    tenant_id, user_id, role_id, first_name, last_name, is_owner
  ) values (
    v_tenant_id, v_user_id, v_admin_role_id, p_first_name, p_last_name, true
  );

  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', v_tenant_id)
  where id = v_user_id;

  return v_tenant_id;
end;
$$;

create or replace function public.switch_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.membership m
    where m.user_id = v_user_id
      and m.tenant_id = p_tenant_id
      and m.enabled = true
  ) then
    raise exception 'no membership in tenant';
  end if;

  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', p_tenant_id)
  where id = v_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catálogo, localizações, ativos, peças
-- ---------------------------------------------------------------------------

create table public.category (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  type text not null,
  name text not null,
  description text,
  color text,
  created_at timestamptz not null default now()
);

create table public.location (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  custom_id text,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  parent_id uuid references public.location(id) on delete cascade,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, custom_id)
);

create table public.asset (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  custom_id text,
  name text not null,
  description text,
  parent_id uuid references public.asset(id) on delete cascade,
  location_id uuid references public.location(id),
  category_id uuid references public.category(id),
  primary_user_id uuid references public.membership(id),
  status text not null default 'OPERATIONAL',
  model text,
  manufacturer text,
  serial_number text,
  bar_code text,
  power text,
  area text,
  acquisition_cost numeric,
  in_service_date date,
  warranty_expiration_date date,
  additional_infos text,
  image_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, custom_id)
);

create table public.asset_downtime (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  asset_id uuid not null references public.asset(id) on delete cascade,
  started_at timestamptz not null default now(),
  duration_seconds bigint not null default 0
);

create table public.asset_team (
  asset_id uuid not null references public.asset(id) on delete cascade,
  team_id uuid not null references public.team(id) on delete cascade,
  primary key (asset_id, team_id)
);

create table public.asset_assignee (
  asset_id uuid not null references public.asset(id) on delete cascade,
  membership_id uuid not null references public.membership(id) on delete cascade,
  primary key (asset_id, membership_id)
);

create table public.part (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  name text not null,
  description text,
  category_id uuid references public.category(id),
  cost numeric not null default 0,
  quantity numeric not null default 0,
  min_quantity numeric not null default 0,
  non_stock boolean not null default false,
  unit text,
  bar_code text,
  area text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quantity_non_negative check (quantity >= 0),
  constraint min_quantity_non_negative check (min_quantity >= 0)
);

-- ---------------------------------------------------------------------------
-- Preventiva, solicitações, OT, estoque, arquivos
-- ---------------------------------------------------------------------------

create table public.preventive_maintenance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  custom_id text,
  name text not null,
  title text not null,
  description text,
  priority text not null default 'NONE',
  category_id uuid references public.category(id),
  location_id uuid references public.location(id),
  asset_id uuid references public.asset(id),
  team_id uuid references public.team(id),
  primary_user_id uuid references public.membership(id),
  estimated_duration numeric,
  frequency integer not null default 1 check (frequency >= 1),
  recurrence_type text not null default 'DAILY',
  recurrence_based_on text not null default 'SCHEDULED_DATE',
  days_of_week integer[],
  starts_on timestamptz not null default now(),
  ends_on timestamptz,
  due_date_delay integer,
  disabled boolean not null default false,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, custom_id)
);

create table public.pm_task_template (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  pm_id uuid not null references public.preventive_maintenance(id) on delete cascade,
  label text not null,
  task_type text not null default 'SUBTASK',
  order_index integer not null default 0
);

create table public.request (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  custom_id text,
  title text not null,
  description text,
  priority text not null default 'NONE',
  category_id uuid references public.category(id),
  location_id uuid references public.location(id),
  asset_id uuid references public.asset(id),
  primary_user_id uuid references public.membership(id),
  work_order_id uuid,
  cancelled boolean not null default false,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, custom_id)
);

create table public.work_order (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  custom_id text,
  title text not null,
  description text,
  status text not null default 'OPEN',
  priority text not null default 'NONE',
  due_date timestamptz,
  estimated_start_date timestamptz,
  estimated_duration numeric,
  required_signature boolean not null default false,
  signature_url text,
  feedback text,
  category_id uuid references public.category(id),
  location_id uuid references public.location(id),
  asset_id uuid references public.asset(id),
  team_id uuid references public.team(id),
  primary_user_id uuid references public.membership(id),
  completed_by uuid references public.membership(id),
  completed_on timestamptz,
  first_time_to_react timestamptz,
  parent_request_id uuid references public.request(id),
  parent_pm_id uuid references public.preventive_maintenance(id),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, custom_id)
);

alter table public.request
  add constraint request_work_order_id_fkey
  foreign key (work_order_id) references public.work_order(id);

create table public.work_order_assignee (
  work_order_id uuid not null references public.work_order(id) on delete cascade,
  membership_id uuid not null references public.membership(id) on delete cascade,
  primary key (work_order_id, membership_id)
);

create table public.task (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  work_order_id uuid not null references public.work_order(id) on delete cascade,
  label text not null,
  task_type text not null default 'SUBTASK',
  value text,
  order_index integer not null default 0
);

create table public.labor (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  work_order_id uuid not null references public.work_order(id) on delete cascade,
  membership_id uuid references public.membership(id),
  duration_seconds bigint not null default 0,
  hourly_rate numeric,
  logged boolean not null default false,
  started_at timestamptz
);

create table public.work_order_part (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  work_order_id uuid not null references public.work_order(id) on delete cascade,
  part_id uuid not null references public.part(id),
  quantity numeric not null default 1 check (quantity >= 0)
);

create table public.stock_movement (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  part_id uuid not null references public.part(id) on delete cascade,
  work_order_id uuid references public.work_order(id) on delete set null,
  quantity numeric not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table public.vendor (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  company_name text not null,
  name text not null,
  phone text,
  email text,
  website text,
  vendor_type text,
  description text,
  rate numeric,
  created_at timestamptz not null default now()
);

create table public.customer (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  website text,
  customer_type text,
  description text,
  created_at timestamptz not null default now()
);

create table public.file (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  name text not null,
  url text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

-- Triggers
create trigger location_set_updated_at
  before update on public.location
  for each row execute function public.set_updated_at();
create trigger location_assign_custom_id
  before insert on public.location
  for each row execute function public.assign_custom_id();
create trigger location_prevent_self_parent
  before insert or update on public.location
  for each row execute function public.prevent_self_parent();

create trigger asset_set_updated_at
  before update on public.asset
  for each row execute function public.set_updated_at();
create trigger asset_assign_custom_id
  before insert on public.asset
  for each row execute function public.assign_custom_id();
create trigger asset_prevent_self_parent
  before insert or update on public.asset
  for each row execute function public.prevent_self_parent();

create trigger part_set_updated_at
  before update on public.part
  for each row execute function public.set_updated_at();

create trigger pm_assign_custom_id
  before insert on public.preventive_maintenance
  for each row execute function public.assign_custom_id();

create trigger request_assign_custom_id
  before insert on public.request
  for each row execute function public.assign_custom_id();

create trigger work_order_set_updated_at
  before update on public.work_order
  for each row execute function public.set_updated_at();
create trigger work_order_assign_custom_id
  before insert on public.work_order
  for each row execute function public.assign_custom_id();

-- Índices de tenant
create index role_tenant_id_idx on public.role (tenant_id);
create index membership_tenant_id_idx on public.membership (tenant_id);
create index membership_user_id_idx on public.membership (user_id);
create index team_tenant_id_idx on public.team (tenant_id);
create index category_tenant_id_idx on public.category (tenant_id);
create index location_tenant_id_idx on public.location (tenant_id);
create index asset_tenant_id_idx on public.asset (tenant_id);
create index part_tenant_id_idx on public.part (tenant_id);
create index work_order_tenant_id_idx on public.work_order (tenant_id);
create index work_order_status_idx on public.work_order (tenant_id, status);
create index request_tenant_id_idx on public.request (tenant_id);
create index pm_tenant_id_idx on public.preventive_maintenance (tenant_id);
create index pm_next_run_idx on public.preventive_maintenance (next_run_at)
  where disabled = false;
create index stock_movement_part_idx on public.stock_movement (part_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.tenant enable row level security;
alter table public.role enable row level security;
alter table public.membership enable row level security;
alter table public.team enable row level security;
alter table public.team_member enable row level security;
alter table public.counter enable row level security;
alter table public.category enable row level security;
alter table public.location enable row level security;
alter table public.asset enable row level security;
alter table public.asset_downtime enable row level security;
alter table public.asset_team enable row level security;
alter table public.asset_assignee enable row level security;
alter table public.part enable row level security;
alter table public.preventive_maintenance enable row level security;
alter table public.pm_task_template enable row level security;
alter table public.request enable row level security;
alter table public.work_order enable row level security;
alter table public.work_order_assignee enable row level security;
alter table public.task enable row level security;
alter table public.labor enable row level security;
alter table public.work_order_part enable row level security;
alter table public.stock_movement enable row level security;
alter table public.vendor enable row level security;
alter table public.customer enable row level security;
alter table public.file enable row level security;

create policy tenant_select on public.tenant
  for select to authenticated
  using (
    id = public.current_tenant_id()
    or exists (
      select 1 from public.membership m
      where m.tenant_id = tenant.id
        and m.user_id = auth.uid()
        and m.enabled = true
    )
  );

create policy tenant_update on public.tenant
  for update to authenticated
  using (id = public.current_tenant_id())
  with check (id = public.current_tenant_id());

create policy role_isolation on public.role
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy membership_select on public.membership
  for select to authenticated
  using (user_id = auth.uid() or tenant_id = public.current_tenant_id());

create policy membership_write on public.membership
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy team_isolation on public.team
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy team_member_isolation on public.team_member
  for all to authenticated
  using (
    exists (
      select 1 from public.team t
      where t.id = team_id and t.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.team t
      where t.id = team_id and t.tenant_id = public.current_tenant_id()
    )
  );

create policy counter_isolation on public.counter
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy category_isolation on public.category
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy location_isolation on public.location
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy asset_isolation on public.asset
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy asset_downtime_isolation on public.asset_downtime
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy asset_team_isolation on public.asset_team
  for all to authenticated
  using (
    exists (
      select 1 from public.asset a
      where a.id = asset_id and a.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.asset a
      where a.id = asset_id and a.tenant_id = public.current_tenant_id()
    )
  );

create policy asset_assignee_isolation on public.asset_assignee
  for all to authenticated
  using (
    exists (
      select 1 from public.asset a
      where a.id = asset_id and a.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.asset a
      where a.id = asset_id and a.tenant_id = public.current_tenant_id()
    )
  );

create policy part_isolation on public.part
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy pm_isolation on public.preventive_maintenance
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy pm_task_template_isolation on public.pm_task_template
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy request_isolation on public.request
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy work_order_isolation on public.work_order
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy work_order_assignee_isolation on public.work_order_assignee
  for all to authenticated
  using (
    exists (
      select 1 from public.work_order w
      where w.id = work_order_id and w.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.work_order w
      where w.id = work_order_id and w.tenant_id = public.current_tenant_id()
    )
  );

create policy task_isolation on public.task
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy labor_isolation on public.labor
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy work_order_part_isolation on public.work_order_part
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy stock_movement_isolation on public.stock_movement
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy vendor_isolation on public.vendor
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy customer_isolation on public.customer
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy file_isolation on public.file
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy attachments_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy attachments_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy attachments_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

revoke all on function public.seed_default_roles(uuid) from public;
revoke all on function public.bootstrap_tenant(text, text, text) from public;
revoke all on function public.switch_tenant(uuid) from public;
revoke all on function public.next_custom_id(uuid, text, text) from public;

grant execute on function public.current_tenant_id() to authenticated, anon;
grant execute on function public.next_custom_id(uuid, text, text) to authenticated;
grant execute on function public.bootstrap_tenant(text, text, text) to authenticated;
grant execute on function public.switch_tenant(uuid) to authenticated;
