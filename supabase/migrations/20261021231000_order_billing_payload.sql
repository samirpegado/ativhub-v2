-- Cobrança e logo da empresa no payload da ordem.
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
  p_include_calendar boolean default false
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

revoke all on function public.work_orders_screen(text, text[], text[], integer, integer, boolean) from public;
revoke all on function public.work_orders_screen(text, text[], text[], integer, integer, boolean) from anon;
grant execute on function public.work_orders_screen(text, text[], text[], integer, integer, boolean) to authenticated;

