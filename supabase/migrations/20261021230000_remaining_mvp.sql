-- Fornecedores, solicitações, cobrança da ordem e permissões por área.
-- Funções de tela são security invoker. A solicitação pública é a exceção:
-- o visitante não tem tenant no JWT, então a função deriva a empresa do ativo.

alter table public.work_order
  add column if not exists billing_mode text not null default 'NONE',
  add column if not exists service_amount numeric(12, 2);

alter table public.work_order
  drop constraint if exists work_order_billing_mode_check;

alter table public.work_order
  add constraint work_order_billing_mode_check
  check (billing_mode in ('NONE', 'HOURLY', 'FIXED'));

alter table public.request
  add column if not exists requester_name text,
  add column if not exists requester_phone text;

create or replace function public.role_area_defaults(p_code text)
returns jsonb
language sql
immutable
as $$
  select case p_code
    when 'ADMIN' then '{
      "work_orders":{"view":true,"edit":true},
      "preventive":{"view":true,"edit":true},
      "requests":{"view":true,"edit":true},
      "assets":{"view":true,"edit":true},
      "locations":{"view":true,"edit":true},
      "inventory":{"view":true,"edit":true},
      "parties":{"view":true,"edit":true},
      "people":{"view":true,"edit":true}
    }'::jsonb
    when 'TECHNICIAN' then '{
      "work_orders":{"view":true,"edit":true},
      "preventive":{"view":true,"edit":true},
      "requests":{"view":true,"edit":true},
      "assets":{"view":true,"edit":true},
      "locations":{"view":true,"edit":true},
      "inventory":{"view":true,"edit":true},
      "parties":{"view":true,"edit":false},
      "people":{"view":false,"edit":false}
    }'::jsonb
    when 'REQUESTER' then '{
      "work_orders":{"view":false,"edit":false},
      "preventive":{"view":false,"edit":false},
      "requests":{"view":true,"edit":false},
      "assets":{"view":true,"edit":false},
      "locations":{"view":true,"edit":false},
      "inventory":{"view":false,"edit":false},
      "parties":{"view":false,"edit":false},
      "people":{"view":false,"edit":false}
    }'::jsonb
    else '{
      "work_orders":{"view":true,"edit":false},
      "preventive":{"view":true,"edit":false},
      "requests":{"view":true,"edit":false},
      "assets":{"view":true,"edit":false},
      "locations":{"view":true,"edit":false},
      "inventory":{"view":true,"edit":false},
      "parties":{"view":true,"edit":false},
      "people":{"view":true,"edit":false}
    }'::jsonb
  end;
$$;

update public.role
set permissions = permissions || jsonb_build_object('areas', public.role_area_defaults(code))
where code in ('ADMIN', 'TECHNICIAN', 'REQUESTER', 'VIEW_ONLY')
  and not (permissions ? 'areas');

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

  update public.role
  set permissions = permissions || jsonb_build_object('areas', public.role_area_defaults(code))
  where tenant_id = p_tenant_id
    and code in ('ADMIN', 'TECHNICIAN', 'REQUESTER', 'VIEW_ONLY');
end;
$$;

create or replace function public.vendors_screen(
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      nullif(btrim(p_search), '') as term,
      least(greatest(coalesce(p_limit, 20), 1), 20) as lim,
      greatest(coalesce(p_offset, 0), 0) as off
  ),
  needle as (
    select case
      when term is null then null
      else '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    end as pattern
    from bounds
  ),
  filtered as (
    select v.*
    from public.vendor v
    cross join needle
    where needle.pattern is null
      or v.company_name ilike needle.pattern escape '\'
      or v.name ilike needle.pattern escape '\'
      or coalesce(v.email, '') ilike needle.pattern escape '\'
      or coalesce(v.phone, '') ilike needle.pattern escape '\'
      or coalesce(v.vendor_type, '') ilike needle.pattern escape '\'
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'totalAll', (select count(*) from public.vendor),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'companyName', company_name,
          'name', name,
          'phone', phone,
          'email', email,
          'website', website,
          'vendorType', vendor_type,
          'description', description,
          'rate', rate
        )
        order by company_name
      )
      from (
        select *
        from filtered
        order by company_name
        limit (select lim from bounds)
        offset (select off from bounds)
      ) page
    ), '[]'::jsonb)
  );
$$;

create or replace function public.customers_screen(
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      nullif(btrim(p_search), '') as term,
      least(greatest(coalesce(p_limit, 20), 1), 20) as lim,
      greatest(coalesce(p_offset, 0), 0) as off
  ),
  needle as (
    select case
      when term is null then null
      else '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    end as pattern
    from bounds
  ),
  filtered as (
    select c.*
    from public.customer c
    cross join needle
    where needle.pattern is null
      or c.name ilike needle.pattern escape '\'
      or coalesce(c.email, '') ilike needle.pattern escape '\'
      or coalesce(c.phone, '') ilike needle.pattern escape '\'
      or coalesce(c.customer_type, '') ilike needle.pattern escape '\'
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'totalAll', (select count(*) from public.customer),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'phone', phone,
          'email', email,
          'website', website,
          'customerType', customer_type,
          'description', description
        )
        order by name
      )
      from (
        select *
        from filtered
        order by name
        limit (select lim from bounds)
        offset (select off from bounds)
      ) page
    ), '[]'::jsonb)
  );
$$;

create or replace function public.requests_screen(
  p_search text default null,
  p_status text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      nullif(btrim(p_search), '') as term,
      least(greatest(coalesce(p_limit, 20), 1), 20) as lim,
      greatest(coalesce(p_offset, 0), 0) as off
  ),
  needle as (
    select case
      when term is null then null
      else '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    end as pattern
    from bounds
  ),
  filtered as (
    select r.id, r.created_at
    from public.request r
    left join public.asset ast on ast.id = r.asset_id
    left join public.location loc on loc.id = r.location_id
    cross join needle
    where (
      p_status is null
      or p_status = ''
      or (p_status = 'pending' and r.cancelled = false and r.work_order_id is null)
      or (p_status = 'approved' and r.work_order_id is not null)
      or (p_status = 'rejected' and r.cancelled = true)
    )
    and (
      needle.pattern is null
      or coalesce(r.custom_id, '') ilike needle.pattern escape '\'
      or r.title ilike needle.pattern escape '\'
      or coalesce(r.description, '') ilike needle.pattern escape '\'
      or coalesce(r.requester_name, '') ilike needle.pattern escape '\'
      or coalesce(r.requester_phone, '') ilike needle.pattern escape '\'
      or coalesce(ast.name, '') ilike needle.pattern escape '\'
      or coalesce(loc.name, '') ilike needle.pattern escape '\'
    )
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'totalAll', (select count(*) from public.request),
    'items', coalesce((
      select jsonb_agg(payload order by sort_at desc)
      from (
        select
          r.created_at as sort_at,
          jsonb_build_object(
            'id', r.id,
            'customId', r.custom_id,
            'title', r.title,
            'description', r.description,
            'requesterName', r.requester_name,
            'requesterPhone', r.requester_phone,
            'createdAt', r.created_at,
            'cancelled', r.cancelled,
            'cancellationReason', r.cancellation_reason,
            'workOrderId', r.work_order_id,
            'workOrderCustomId', wo.custom_id,
            'assetId', r.asset_id,
            'assetName', ast.name,
            'locationId', r.location_id,
            'locationName', loc.name
          ) as payload
        from filtered
        join public.request r on r.id = filtered.id
        left join public.asset ast on ast.id = r.asset_id
        left join public.location loc on loc.id = r.location_id
        left join public.work_order wo on wo.id = r.work_order_id
        order by r.created_at desc
        limit (select lim from bounds)
        offset (select off from bounds)
      ) rows
    ), '[]'::jsonb)
  );
$$;

create or replace function public.approve_request(p_request_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.request%rowtype;
  v_author uuid;
  v_order uuid;
begin
  select * into v_request
  from public.request
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;
  if v_request.cancelled or v_request.work_order_id is not null then
    raise exception 'Esta solicitação já foi tratada.';
  end if;

  select m.id into v_author
  from public.membership m
  where m.user_id = auth.uid()
    and m.tenant_id = v_request.tenant_id
    and m.enabled
  limit 1;

  insert into public.work_order (
    tenant_id, title, description, priority, location_id, asset_id,
    parent_request_id, created_by, status
  ) values (
    v_request.tenant_id,
    v_request.title,
    v_request.description,
    coalesce(nullif(v_request.priority, ''), 'NONE'),
    v_request.location_id,
    v_request.asset_id,
    v_request.id,
    v_author,
    'OPEN'
  )
  returning id into v_order;

  update public.request
  set work_order_id = v_order
  where id = v_request.id;

  return v_order;
end;
$$;

create or replace function public.lookup_public_asset(
  p_asset_id uuid default null,
  p_barcode text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_asset public.asset%rowtype;
  v_location text;
  v_code text := nullif(btrim(coalesce(p_barcode, '')), '');
begin
  if p_asset_id is not null then
    select * into v_asset
    from public.asset
    where id = p_asset_id
      and archived = false;
    if not found then
      return jsonb_build_object('found', false);
    end if;
  elsif v_code is null then
    return jsonb_build_object('found', false);
  else
    select count(*) into v_count
    from public.asset
    where archived = false
      and bar_code = v_code;
    if v_count = 0 then
      return jsonb_build_object('found', false);
    end if;
    if v_count > 1 then
      return jsonb_build_object('found', false, 'ambiguous', true);
    end if;
    select * into v_asset
    from public.asset
    where archived = false
      and bar_code = v_code;
  end if;

  select name into v_location
  from public.location
  where id = v_asset.location_id;

  return jsonb_build_object(
    'found', true,
    'id', v_asset.id,
    'name', v_asset.name,
    'customId', v_asset.custom_id,
    'barCode', v_asset.bar_code,
    'locationName', v_location
  );
end;
$$;

create or replace function public.submit_public_request(
  p_asset_id uuid,
  p_pin text,
  p_name text,
  p_phone text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.asset%rowtype;
  v_pin text := nullif(btrim(coalesce(p_pin, '')), '');
  v_stored text;
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_open integer;
  v_id uuid;
begin
  select * into v_asset
  from public.asset
  where id = p_asset_id
    and archived = false;
  if not found then
    raise exception 'Ativo não encontrado.';
  end if;

  if v_pin is null or v_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN inválido.';
  end if;

  select nullif(btrim(coalesce(settings->>'requestPin', '')), '')
    into v_stored
  from public.tenant
  where id = v_asset.tenant_id;

  if v_stored is null then
    raise exception 'A empresa ainda não liberou solicitações.';
  end if;
  if v_stored <> v_pin then
    raise exception 'PIN incorreto.';
  end if;
  if v_name = '' then
    raise exception 'Informe o nome.';
  end if;
  if v_phone = '' then
    raise exception 'Informe o telefone.';
  end if;
  if v_description = '' then
    raise exception 'Descreva o que aconteceu.';
  end if;

  select count(*) into v_open
  from public.request
  where asset_id = v_asset.id
    and cancelled = false
    and work_order_id is null
    and created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo')
      at time zone 'America/Sao_Paulo';

  if v_open >= 3 then
    raise exception 'Este equipamento já tem 3 solicitações abertas hoje.';
  end if;

  insert into public.request (
    tenant_id, title, description, priority, location_id, asset_id,
    requester_name, requester_phone
  ) values (
    v_asset.tenant_id,
    left(v_description, 120),
    v_description,
    'NONE',
    v_asset.location_id,
    v_asset.id,
    left(v_name, 120),
    left(v_phone, 32)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.role_area_defaults(text) from public, anon, authenticated;
revoke all on function public.vendors_screen(text, integer, integer) from public, anon;
revoke all on function public.customers_screen(text, integer, integer) from public, anon;
revoke all on function public.requests_screen(text, text, integer, integer) from public, anon;
revoke all on function public.approve_request(uuid) from public, anon;
revoke all on function public.lookup_public_asset(uuid, text) from public;
revoke all on function public.submit_public_request(uuid, text, text, text, text) from public;

grant execute on function public.vendors_screen(text, integer, integer) to authenticated;
grant execute on function public.customers_screen(text, integer, integer) to authenticated;
grant execute on function public.requests_screen(text, text, integer, integer) to authenticated;
grant execute on function public.approve_request(uuid) to authenticated;
grant execute on function public.lookup_public_asset(uuid, text) to anon, authenticated;
grant execute on function public.submit_public_request(uuid, text, text, text, text) to anon, authenticated;
