-- Tipo e cliente da ordem, vários ativos na preventiva.

alter table public.work_order
  add column if not exists type text not null default 'CORRECTIVE',
  add column if not exists customer_id uuid references public.customer(id);

alter table public.work_order drop constraint if exists work_order_type_check;
alter table public.work_order
  add constraint work_order_type_check
  check (type in ('PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE'));

update public.work_order
set type = 'PREVENTIVE'
where parent_pm_id is not null
  and type = 'CORRECTIVE';

create table if not exists public.pm_asset (
  pm_id uuid not null references public.preventive_maintenance(id) on delete cascade,
  asset_id uuid not null references public.asset(id) on delete cascade,
  primary key (pm_id, asset_id)
);

alter table public.pm_asset enable row level security;

drop policy if exists pm_asset_isolation on public.pm_asset;
create policy pm_asset_isolation on public.pm_asset
  for all to authenticated
  using (
    exists (
      select 1
      from public.preventive_maintenance pm
      where pm.id = pm_id
        and pm.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1
      from public.preventive_maintenance pm
      where pm.id = pm_id
        and pm.tenant_id = public.current_tenant_id()
    )
  );

insert into public.pm_asset (pm_id, asset_id)
select id, asset_id
from public.preventive_maintenance
where asset_id is not null
on conflict do nothing;

create or replace function public.generate_due_preventive_work_orders()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  pm public.preventive_maintenance%rowtype;
  asset record;
  v_created integer := 0;
  v_count integer;
  v_reacted integer;
  v_assets integer;
  v_wo uuid;
  v_next timestamptz;
  v_guard integer;
  v_made integer;
begin
  for pm in
    select *
    from public.preventive_maintenance
    where disabled = false
      and next_run_at is not null
      and next_run_at <= now()
    order by next_run_at
    limit 50
    for update
  loop
    if pm.ends_on is not null and pm.ends_on < now() then
      update public.preventive_maintenance set next_run_at = null where id = pm.id;
      continue;
    end if;

    select count(*) into v_assets
    from public.pm_asset
    where pm_id = pm.id;

    select count(*), count(first_time_to_react)
      into v_count, v_reacted
    from public.work_order
    where parent_pm_id = pm.id
      and archived = false;

    if v_count / greatest(v_assets, 1) >= 5 and v_reacted = 0 then
      update public.preventive_maintenance
      set disabled = true, next_run_at = null
      where id = pm.id;
      continue;
    end if;

    v_made := 0;
    for asset in
      select a.id, a.name, a.custom_id, a.location_id
      from public.pm_asset pa
      join public.asset a on a.id = pa.asset_id
      where pa.pm_id = pm.id
        and a.archived = false
      order by a.name
    loop
      insert into public.work_order (
        tenant_id, title, description, priority, type, location_id, asset_id, team_id,
        primary_user_id, estimated_duration, due_date, parent_pm_id, status
      ) values (
        pm.tenant_id,
        pm.title || ' — ' || coalesce(asset.custom_id, asset.name),
        pm.description,
        pm.priority,
        'PREVENTIVE',
        coalesce(asset.location_id, pm.location_id),
        asset.id,
        pm.team_id,
        pm.primary_user_id,
        pm.estimated_duration,
        case
          when pm.due_date_delay is null then null
          else now() + make_interval(days => pm.due_date_delay)
        end,
        pm.id,
        'OPEN'
      )
      returning id into v_wo;

      insert into public.task (tenant_id, work_order_id, label, task_type, options, order_index)
      select tenant_id, v_wo, label, task_type, coalesce(options, '[]'::jsonb), order_index
      from public.pm_task_template
      where pm_id = pm.id
      order by order_index;

      v_made := v_made + 1;
      v_created := v_created + 1;
    end loop;

    if v_made = 0 then
      insert into public.work_order (
        tenant_id, title, description, priority, type, location_id, asset_id, team_id,
        primary_user_id, estimated_duration, due_date, parent_pm_id, status
      ) values (
        pm.tenant_id, pm.title, pm.description, pm.priority, 'PREVENTIVE', pm.location_id,
        null, pm.team_id, pm.primary_user_id, pm.estimated_duration,
        case
          when pm.due_date_delay is null then null
          else now() + make_interval(days => pm.due_date_delay)
        end,
        pm.id, 'OPEN'
      )
      returning id into v_wo;

      insert into public.task (tenant_id, work_order_id, label, task_type, options, order_index)
      select tenant_id, v_wo, label, task_type, coalesce(options, '[]'::jsonb), order_index
      from public.pm_task_template
      where pm_id = pm.id
      order by order_index;

      v_created := v_created + 1;
    end if;

    if pm.recurrence_based_on = 'COMPLETED_DATE' then
      v_next := null;
    else
      v_next := pm.next_run_at;
      v_guard := 0;
      loop
        v_next := public.pm_next_run(
          v_next, pm.starts_on, pm.frequency, pm.recurrence_type, pm.days_of_week, true
        );
        exit when v_next is null or v_next > now();
        v_guard := v_guard + 1;
        exit when v_guard > 500;
      end loop;
      if v_guard > 500 then
        v_next := null;
      end if;
      if pm.ends_on is not null and v_next is not null and v_next > pm.ends_on then
        v_next := null;
      end if;
    end if;

    update public.preventive_maintenance
    set next_run_at = v_next
    where id = pm.id;
  end loop;

  return v_created;
end;
$$;

update public.email_template
set html = $html$<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><p>Olá, {{recipientName}}.</p><p>{{companyName}} enviou o relatório da ordem <strong>{{customId}}</strong> — {{title}}.</p><p style="white-space:pre-line">{{summary}}</p></body></html>$html$
where code = 'WORK_ORDER_REPORT';

create or replace function public.work_order_detail(p_work_order_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', wo.id,
      'customId', wo.custom_id,
      'title', wo.title,
      'description', wo.description,
      'status', wo.status,
      'priority', wo.priority,
      'type', wo.type,
      'customerId', wo.customer_id,
      'customerName', cust.name,
      'customerEmail', cust.email,
      'dueDate', wo.due_date,
      'estimatedStartDate', wo.estimated_start_date,
      'estimatedDuration', wo.estimated_duration,
      'requiredSignature', wo.required_signature,
      'locationId', wo.location_id,
      'locationName', loc.name,
      'assetId', wo.asset_id,
      'assetName', ast.name,
      'teamId', wo.team_id,
      'primaryUserId', wo.primary_user_id,
      'categoryId', wo.category_id,
      'billingMode', wo.billing_mode,
      'serviceAmount', wo.service_amount,
      'firstTimeToReact', wo.first_time_to_react,
      'primaryUser', case
        when pu.id is null then null
        else jsonb_build_object(
          'id', pu.id,
          'firstName', pu.first_name,
          'lastName', pu.last_name,
          'imagePath', pu.image_url
        )
      end,
      'assignees', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'firstName', m.first_name,
            'lastName', m.last_name,
            'imagePath', m.image_url
          )
          order by m.first_name, m.last_name
        )
        from public.work_order_assignee wa
        join public.membership m on m.id = wa.membership_id
        where wa.work_order_id = wo.id
      ), '[]'::jsonb),
      'tasks', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'label', t.label,
            'taskType', t.task_type,
            'options', coalesce(t.options, '[]'::jsonb),
            'value', t.value
          )
          order by t.order_index
        )
        from public.task t
        where t.work_order_id = wo.id
      ), '[]'::jsonb)
    ),
    'timer', (
      select jsonb_build_object(
        'durationSeconds', l.duration_seconds,
        'startedAt', l.started_at,
        'hourlyRate', l.hourly_rate
      )
      from public.labor l
      join public.membership m on m.id = l.membership_id
      where l.work_order_id = wo.id
        and l.logged
        and m.user_id = auth.uid()
      limit 1
    ),
    'labors', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'durationSeconds', l.duration_seconds,
          'hourlyRate', l.hourly_rate,
          'workedOn', l.started_at,
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
        and not l.logged
    ), '[]'::jsonb),
    'files', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'name', f.name,
          'path', f.url
        )
        order by f.created_at desc
      )
      from public.file f
      where f.entity_type = 'WORK_ORDER'
        and f.entity_id = wo.id
    ), '[]'::jsonb),
    'logoPath', (select t.logo_url from public.tenant t where t.id = wo.tenant_id),
    'updates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'body', u.body,
          'createdAt', u.created_at,
          'author', coalesce(
            nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), ''),
            'Usuário'
          )
        )
        order by u.created_at
      )
      from public.work_order_update u
      left join public.membership m on m.id = u.membership_id
      where u.work_order_id = wo.id
    ), '[]'::jsonb),
    'parts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', wop.id,
          'partId', p.id,
          'name', p.name,
          'unit', p.unit,
          'cost', p.cost,
          'quantity', wop.quantity,
          'nonStock', p.non_stock
        )
        order by p.name
      )
      from public.work_order_part wop
      join public.part p on p.id = wop.part_id
      where wop.work_order_id = wo.id
    ), '[]'::jsonb),
    'partOptions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'unit', p.unit,
          'cost', p.cost,
          'quantity', p.quantity,
          'nonStock', p.non_stock
        )
        order by p.name
      )
      from public.part p
    ), '[]'::jsonb)
  )
  from public.work_order wo
  left join public.location loc on loc.id = wo.location_id
  left join public.asset ast on ast.id = wo.asset_id
  left join public.membership pu on pu.id = wo.primary_user_id
  left join public.customer cust on cust.id = wo.customer_id
  where wo.id = p_work_order_id
    and wo.archived = false;
$$;


-- Lista de ordens com busca, filtros e pagina. O calendario segue sem filtro.
-- security invoker: cada tabela continua sujeita a RLS do tenant.


create or replace function public.work_orders_screen(
  p_search text default null,
  p_statuses text[] default null,
  p_priorities text[] default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_include_calendar boolean default false,
  p_location_ids uuid[] default null,
  p_types text[] default null,
  p_overdue boolean default false
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
    select
      case
        when term is null then null
        else '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      end as pattern
    from bounds
  ),
  filtered as (
    select wo.id, wo.created_at
    from public.work_order wo
    left join public.location loc on loc.id = wo.location_id
    left join public.asset ast on ast.id = wo.asset_id
    left join public.membership pu on pu.id = wo.primary_user_id
    cross join needle
    where wo.archived = false
      and (p_statuses is null or wo.status = any (p_statuses))
      and (p_priorities is null or wo.priority = any (p_priorities))
      and (p_location_ids is null or cardinality(p_location_ids) = 0 or wo.location_id = any (p_location_ids))
      and (p_types is null or cardinality(p_types) = 0 or wo.type = any (p_types))
      and (
        coalesce(p_overdue, false) = false
        or (wo.due_date is not null and wo.due_date < now() and wo.status <> 'COMPLETE')
      )
      and (
        needle.pattern is null
        or coalesce(wo.custom_id, '') ilike needle.pattern escape '\'
        or wo.title ilike needle.pattern escape '\'
        or coalesce(wo.description, '') ilike needle.pattern escape '\'
        or coalesce(loc.name, '') ilike needle.pattern escape '\'
        or coalesce(ast.name, '') ilike needle.pattern escape '\'
        or concat_ws(' ', pu.first_name, pu.last_name) ilike needle.pattern escape '\'
        or exists (
          select 1
          from public.work_order_assignee wa
          join public.membership m on m.id = wa.membership_id
          where wa.work_order_id = wo.id
            and concat_ws(' ', m.first_name, m.last_name) ilike needle.pattern escape '\'
        )
        or (
          case wo.status
            when 'OPEN' then 'aberto'
            when 'IN_PROGRESS' then 'em andamento'
            when 'ON_HOLD' then 'em espera'
            when 'COMPLETE' then 'concluído'
            else wo.status
          end
        ) ilike needle.pattern escape '\'
        or (
          case wo.priority
            when 'NONE' then 'nenhuma'
            when 'LOW' then 'baixa'
            when 'MEDIUM' then 'média'
            when 'HIGH' then 'alta'
            else wo.priority
          end
        ) ilike needle.pattern escape '\'
      )
  ),
  paged as (
    select id, created_at
    from filtered
    order by created_at desc
    limit (select lim from bounds)
    offset (select off from bounds)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'totalAll', (select count(*) from public.work_order where archived = false),
    'orders', coalesce((
      select jsonb_agg(payload order by sort_at desc)
      from (
        select
          wo.created_at as sort_at,
          jsonb_build_object(
            'id', wo.id,
            'customId', wo.custom_id,
            'title', wo.title,
            'description', wo.description,
            'status', wo.status,
            'priority', wo.priority,
            'type', wo.type,
            'customerId', wo.customer_id,
            'customerName', cust.name,
            'customerEmail', cust.email,
            'dueDate', wo.due_date,
            'estimatedStartDate', wo.estimated_start_date,
            'estimatedDuration', wo.estimated_duration,
            'requiredSignature', wo.required_signature,
            'locationId', wo.location_id,
            'locationName', loc.name,
            'assetId', wo.asset_id,
            'assetName', ast.name,
            'teamId', wo.team_id,
            'primaryUserId', wo.primary_user_id,
            'categoryId', wo.category_id,
            'billingMode', wo.billing_mode,
            'serviceAmount', wo.service_amount,
            'firstTimeToReact', wo.first_time_to_react,
            'primaryUser', case
              when pu.id is null then null
              else jsonb_build_object(
                'id', pu.id,
                'firstName', pu.first_name,
                'lastName', pu.last_name,
                'imagePath', pu.image_url
              )
            end,
            'assignees', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', m.id,
                  'firstName', m.first_name,
                  'lastName', m.last_name,
                  'imagePath', m.image_url
                )
                order by m.first_name, m.last_name
              )
              from public.work_order_assignee wa
              join public.membership m on m.id = wa.membership_id
              where wa.work_order_id = wo.id
            ), '[]'::jsonb),
            'tasks', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', t.id,
                  'label', t.label,
                  'taskType', t.task_type,
                  'options', coalesce(t.options, '[]'::jsonb),
                  'value', t.value
                )
                order by t.order_index
              )
              from public.task t
              where t.work_order_id = wo.id
            ), '[]'::jsonb)
          ) as payload
        from paged
        join public.work_order wo on wo.id = paged.id
        left join public.location loc on loc.id = wo.location_id
        left join public.asset ast on ast.id = wo.asset_id
        left join public.membership pu on pu.id = wo.primary_user_id
        left join public.customer cust on cust.id = wo.customer_id
      ) rows
    ), '[]'::jsonb),
    'calendar', case
      when coalesce(p_include_calendar, false) then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'customId', custom_id,
            'title', title,
            'status', status,
            'dueDate', due_date,
            'estimatedStartDate', estimated_start_date,
            'estimatedDuration', estimated_duration
          )
          order by created_at desc
        )
        from public.work_order
        where archived = false
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'locations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'customId', custom_id
        )
        order by name
      )
      from public.location
    ), '[]'::jsonb),
    'assets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'customId', custom_id,
          'locationId', location_id
        )
        order by name
      )
      from public.asset
      where archived = false
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'firstName', m.first_name,
          'lastName', m.last_name,
          'email', coalesce(m.email, ''),
          'phone', m.phone,
          'roleId', m.role_id,
          'roleCode', coalesce(r.code, ''),
          'roleName', coalesce(r.name, 'Usuário'),
          'roleDescription', coalesce(r.description, ''),
          'isOwner', m.is_owner
        )
        order by m.first_name, m.last_name
      )
      from public.membership m
      left join public.role r on r.id = m.role_id
      where m.enabled = true
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', tm.id,
          'name', tm.name,
          'description', tm.description,
          'memberIds', coalesce((
            select jsonb_agg(link.membership_id)
            from public.team_member link
            where link.team_id = tm.id
          ), '[]'::jsonb)
        )
        order by tm.name
      )
      from public.team tm
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', id, 'name', name)
        order by name
      )
      from public.category
      where type = 'WORK_ORDER'
    ), '[]'::jsonb),
    'customers', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', id, 'name', name, 'email', email)
        order by name
      )
      from public.customer
    ), '[]'::jsonb),
    'checklists', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'tasks', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'label', ct.label,
                'taskType', ct.task_type,
                'options', coalesce(ct.options, '[]'::jsonb)
              )
              order by ct.order_index
            )
            from public.checklist_task ct
            where ct.checklist_id = c.id
          ), '[]'::jsonb)
        )
        order by c.name
      )
      from public.checklist c
    ), '[]'::jsonb)
  );
$$;

drop function if exists public.work_orders_screen(text, text[], text[], integer, integer, boolean);
revoke all on function public.work_orders_screen(text, text[], text[], integer, integer, boolean, uuid[], text[], boolean) from public;
revoke all on function public.work_orders_screen(text, text[], text[], integer, integer, boolean, uuid[], text[], boolean) from anon;
grant execute on function public.work_orders_screen(text, text[], text[], integer, integer, boolean, uuid[], text[], boolean) to authenticated;


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
          'durationSeconds', d.duration_seconds
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

revoke all on function public.asset_detail(uuid) from public;
revoke all on function public.asset_detail(uuid) from anon;
grant execute on function public.asset_detail(uuid) to authenticated;

create or replace function public.preventive_screen(
  p_search text default null,
  p_priority text default null,
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
      nullif(btrim(p_priority), '') as priority,
      least(greatest(coalesce(p_limit, 20), 1), 20) as lim,
      greatest(coalesce(p_offset, 0), 0) as off
  ),
  needle as (
    select
      case
        when term is null then null
        else '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      end as pattern
    from bounds
  ),
  filtered as (
    select pm.id
    from public.preventive_maintenance pm
    cross join bounds
    cross join needle
    where (bounds.priority is null or pm.priority = bounds.priority)
      and (
        needle.pattern is null
        or pm.name ilike needle.pattern escape '\'
        or pm.title ilike needle.pattern escape '\'
        or coalesce(pm.description, '') ilike needle.pattern escape '\'
        or coalesce(pm.custom_id, '') ilike needle.pattern escape '\'
        or exists (
          select 1
          from public.pm_asset pa
          join public.asset a on a.id = pa.asset_id
          where pa.pm_id = pm.id
            and a.name ilike needle.pattern escape '\'
        )
      )
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(row_to_json(page)::jsonb)
      from (
        select
          pm.id,
          pm.custom_id as "customId",
          pm.name,
          pm.title,
          pm.description,
          pm.priority,
          pm.frequency,
          pm.recurrence_type as "recurrenceType",
          pm.recurrence_based_on as "recurrenceBasedOn",
          coalesce(to_jsonb(pm.days_of_week), '[]'::jsonb) as "daysOfWeek",
          pm.starts_on as "startsOn",
          pm.ends_on as "endsOn",
          pm.due_date_delay as "dueDateDelay",
          pm.estimated_duration as "estimatedDuration",
          pm.disabled,
          pm.next_run_at as "nextRunAt",
          pm.location_id as "locationId",
          loc.name as "locationName",
          coalesce((
            select jsonb_agg(pa.asset_id order by a.name)
            from public.pm_asset pa
            join public.asset a on a.id = pa.asset_id
            where pa.pm_id = pm.id
          ), '[]'::jsonb) as "assetIds",
          (
            select pa.asset_id
            from public.pm_asset pa
            join public.asset a on a.id = pa.asset_id
            where pa.pm_id = pm.id
            order by a.name
            limit 1
          ) as "assetId",
          (
            select string_agg(a.name, ', ' order by a.name)
            from public.pm_asset pa
            join public.asset a on a.id = pa.asset_id
            where pa.pm_id = pm.id
          ) as "assetName",
          pm.team_id as "teamId",
          tm.name as "teamName",
          pm.primary_user_id as "primaryUserId",
          nullif(btrim(concat_ws(' ', pu.first_name, pu.last_name)), '') as "primaryUserName",
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'label', t.label,
                'taskType', t.task_type,
                'options', coalesce(t.options, '[]'::jsonb)
              )
              order by t.order_index
            )
            from public.pm_task_template t
            where t.pm_id = pm.id
          ), '[]'::jsonb) as tasks
        from public.preventive_maintenance pm
        join filtered f on f.id = pm.id
        left join public.location loc on loc.id = pm.location_id
                left join public.team tm on tm.id = pm.team_id
        left join public.membership pu on pu.id = pm.primary_user_id
        order by pm.next_run_at asc nulls last, pm.created_at desc
        limit (select lim from bounds)
        offset (select off from bounds)
      ) page
    ), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'totalAll', (select count(*) from public.preventive_maintenance),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'customId', custom_id) order by name)
      from public.location
    ), '[]'::jsonb),
    'assets', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', id, 'name', name, 'customId', custom_id, 'locationId', location_id)
        order by name
      )
      from public.asset
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', id, 'firstName', first_name, 'lastName', last_name)
        order by first_name, last_name
      )
      from public.membership
      where enabled = true
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
      from public.team
    ), '[]'::jsonb),
    'checklists', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'tasks', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'label', ct.label,
                'taskType', ct.task_type,
                'options', coalesce(ct.options, '[]'::jsonb)
              )
              order by ct.order_index
            )
            from public.checklist_task ct
            where ct.checklist_id = c.id
          ), '[]'::jsonb)
        )
        order by c.name
      )
      from public.checklist c
    ), '[]'::jsonb)
  );
$$;

create or replace function public.preventive_detail(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schedule', (
      select jsonb_build_object(
        'id', pm.id,
        'customId', pm.custom_id,
        'name', pm.name,
        'title', pm.title,
        'description', pm.description,
        'priority', pm.priority,
        'frequency', pm.frequency,
        'recurrenceType', pm.recurrence_type,
        'recurrenceBasedOn', pm.recurrence_based_on,
        'daysOfWeek', coalesce(to_jsonb(pm.days_of_week), '[]'::jsonb),
        'startsOn', pm.starts_on,
        'endsOn', pm.ends_on,
        'dueDateDelay', pm.due_date_delay,
        'estimatedDuration', pm.estimated_duration,
        'disabled', pm.disabled,
        'nextRunAt', pm.next_run_at,
        'locationId', pm.location_id,
        'locationName', loc.name,
        'assetIds', coalesce((
          select jsonb_agg(pa.asset_id order by a.name)
          from public.pm_asset pa
          join public.asset a on a.id = pa.asset_id
          where pa.pm_id = pm.id
        ), '[]'::jsonb),
        'assetId', (
          select pa.asset_id
          from public.pm_asset pa
          join public.asset a on a.id = pa.asset_id
          where pa.pm_id = pm.id
          order by a.name
          limit 1
        ),
        'assetName', (
          select string_agg(a.name, ', ' order by a.name)
          from public.pm_asset pa
          join public.asset a on a.id = pa.asset_id
          where pa.pm_id = pm.id
        ),
        'teamId', pm.team_id,
        'teamName', tm.name,
        'primaryUserId', pm.primary_user_id,
        'primaryUserName', nullif(btrim(concat_ws(' ', pu.first_name, pu.last_name)), ''),
        'tasks', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'label', t.label,
              'taskType', t.task_type,
              'options', coalesce(t.options, '[]'::jsonb)
            )
            order by t.order_index
          )
          from public.pm_task_template t
          where t.pm_id = pm.id
        ), '[]'::jsonb)
      )
      from public.preventive_maintenance pm
      left join public.location loc on loc.id = pm.location_id
            left join public.team tm on tm.id = pm.team_id
      left join public.membership pu on pu.id = pm.primary_user_id
      where pm.id = p_id
    ),
    'workOrders', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', wo.id,
          'customId', wo.custom_id,
          'title', wo.title,
          'status', wo.status,
          'dueDate', wo.due_date,
          'createdAt', wo.created_at
        )
        order by wo.created_at desc
      )
      from (
        select *
        from public.work_order
        where parent_pm_id = p_id
          and archived = false
        order by created_at desc
        limit 20
      ) wo
    ), '[]'::jsonb)
  );
$$;

