-- Período do painel do técnico. p_range nulo mantém a visão do administrador.
-- week = semana corrente; 15 e 30 = dias corridos até hoje, inclusive.

drop function if exists public.maintenance_overview(uuid);

create or replace function public.maintenance_overview(
  p_membership uuid default null,
  p_range text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      now() as now_at,
      (now() at time zone 'America/Sao_Paulo')::date as today
  ),
  cal as (
    select
      today,
      now_at,
      date_trunc('month', today)::date as month_start,
      (date_trunc('month', today) + interval '1 month')::date as month_next,
      (today + 1) as tomorrow,
      date_trunc('week', today)::date as week_start,
      case p_range
        when 'week' then date_trunc('week', today)::date
        when '15' then today - 14
        when '30' then today - 29
        else null
      end as range_start,
      case p_range
        when 'week' then (date_trunc('week', today) + interval '7 days')::date
        when '15' then today + 1
        when '30' then today + 1
        else null
      end as range_end
    from bounds
  ),
  scoped as (
    select wo.*
    from public.work_order wo
    where wo.archived = false
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
  ),
  running as (
    select
      wo.id,
      wo.custom_id,
      wo.title,
      wo.type,
      coalesce(ast.name, wo.title) as asset_name,
      coalesce(nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), ''), 'Usuário') as worker,
      nullif(upper(concat(left(coalesce(m.first_name, ''), 1), left(coalesce(m.last_name, ''), 1))), '') as initials,
      l.started_at,
      greatest(extract(epoch from (now() - l.started_at)), 0)::int as elapsed_seconds,
      (coalesce(wo.estimated_duration, 0) * 3600)::int as estimated_seconds
    from public.labor l
    join scoped wo on wo.id = l.work_order_id
    left join public.asset ast on ast.id = wo.asset_id
    left join public.membership m on m.id = l.membership_id
    where l.logged
      and l.started_at is not null
      and (p_membership is null or l.membership_id = p_membership)
  )
  select jsonb_build_object(
    'today', (select today from cal),
    'monthStart', (select month_start from cal),
    'monthStartDow', (select extract(dow from month_start)::int from cal),
    'openCount', (select count(*) from scoped where status <> 'COMPLETE'),
    'overdueCount', (
      select count(*) from scoped
      where status <> 'COMPLETE' and due_date is not null and due_date < now()
    ),
    'onHoldCount', (select count(*) from scoped where status = 'ON_HOLD'),
    'staleCount', (
      select count(*) from scoped wo
      where wo.status in ('OPEN', 'ON_HOLD')
        and wo.updated_at < now() - interval '48 hours'
        and not exists (select 1 from running r where r.id = wo.id)
    ),
    'readyCount', (
      select count(*) from scoped wo
      where p_membership is not null
        and wo.status <> 'COMPLETE'
        and not exists (select 1 from running r where r.id = wo.id)
        and exists (
          select 1 from public.labor l
          where l.work_order_id = wo.id
            and (l.duration_seconds > 0 or l.started_at is not null)
        )
        and not exists (
          select 1 from public.task t
          where t.work_order_id = wo.id and t.executed_at is null
        )
    ),
    'toStartCount', (
      select count(*) from scoped wo
      where wo.status <> 'COMPLETE'
        and not exists (select 1 from running r where r.id = wo.id)
        and (coalesce(wo.due_date, wo.estimated_start_date) at time zone 'America/Sao_Paulo')::date
          >= coalesce((select range_start from cal), (select month_start from cal))
        and (coalesce(wo.due_date, wo.estimated_start_date) at time zone 'America/Sao_Paulo')::date
          < coalesce((select range_end from cal), (select month_next from cal))
    ),
    'closed30', (
      select count(*) from scoped
      where status = 'COMPLETE' and completed_on >= now() - interval '30 days'
    ),
    'closedPrev30', (
      select count(*) from scoped
      where status = 'COMPLETE'
        and completed_on >= now() - interval '60 days'
        and completed_on < now() - interval '30 days'
    ),
    'closed5w', (
      select count(*) from scoped
      where status = 'COMPLETE'
        and (
          ((select range_start from cal) is null and completed_on >= ((select week_start from cal) - interval '4 weeks')::timestamp at time zone 'America/Sao_Paulo')
          or (
            (select range_start from cal) is not null
            and completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
            and completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
          )
        )
    ),
    'onTime30', (
      select count(*) from scoped
      where status = 'COMPLETE'
        and completed_on >= now() - interval '30 days'
        and due_date is not null
        and completed_on <= due_date
    ),
    'due30', (
      select count(*) from scoped
      where status = 'COMPLETE'
        and completed_on >= now() - interval '30 days'
        and due_date is not null
    ),
    'onTime5w', (
      select count(*) from scoped
      where status = 'COMPLETE'
        and (
          ((select range_start from cal) is null and completed_on >= ((select week_start from cal) - interval '4 weeks')::timestamp at time zone 'America/Sao_Paulo')
          or (
            (select range_start from cal) is not null
            and completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
            and completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
          )
        )
        and (due_date is null or completed_on <= due_date)
    ),
    'late5w', (
      select count(*) from scoped
      where status = 'COMPLETE'
        and (
          ((select range_start from cal) is null and completed_on >= ((select week_start from cal) - interval '4 weeks')::timestamp at time zone 'America/Sao_Paulo')
          or (
            (select range_start from cal) is not null
            and completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
            and completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
          )
        )
        and due_date is not null
        and completed_on > due_date
    ),
    'mttrSeconds', (
      select avg(total_seconds)
      from (
        select sum(l.duration_seconds)::numeric as total_seconds
        from scoped wo
        join public.labor l on l.work_order_id = wo.id
        where wo.type = 'CORRECTIVE'
          and wo.status = 'COMPLETE'
          and wo.completed_on >= now() - interval '30 days'
        group by wo.id
        having sum(l.duration_seconds) > 0
      ) sample
    ),
    'mttrPrevSeconds', (
      select avg(total_seconds)
      from (
        select sum(l.duration_seconds)::numeric as total_seconds
        from scoped wo
        join public.labor l on l.work_order_id = wo.id
        where wo.type = 'CORRECTIVE'
          and wo.status = 'COMPLETE'
          and wo.completed_on >= now() - interval '60 days'
          and wo.completed_on < now() - interval '30 days'
        group by wo.id
        having sum(l.duration_seconds) > 0
      ) sample
    ),
    'status30', jsonb_build_object(
      'OPEN', (
        select count(*) from scoped
        where status = 'OPEN' and created_at >= now() - interval '30 days'
      ),
      'IN_PROGRESS', (
        select count(*) from scoped
        where status = 'IN_PROGRESS' and created_at >= now() - interval '30 days'
      ),
      'ON_HOLD', (
        select count(*) from scoped
        where status = 'ON_HOLD' and created_at >= now() - interval '30 days'
      ),
      'COMPLETE', (
        select count(*) from scoped
        where status = 'COMPLETE' and completed_on >= now() - interval '30 days'
      )
    ),
    'assets', coalesce((
      select jsonb_object_agg(status, total)
      from (
        select status, count(*) as total
        from public.asset
        where archived = false
        group by status
      ) grouped
    ), '{}'::jsonb),
    'downCount', (
      select count(*) from public.asset
      where archived = false and status = 'DOWN'
    ),
    'emergencyCount', (
      select count(*) from public.asset
      where archived = false and status = 'EMERGENCY_SHUTDOWN'
    ),
    'running', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'customId', custom_id,
          'title', title,
          'type', type,
          'assetName', asset_name,
          'worker', worker,
          'initials', initials,
          'startedAt', started_at,
          'elapsedSeconds', elapsed_seconds,
          'estimatedSeconds', estimated_seconds,
          'tasksDone', (
            select count(*) from public.task t
            where t.work_order_id = running.id
              and t.value is not null
              and btrim(t.value) <> ''
          ),
          'tasksTotal', (select count(*) from public.task t where t.work_order_id = running.id)
        )
        order by started_at desc
      )
      from running
    ), '[]'::jsonb),
    'board', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'customId', custom_id,
          'title', title,
          'type', type,
          'status', status,
          'assetName', asset_name,
          'worker', worker,
          'initials', initials,
          'startedAt', started_at,
          'live', started_at is not null,
          'elapsedSeconds', elapsed_seconds,
          'estimatedSeconds', estimated_seconds,
          'tasksDone', tasks_done,
          'tasksTotal', tasks_total
        )
        order by (started_at is not null) desc, due_sort nulls last, custom_id
      )
      from (
        select
          wo.id,
          wo.custom_id,
          wo.title,
          wo.type,
          wo.status,
          coalesce(ast.name, wo.title) as asset_name,
          coalesce(
            nullif(btrim(concat_ws(' ', owner.first_name, owner.last_name)), ''),
            nullif(btrim(concat_ws(' ', assignee.first_name, assignee.last_name)), ''),
            'Sem responsável'
          ) as worker,
          coalesce(
            nullif(upper(concat(
              left(coalesce(owner.first_name, assignee.first_name, ''), 1),
              left(coalesce(owner.last_name, assignee.last_name, ''), 1)
            )), ''),
            '?'
          ) as initials,
          timer.started_at,
          coalesce((
            select sum(
              l.duration_seconds
              + case
                  when l.logged and l.started_at is not null
                    then greatest(extract(epoch from (now() - l.started_at)), 0)
                  else 0
                end
            )::int
            from public.labor l
            where l.work_order_id = wo.id
          ), 0) as elapsed_seconds,
          (coalesce(wo.estimated_duration, 0) * 3600)::int as estimated_seconds,
          (
            select count(*)::int from public.task t
            where t.work_order_id = wo.id
              and t.value is not null
              and btrim(t.value) <> ''
          ) as tasks_done,
          (select count(*)::int from public.task t where t.work_order_id = wo.id) as tasks_total,
          coalesce(wo.due_date, wo.estimated_start_date, wo.created_at) as due_sort
        from scoped wo
        left join public.asset ast on ast.id = wo.asset_id
        left join public.membership owner on owner.id = wo.primary_user_id
        left join lateral (
          select m.first_name, m.last_name
          from public.work_order_assignee wa
          join public.membership m on m.id = wa.membership_id
          where wa.work_order_id = wo.id
          order by m.first_name
          limit 1
        ) assignee on true
        left join lateral (
          select l.started_at
          from public.labor l
          where l.work_order_id = wo.id
            and l.logged
            and l.started_at is not null
            and (p_membership is null or l.membership_id = p_membership)
          order by l.started_at desc
          limit 1
        ) timer on true
        where wo.status <> 'COMPLETE'
      ) open_orders
    ), '[]'::jsonb),
    'overNames', coalesce((
      select string_agg(asset_name, ', ')
      from (
        select asset_name
        from running
        where estimated_seconds > 0 and elapsed_seconds > estimated_seconds
        limit 3
      ) named
    ), ''),
    'upcoming', case
      when p_membership is null then '[]'::jsonb
      else coalesce((
        select jsonb_agg(payload order by sort_at)
        from (
          select
            jsonb_build_object(
              'id', wo.id,
              'customId', wo.custom_id,
              'title', wo.title,
              'type', wo.type,
              'assetName', coalesce(ast.name, wo.title),
              'dueDate', coalesce(wo.due_date, wo.estimated_start_date),
              'estimatedSeconds', (coalesce(wo.estimated_duration, 0) * 3600)::int,
              'running', exists (select 1 from running r where r.id = wo.id),
              'over', exists (
                select 1 from running r
                where r.id = wo.id
                  and r.estimated_seconds > 0
                  and r.elapsed_seconds > r.estimated_seconds
              )
            ) as payload,
            coalesce(wo.due_date, wo.estimated_start_date, wo.created_at) as sort_at
          from scoped wo
          left join public.asset ast on ast.id = wo.asset_id
          where wo.status <> 'COMPLETE'
            and (coalesce(wo.due_date, wo.estimated_start_date) at time zone 'America/Sao_Paulo')::date
              >= coalesce((select range_start from cal), (select today from cal))
            and (coalesce(wo.due_date, wo.estimated_start_date) at time zone 'America/Sao_Paulo')::date
              < coalesce((select range_end from cal), (select tomorrow from cal) + 1)
          order by 2
          limit case when (select range_start from cal) is null then 6 else 40 end
        ) queued
      ), '[]'::jsonb)
    end,
    'byType', coalesce((
      select jsonb_object_agg(type, total)
      from (
        select type, count(*) as total
        from scoped
        where status = 'COMPLETE'
          and (
          ((select range_start from cal) is null and completed_on >= ((select week_start from cal) - interval '4 weeks')::timestamp at time zone 'America/Sao_Paulo')
          or (
            (select range_start from cal) is not null
            and completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
            and completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
          )
        )
        group by type
      ) grouped
    ), '{}'::jsonb),
    'weeks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'start', ws,
          'label', to_char(ws, 'DD/MM'),
          'current', ws = (select week_start from cal),
          'closed', (
            select count(*) from scoped wo
            where wo.status = 'COMPLETE'
              and wo.completed_on >= (ws::timestamp at time zone 'America/Sao_Paulo')
              and wo.completed_on < ((ws + 7)::timestamp at time zone 'America/Sao_Paulo')
              and (
                (select range_start from cal) is null
                or (
                  wo.completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
                  and wo.completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
                )
              )
          ),
          'onTime', (
            select count(*) from scoped wo
            where wo.status = 'COMPLETE'
              and wo.completed_on >= (ws::timestamp at time zone 'America/Sao_Paulo')
              and wo.completed_on < ((ws + 7)::timestamp at time zone 'America/Sao_Paulo')
              and (
                (select range_start from cal) is null
                or (
                  wo.completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
                  and wo.completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
                )
              )
              and (wo.due_date is null or wo.completed_on <= wo.due_date)
          ),
          'late', (
            select count(*) from scoped wo
            where wo.status = 'COMPLETE'
              and wo.completed_on >= (ws::timestamp at time zone 'America/Sao_Paulo')
              and wo.completed_on < ((ws + 7)::timestamp at time zone 'America/Sao_Paulo')
              and (
                (select range_start from cal) is null
                or (
                  wo.completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
                  and wo.completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
                )
              )
              and wo.due_date is not null
              and wo.completed_on > wo.due_date
          )
        )
        order by ws
      )
      from (
        select ((select week_start from cal) - (i || ' weeks')::interval)::date as ws
        from generate_series(5, 0, -1) as g(i)
        where (select range_start from cal) is null
        union all
        select date_trunc('week', d)::date as ws
        from generate_series(
          coalesce((select range_start from cal), (select today from cal))::timestamp,
          coalesce(((select range_end from cal) - 1), (select today from cal))::timestamp,
          interval '1 day'
        ) as g(d)
        where (select range_start from cal) is not null
        group by 1
      ) series
    ), '[]'::jsonb),
    'correctiveRank', coalesce((
      select jsonb_agg(
        jsonb_build_object('name', name, 'count', total)
        order by total desc, name
      )
      from (
        select ast.name, count(*) as total
        from scoped wo
        join public.asset ast on ast.id = wo.asset_id
        where wo.type = 'CORRECTIVE'
          and wo.created_at >= now() - interval '90 days'
        group by ast.id, ast.name
        order by count(*) desc, ast.name
        limit 5
      ) ranked
    ), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', extract(day from gs)::int,
          'preventive', coalesce(bucket.preventive, 0),
          'corrective', coalesce(bucket.corrective, 0),
          'predictive', coalesce(bucket.predictive, 0),
          'items', coalesce(bucket.items, '[]'::jsonb)
        )
        order by gs
      )
      from generate_series(
        (select month_start from cal),
        (select month_next from cal) - 1,
        interval '1 day'
      ) as gs
      left join lateral (
        select
          count(*) filter (where wo.type = 'PREVENTIVE') as preventive,
          count(*) filter (where wo.type = 'CORRECTIVE') as corrective,
          count(*) filter (where wo.type = 'PREDICTIVE') as predictive,
          (
            select coalesce(jsonb_agg(jsonb_build_object('type', picked.type, 'state', picked.state)), '[]'::jsonb)
            from (
              select
                wo2.type,
                case
                  when wo2.status = 'COMPLETE' then 'done'
                  when exists (select 1 from running r where r.id = wo2.id) then 'running'
                  else 'pending'
                end as state
              from scoped wo2
              where (coalesce(wo2.due_date, wo2.estimated_start_date, wo2.completed_on) at time zone 'America/Sao_Paulo')::date = gs::date
              order by coalesce(wo2.due_date, wo2.estimated_start_date, wo2.completed_on)
              limit 4
            ) picked
          ) as items
        from scoped wo
        where (coalesce(wo.due_date, wo.estimated_start_date, wo.completed_on) at time zone 'America/Sao_Paulo')::date = gs::date
      ) bucket on true
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.maintenance_overview(uuid, text) from public, anon;
grant execute on function public.maintenance_overview(uuid, text) to authenticated;
