-- Lista de ordens com busca, filtros e página. O calendário segue sem filtro.
-- security invoker: cada tabela continua sujeita à RLS do tenant.

drop function if exists public.work_orders_screen();

create function public.work_orders_screen(
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
