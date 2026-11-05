-- Técnico executa ordens atribuídas e não edita o cadastro. Dashboard filtra no servidor.

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
      "work_orders":{"view":true,"edit":false},
      "preventive":{"view":false,"edit":false},
      "requests":{"view":true,"edit":true},
      "assets":{"view":true,"edit":false},
      "locations":{"view":false,"edit":false},
      "inventory":{"view":true,"edit":false},
      "parties":{"view":false,"edit":false},
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
set permissions = jsonb_set(
  coalesce(permissions, '{}'::jsonb),
  '{areas}',
  public.role_area_defaults(code),
  true
)
where code = 'TECHNICIAN';

create or replace function public.work_orders_dashboard(
  p_from date default null,
  p_to date default null,
  p_membership uuid default null,
  p_location uuid default null,
  p_type text default null,
  p_status text default null,
  p_priority text default null,
  p_situation text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select wo.*
    from public.work_order wo
    where wo.archived = false
      and (
        p_from is null
        or coalesce(wo.due_date, wo.estimated_start_date)
          >= (p_from::timestamp at time zone 'America/Sao_Paulo')
      )
      and (
        p_to is null
        or coalesce(wo.due_date, wo.estimated_start_date)
          < ((p_to + 1)::timestamp at time zone 'America/Sao_Paulo')
      )
      and (p_location is null or wo.location_id = p_location)
      and (nullif(btrim(p_type), '') is null or wo.type = btrim(p_type))
      and (nullif(btrim(p_status), '') is null or wo.status = btrim(p_status))
      and (nullif(btrim(p_priority), '') is null or wo.priority = btrim(p_priority))
      and (
        p_membership is null
        or wo.primary_user_id = p_membership
        or exists (
          select 1
          from public.work_order_assignee wa
          where wa.work_order_id = wo.id
            and wa.membership_id = p_membership
        )
      )
      and (
        nullif(btrim(p_situation), '') is null
        or (
          btrim(p_situation) = 'overdue'
          and wo.status <> 'COMPLETE'
          and wo.due_date is not null
          and wo.due_date < now()
        )
        or (
          btrim(p_situation) = 'on_time'
          and wo.status <> 'COMPLETE'
          and (wo.due_date is null or wo.due_date >= now())
        )
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'closed', (select count(*) from filtered where status = 'COMPLETE'),
    'remaining', (select count(*) from filtered where status <> 'COMPLETE'),
    'executing', coalesce((
      select jsonb_agg(row_to_json(item))
      from (
        select
          wo.id,
          wo.custom_id as "customId",
          wo.title,
          l.started_at as "startedAt",
          coalesce(nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), ''), 'Usuário') as worker
        from public.labor l
        join filtered wo on wo.id = l.work_order_id
        left join public.membership m on m.id = l.membership_id
        where l.logged
          and l.started_at is not null
        order by l.started_at desc
        limit 20
      ) item
    ), '[]'::jsonb),
    'agenda', coalesce((
      select jsonb_agg(row_to_json(item))
      from (
        select
          wo.id,
          wo.custom_id as "customId",
          wo.title,
          wo.status,
          wo.priority,
          wo.type,
          wo.due_date as "dueDate",
          loc.name as "locationName",
          ast.name as "assetName",
          coalesce((
            select string_agg(
              coalesce(nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), ''), 'Usuário'),
              ', ' order by m.first_name, m.last_name
            )
            from public.work_order_assignee wa
            join public.membership m on m.id = wa.membership_id
            where wa.work_order_id = wo.id
          ), '') as workers
        from filtered wo
        left join public.location loc on loc.id = wo.location_id
        left join public.asset ast on ast.id = wo.asset_id
        where wo.status <> 'COMPLETE'
        order by wo.due_date asc nulls last, wo.created_at desc
        limit 40
      ) item
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.work_orders_dashboard(date, date, uuid, uuid, text, text, text, text) from public;
grant execute on function public.work_orders_dashboard(date, date, uuid, uuid, text, text, text, text) to authenticated;
