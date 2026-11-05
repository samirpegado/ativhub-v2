-- Fase 5: lista de ativos no servidor, parada com fim e painel do ativo.
-- Fase 6: um cliente interno por empresa.

alter table public.asset_downtime
  add column if not exists work_order_id uuid references public.work_order(id) on delete set null,
  add column if not exists ended_at timestamptz;

create index if not exists asset_downtime_open_idx
  on public.asset_downtime (asset_id)
  where ended_at is null;

alter table public.customer
  add column if not exists is_internal boolean not null default false;

create unique index if not exists customer_one_internal_idx
  on public.customer (tenant_id)
  where is_internal;

create or replace function public.assets_screen(
  p_search text default null,
  p_statuses text[] default null,
  p_category_ids uuid[] default null,
  p_location_ids uuid[] default null,
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
    select a.id, a.name
    from public.asset a
    left join public.location loc on loc.id = a.location_id
    left join public.category cat on cat.id = a.category_id
    cross join needle
    where a.archived = false
      and (
        p_statuses is null
        or cardinality(p_statuses) = 0
        or a.status = any (p_statuses)
      )
      and (
        p_category_ids is null
        or cardinality(p_category_ids) = 0
        or a.category_id = any (p_category_ids)
      )
      and (
        p_location_ids is null
        or cardinality(p_location_ids) = 0
        or a.location_id = any (p_location_ids)
      )
      and (
        needle.pattern is null
        or coalesce(a.custom_id, '') ilike needle.pattern escape '\'
        or a.name ilike needle.pattern escape '\'
        or coalesce(a.description, '') ilike needle.pattern escape '\'
        or coalesce(a.model, '') ilike needle.pattern escape '\'
        or coalesce(a.serial_number, '') ilike needle.pattern escape '\'
        or coalesce(a.area, '') ilike needle.pattern escape '\'
        or coalesce(a.bar_code, '') ilike needle.pattern escape '\'
        or coalesce(loc.name, '') ilike needle.pattern escape '\'
        or coalesce(cat.name, '') ilike needle.pattern escape '\'
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'totalAll', (select count(*) from public.asset where archived = false),
    'items', coalesce((
      select jsonb_agg(payload order by sort_name)
      from (
        select
          a.name as sort_name,
          jsonb_build_object(
            'id', a.id,
            'customId', a.custom_id,
            'name', a.name,
            'description', a.description,
            'locationId', a.location_id,
            'locationName', loc.name,
            'categoryId', a.category_id,
            'categoryName', cat.name,
            'status', a.status,
            'model', a.model,
            'manufacturer', a.manufacturer,
            'serialNumber', a.serial_number,
            'barCode', a.bar_code,
            'power', a.power,
            'area', a.area,
            'acquisitionCost', a.acquisition_cost,
            'inServiceDate', a.in_service_date,
            'warrantyExpirationDate', a.warranty_expiration_date,
            'additionalInfos', a.additional_infos,
            'imagePath', a.image_url
          ) as payload
        from filtered
        join public.asset a on a.id = filtered.id
        left join public.location loc on loc.id = a.location_id
        left join public.category cat on cat.id = a.category_id
        order by a.name
        limit (select lim from bounds)
        offset (select off from bounds)
      ) rows
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.assets_screen(text, text[], uuid[], uuid[], integer, integer) from public, anon;
grant execute on function public.assets_screen(text, text[], uuid[], uuid[], integer, integer) to authenticated;

create or replace function public.asset_detail(p_asset_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'asset', jsonb_build_object(
      'id', a.id,
      'customId', a.custom_id,
      'name', a.name,
      'description', a.description,
      'status', a.status,
      'model', a.model,
      'manufacturer', a.manufacturer,
      'serialNumber', a.serial_number,
      'area', a.area,
      'acquisitionCost', a.acquisition_cost,
      'inServiceDate', a.in_service_date,
      'warrantyExpirationDate', a.warranty_expiration_date,
      'locationName', loc.name,
      'categoryName', cat.name,
      'imagePath', a.image_url
    ),
    'maintenanceCost', coalesce((
      select round(sum(line.parts_cost + line.labor_cost), 2)
      from (
        select
          coalesce((
            select sum(wop.quantity * p.cost)
            from public.work_order_part wop
            join public.part p on p.id = wop.part_id
            where wop.work_order_id = wo.id
          ), 0) as parts_cost,
          coalesce((
            select sum((l.duration_seconds / 3600.0) * coalesce(l.hourly_rate, 0))
            from public.labor l
            where l.work_order_id = wo.id
          ), 0) as labor_cost
        from public.work_order wo
        where wo.asset_id = a.id
          and wo.archived = false
      ) line
    ), 0),
    'workOrderCount', (
      select count(*)
      from public.work_order wo
      where wo.asset_id = a.id
        and wo.archived = false
    ),
    'failureCount', (
      select count(*)
      from public.asset_downtime d
      where d.asset_id = a.id
    ),
    'downtimeSeconds', coalesce((
      select sum(
        case
          when d.ended_at is not null then greatest(extract(epoch from (d.ended_at - d.started_at)), 0)
          when d.duration_seconds > 0 then d.duration_seconds
          else greatest(extract(epoch from (now() - d.started_at)), 0)
        end
      )
      from public.asset_downtime d
      where d.asset_id = a.id
    ), 0),
    'mttrSeconds', (
      select avg(
        case
          when d.ended_at is not null then greatest(extract(epoch from (d.ended_at - d.started_at)), 0)
          else d.duration_seconds
        end
      )
      from public.asset_downtime d
      where d.asset_id = a.id
        and (d.ended_at is not null or d.duration_seconds > 0)
    ),
    'trackedSeconds', greatest(
      extract(epoch from (now() - coalesce(a.in_service_date::timestamptz, a.created_at))),
      0
    ),
    'events', coalesce((
      select jsonb_agg(item order by item->>'at' desc)
      from (
        select jsonb_build_object(
          'kind', 'work_order',
          'at', coalesce(wo.completed_on, wo.due_date, wo.created_at),
          'id', wo.id,
          'customId', wo.custom_id,
          'title', wo.title,
          'status', wo.status,
          'type', wo.type,
          'partsCost', coalesce(round((
            select sum(wop.quantity * p.cost)
            from public.work_order_part wop
            join public.part p on p.id = wop.part_id
            where wop.work_order_id = wo.id
          ), 2), 0),
          'laborCost', coalesce(round((
            select sum((l.duration_seconds / 3600.0) * coalesce(l.hourly_rate, 0))
            from public.labor l
            where l.work_order_id = wo.id
          ), 2), 0)
        ) as item
        from public.work_order wo
        where wo.asset_id = a.id
          and wo.archived = false
        union all
        select jsonb_build_object(
          'kind', 'downtime',
          'at', d.started_at,
          'id', d.id,
          'durationSeconds', case
            when d.ended_at is not null then greatest(extract(epoch from (d.ended_at - d.started_at)), 0)
            when d.duration_seconds > 0 then d.duration_seconds
            else greatest(extract(epoch from (now() - d.started_at)), 0)
          end,
          'open', d.ended_at is null and d.duration_seconds = 0
        )
        from public.asset_downtime d
        where d.asset_id = a.id
      ) rows
    ), '[]'::jsonb)
  )
  from public.asset a
  left join public.location loc on loc.id = a.location_id
  left join public.category cat on cat.id = a.category_id
  where a.id = p_asset_id
    and a.archived = false;
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
      or coalesce(c.tax_id, '') ilike needle.pattern escape '\'
      or c.request_pin ilike needle.pattern escape '\'
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
          'description', description,
          'requestPin', request_pin,
          'taxId', tax_id,
          'isInternal', is_internal
        )
        order by is_internal desc, name
      )
      from (
        select *
        from filtered
        order by is_internal desc, name
        limit (select lim from bounds)
        offset (select off from bounds)
      ) page
    ), '[]'::jsonb)
  );
$$;

create or replace function public.public_work_order_report(
  p_token uuid,
  p_work_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_asset public.asset%rowtype;
  v_result jsonb;
begin
  v_asset := public.public_session_asset(p_token);

  select jsonb_build_object(
    'companyName', (select t.name from public.tenant t where t.id = wo.tenant_id),
    'order', jsonb_build_object(
      'customId', wo.custom_id,
      'title', wo.title,
      'description', wo.description,
      'status', wo.status,
      'priority', wo.priority,
      'type', wo.type,
      'dueDate', wo.due_date,
      'completedOn', wo.completed_on,
      'locationName', loc.name,
      'assetName', ast.name,
      'billingMode', wo.billing_mode,
      'serviceAmount', wo.service_amount,
      'customerName', case
        when loc_cust.id is not null and coalesce(loc_cust.is_internal, false) then null
        when loc_cust.id is not null then loc_cust.name
        when coalesce(wo_cust.is_internal, false) then null
        else wo_cust.name
      end,
      'customerPhone', case
        when loc_cust.id is not null and coalesce(loc_cust.is_internal, false) then null
        when loc_cust.id is not null then loc_cust.phone
        when coalesce(wo_cust.is_internal, false) then null
        else wo_cust.phone
      end,
      'primaryUserName', nullif(btrim(concat_ws(' ', pu.first_name, pu.last_name)), ''),
      'assignees', coalesce((
        select jsonb_agg(nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), '') order by m.first_name, m.last_name)
        from public.work_order_assignee wa
        join public.membership m on m.id = wa.membership_id
        where wa.work_order_id = wo.id
      ), '[]'::jsonb)
    ),
    'tasks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'label', t.label,
          'taskType', t.task_type,
          'value', t.value,
          'comment', t.comment,
          'executedAt', t.executed_at
        )
        order by t.order_index
      )
      from public.task t
      where t.work_order_id = wo.id
    ), '[]'::jsonb),
    'parts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', p.name,
          'unit', p.unit,
          'quantity', wop.quantity,
          'cost', p.cost
        )
        order by p.name
      )
      from public.work_order_part wop
      join public.part p on p.id = wop.part_id
      where wop.work_order_id = wo.id
    ), '[]'::jsonb),
    'labors', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'workedOn', case when l.logged then l.tracked_at else l.started_at end,
          'durationSeconds', l.duration_seconds,
          'hourlyRate', l.hourly_rate,
          'author', coalesce(
            nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), ''),
            'Usuário'
          )
        )
        order by l.started_at desc nulls last
      )
      from public.labor l
      left join public.membership m on m.id = l.membership_id
      where l.work_order_id = wo.id
        and (not l.logged or l.started_at is not null or l.duration_seconds > 0)
    ), '[]'::jsonb),
    'updates', '[]'::jsonb
  )
  into v_result
  from public.work_order wo
  left join public.location loc on loc.id = wo.location_id
  left join public.asset ast on ast.id = wo.asset_id
  left join public.membership pu on pu.id = wo.primary_user_id
  left join public.customer loc_cust on loc_cust.id = loc.customer_id
  left join public.customer wo_cust on wo_cust.id = wo.customer_id
  where wo.id = p_work_order_id
    and wo.asset_id = v_asset.id
    and wo.archived = false;

  if v_result is null then
    raise exception 'Ordem não encontrada.';
  end if;

  return v_result;
end;
$$;
