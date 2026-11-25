-- Single read-only dashboard query shared by the operational dashboard and
-- the support preview. The operational wrapper still applies tenant RLS.
-- Explicit tenant sources are also required for the guarded support caller.
create function platform_private.maintenance_overview_for_tenant(
  p_tenant_id uuid,
  p_membership uuid,
  p_range text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
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
      end as range_end,
      case p_range
        when 'week' then (date_trunc('week', today) - interval '7 days')::date
        when '15' then today - 29
        when '30' then today - 59
        else null
      end as prev_start,
      case p_range
        when 'week' then date_trunc('week', today)::date
        when '15' then today - 14
        when '30' then today - 29
        else null
      end as prev_end
    from bounds
  ),
  tenant_work_orders as not materialized (
    select wo.* from public.work_order wo where wo.tenant_id = p_tenant_id
  ),
  tenant_memberships as not materialized (
    select m.* from public.membership m where m.tenant_id = p_tenant_id
  ),
  tenant_assignees as not materialized (
    select wa.*
    from public.work_order_assignee wa
    join tenant_work_orders wo on wo.id = wa.work_order_id
    join tenant_memberships m on m.id = wa.membership_id
  ),
  tenant_assets as not materialized (
    select a.* from public.asset a where a.tenant_id = p_tenant_id
  ),
  tenant_labor as not materialized (
    select l.* from public.labor l
    where l.tenant_id = p_tenant_id
      and (l.membership_id is null or exists (
        select 1 from tenant_memberships m where m.id = l.membership_id
      ))
  ),
  tenant_tasks as not materialized (
    select t.* from public.task t where t.tenant_id = p_tenant_id
  ),
  scoped as (
    select wo.*
    from tenant_work_orders wo
    where wo.archived = false
      and (
        p_membership is null
        or wo.primary_user_id = p_membership
        or exists (
          select 1
          from tenant_assignees wa
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
    from tenant_labor l
    join scoped wo on wo.id = l.work_order_id
    left join tenant_assets ast on ast.id = wo.asset_id
    left join tenant_memberships m on m.id = l.membership_id
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
          select 1 from tenant_labor l
          where l.work_order_id = wo.id
            and (l.duration_seconds > 0 or l.started_at is not null)
        )
        and not exists (
          select 1 from tenant_tasks t
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
      where status = 'COMPLETE'
        and (
          ((select range_start from cal) is null and completed_on >= now() - interval '30 days')
          or (
            (select range_start from cal) is not null
            and completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
            and completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
          )
        )
    ),
    'closedPrev30', (
      select count(*) from scoped
      where status = 'COMPLETE'
        and (
          ((select range_start from cal) is null
            and completed_on >= now() - interval '60 days'
            and completed_on < now() - interval '30 days')
          or (
            (select prev_start from cal) is not null
            and completed_on >= ((select prev_start from cal)::timestamp at time zone 'America/Sao_Paulo')
            and completed_on < ((select prev_end from cal)::timestamp at time zone 'America/Sao_Paulo')
          )
        )
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
        and (
          ((select range_start from cal) is null and completed_on >= now() - interval '30 days')
          or (
            (select range_start from cal) is not null
            and completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
            and completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
          )
        )
        and due_date is not null
        and completed_on <= due_date
    ),
    'due30', (
      select count(*) from scoped
      where status = 'COMPLETE'
        and (
          ((select range_start from cal) is null and completed_on >= now() - interval '30 days')
          or (
            (select range_start from cal) is not null
            and completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
            and completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
          )
        )
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
        join tenant_labor l on l.work_order_id = wo.id
        where wo.type = 'CORRECTIVE'
          and wo.status = 'COMPLETE'
          and (
            ((select range_start from cal) is null and wo.completed_on >= now() - interval '30 days')
            or (
              (select range_start from cal) is not null
              and wo.completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
              and wo.completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
            )
          )
        group by wo.id
        having sum(l.duration_seconds) > 0
      ) sample
    ),
    'mttrPrevSeconds', (
      select avg(total_seconds)
      from (
        select sum(l.duration_seconds)::numeric as total_seconds
        from scoped wo
        join tenant_labor l on l.work_order_id = wo.id
        where wo.type = 'CORRECTIVE'
          and wo.status = 'COMPLETE'
          and (
            ((select range_start from cal) is null
              and wo.completed_on >= now() - interval '60 days'
              and wo.completed_on < now() - interval '30 days')
            or (
              (select prev_start from cal) is not null
              and wo.completed_on >= ((select prev_start from cal)::timestamp at time zone 'America/Sao_Paulo')
              and wo.completed_on < ((select prev_end from cal)::timestamp at time zone 'America/Sao_Paulo')
            )
          )
        group by wo.id
        having sum(l.duration_seconds) > 0
      ) sample
    ),
    'status30', jsonb_build_object(
      'OPEN', (
        select count(*) from scoped
        where status = 'OPEN'
          and (
            ((select range_start from cal) is null and created_at >= now() - interval '30 days')
            or (
              (select range_start from cal) is not null
              and created_at >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
              and created_at < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
            )
          )
      ),
      'IN_PROGRESS', (
        select count(*) from scoped
        where status = 'IN_PROGRESS'
          and (
            ((select range_start from cal) is null and created_at >= now() - interval '30 days')
            or (
              (select range_start from cal) is not null
              and created_at >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
              and created_at < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
            )
          )
      ),
      'ON_HOLD', (
        select count(*) from scoped
        where status = 'ON_HOLD'
          and (
            ((select range_start from cal) is null and created_at >= now() - interval '30 days')
            or (
              (select range_start from cal) is not null
              and created_at >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
              and created_at < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
            )
          )
      ),
      'COMPLETE', (
        select count(*) from scoped
        where status = 'COMPLETE'
          and (
            ((select range_start from cal) is null and completed_on >= now() - interval '30 days')
            or (
              (select range_start from cal) is not null
              and completed_on >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
              and completed_on < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
            )
          )
      )
    ),
    'assets', coalesce((
      select jsonb_object_agg(status, total)
      from (
        select status, count(*) as total
        from tenant_assets
        where archived = false
        group by status
      ) grouped
    ), '{}'::jsonb),
    'downCount', (
      select count(*) from tenant_assets
      where archived = false and status = 'DOWN'
    ),
    'emergencyCount', (
      select count(*) from tenant_assets
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
            select count(*) from tenant_tasks t
            where t.work_order_id = running.id
              and t.value is not null
              and btrim(t.value) <> ''
          ),
          'tasksTotal', (select count(*) from tenant_tasks t where t.work_order_id = running.id)
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
            from tenant_labor l
            where l.work_order_id = wo.id
          ), 0) as elapsed_seconds,
          (coalesce(wo.estimated_duration, 0) * 3600)::int as estimated_seconds,
          (
            select count(*)::int from tenant_tasks t
            where t.work_order_id = wo.id
              and t.value is not null
              and btrim(t.value) <> ''
          ) as tasks_done,
          (select count(*)::int from tenant_tasks t where t.work_order_id = wo.id) as tasks_total,
          coalesce(wo.due_date, wo.estimated_start_date, wo.created_at) as due_sort
        from scoped wo
        left join tenant_assets ast on ast.id = wo.asset_id
        left join tenant_memberships owner on owner.id = wo.primary_user_id
        left join lateral (
          select m.first_name, m.last_name
          from tenant_assignees wa
          join tenant_memberships m on m.id = wa.membership_id
          where wa.work_order_id = wo.id
          order by m.first_name
          limit 1
        ) assignee on true
        left join lateral (
          select l.started_at
          from tenant_labor l
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
          left join tenant_assets ast on ast.id = wo.asset_id
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
        join tenant_assets ast on ast.id = wo.asset_id
        where wo.type = 'CORRECTIVE'
          and (
            ((select range_start from cal) is null and wo.created_at >= now() - interval '90 days')
            or (
              (select range_start from cal) is not null
              and wo.created_at >= ((select range_start from cal)::timestamp at time zone 'America/Sao_Paulo')
              and wo.created_at < ((select range_end from cal)::timestamp at time zone 'America/Sao_Paulo')
            )
          )
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

create or replace function public.maintenance_overview(
  p_membership uuid default null,
  p_range text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select platform_private.maintenance_overview_for_tenant(
    public.current_tenant_id(), p_membership, p_range
  );
$$;

alter table platform_private.platform_admin
  add column can_support boolean not null default false;

-- The allowlist already restricts the table to the sole authorized account.
update platform_private.platform_admin
set can_support = true
where revoked_at is null;

-- Store identifiers as historical facts so audit is retained if an account,
-- membership, tenant or Auth session is deleted later.
create table platform_private.support_preview (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  auth_session_id uuid not null,
  tenant_id uuid not null,
  membership_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 300),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  closed_at timestamptz,
  close_reason text check (close_reason in ('ended', 'expired', 'revoked')),
  check ((closed_at is null) = (close_reason is null))
);

create table platform_private.support_preview_audit (
  id uuid primary key default gen_random_uuid(),
  preview_id uuid not null references platform_private.support_preview (id),
  event text not null check (event in ('started', 'viewed', 'ended', 'expired', 'revoked')),
  occurred_at timestamptz not null default clock_timestamp()
);

create index support_preview_audit_preview_id_occurred_at_idx
  on platform_private.support_preview_audit (preview_id, occurred_at);

create index support_preview_open_actor_idx
  on platform_private.support_preview (actor_user_id) where closed_at is null;

alter table platform_private.support_preview enable row level security;
alter table platform_private.support_preview_audit enable row level security;
revoke all on table platform_private.support_preview, platform_private.support_preview_audit
  from public, anon, authenticated, service_role;

create function platform_private.support_preview_actor()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select a.user_id
  from platform_private.platform_admin a
  where a.user_id = platform_private.platform_admin_actor(false)
    and a.can_support;
$$;

create function platform_private.support_preview_status()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select platform_private.support_preview_actor() is not null;
$$;

create function platform_private.support_preview_target(p_tenant_id uuid, p_membership_id uuid)
returns table (
  tenant_name text,
  first_name text,
  last_name text,
  role_name text,
  role_code text,
  permissions jsonb,
  is_owner boolean,
  subscription_open boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.name, m.first_name, m.last_name, r.name, r.code, r.permissions, m.is_owner,
    coalesce(
      (s.status = 'TRIALING' and s.trial_ends_at > now())
      or (s.status = 'ACTIVE' and (s.current_period_end is null or s.current_period_end > now())),
      false
    )
  from public.membership m
  join public.tenant t on t.id = m.tenant_id
  join public.role r on r.id = m.role_id and r.tenant_id = m.tenant_id
  join auth.users u on u.id = m.user_id
  left join public.subscription s on s.tenant_id = m.tenant_id
  where m.tenant_id = p_tenant_id
    and m.id = p_membership_id
    and m.enabled
    and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until <= now());
$$;

create function platform_private.support_preview_for_session(p_preview_id uuid)
returns platform_private.support_preview
language sql
security invoker
set search_path = ''
as $$
  select p.*
  from platform_private.support_preview p
  where p.id = p_preview_id
    and p.actor_user_id = auth.uid()
    and p.auth_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  for update;
$$;

create function platform_private.close_support_preview(p_preview_id uuid, p_event text)
returns void
language sql
security invoker
set search_path = ''
as $$
  with closed as (
    update platform_private.support_preview
    set closed_at = clock_timestamp(), close_reason = p_event
    where id = p_preview_id and closed_at is null
    returning id
  )
  insert into platform_private.support_preview_audit (preview_id, event)
  select id, p_event from closed;
$$;

create function platform_private.close_revoked_support_previews()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'UPDATE' then
    if new.can_support and new.revoked_at is null then
      return null;
    end if;
  end if;

  with closed as (
    update platform_private.support_preview p
    set closed_at = v_now,
      close_reason = case when p.expires_at <= v_now then 'expired' else 'revoked' end
    where p.actor_user_id = old.user_id and p.closed_at is null
    returning p.id, p.close_reason
  )
  insert into platform_private.support_preview_audit (preview_id, event)
  select id, close_reason from closed;

  return null;
end;
$$;

create trigger platform_admin_close_revoked_support_previews
after update of can_support, revoked_at or delete on platform_private.platform_admin
for each row execute function platform_private.close_revoked_support_previews();

create function platform_private.start_support_preview(p_tenant_id uuid, p_membership_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := platform_private.support_preview_actor();
  v_reason text := regexp_replace(p_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'Support preview access denied' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) not between 3 and 300 then
    raise exception 'Invalid support preview reason' using errcode = '22023';
  end if;
  if not exists (select 1 from platform_private.support_preview_target(p_tenant_id, p_membership_id)) then
    return null;
  end if;

  -- Serialize creation with revocation so a later regrant cannot revive a preview.
  perform 1
  from platform_private.platform_admin a
  where a.user_id = v_actor and a.can_support and a.revoked_at is null
  for share;
  if not found then
    raise exception 'Support preview access denied' using errcode = '42501';
  end if;

  insert into platform_private.support_preview (actor_user_id, auth_session_id, tenant_id, membership_id, reason)
  values (v_actor, (auth.jwt() ->> 'session_id')::uuid, p_tenant_id, p_membership_id, v_reason)
  returning id into v_id;

  insert into platform_private.support_preview_audit (preview_id, event) values (v_id, 'started');
  return v_id;
end;
$$;

create function platform_private.read_support_preview(p_preview_id uuid, p_range text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preview platform_private.support_preview%rowtype;
  v_target record;
  v_is_admin boolean;
  v_area jsonb;
  v_can_edit boolean;
  v_can_view boolean;
  v_range text := case when p_range in ('week', '15', '30') then p_range else '30' end;
  v_overview jsonb;
begin
  v_preview := platform_private.support_preview_for_session(p_preview_id);
  if v_preview.id is null or v_preview.closed_at is not null then
    return null;
  end if;
  if v_preview.expires_at <= clock_timestamp() then
    perform platform_private.close_support_preview(v_preview.id, 'expired');
    return null;
  end if;
  if platform_private.support_preview_actor() is null then
    perform platform_private.close_support_preview(v_preview.id, 'revoked');
    return null;
  end if;

  select * into v_target
  from platform_private.support_preview_target(v_preview.tenant_id, v_preview.membership_id);
  if not found then
    perform platform_private.close_support_preview(v_preview.id, 'revoked');
    return null;
  end if;

  -- Keep this area check aligned with areasFromPermissions in src/lib/auth/areas.ts.
  v_is_admin := v_target.is_owner or v_target.role_code = 'ADMIN';
  v_area := v_target.permissions #> '{areas,work_orders}';
  if jsonb_typeof(v_area) = 'object' then
    v_can_edit := v_is_admin or coalesce(v_area -> 'edit' = 'true'::jsonb, false);
    v_can_view := v_can_edit or coalesce(v_area -> 'view' = 'true'::jsonb, false);
  else
    v_can_edit := v_is_admin;
    v_can_view := v_is_admin or v_target.role_code <> 'REQUESTER';
  end if;

  if v_can_view and v_target.subscription_open then
    v_overview := platform_private.maintenance_overview_for_tenant(
      v_preview.tenant_id,
      case when v_can_edit then null else v_preview.membership_id end,
      v_range
    );
    -- A role-only view receives the dashboard metrics it renders. The rest
    -- of the shared operational payload can include company-wide metrics.
    if not v_can_edit then
      select jsonb_object_agg(key, value) into v_overview
      from jsonb_each(v_overview)
      where key in (
        'today', 'openCount', 'readyCount', 'closed5w', 'running', 'toStartCount',
        'upcoming', 'onTime5w', 'late5w', 'weeks', 'byType'
      );
    end if;
  end if;

  if v_preview.expires_at <= clock_timestamp() then
    perform platform_private.close_support_preview(v_preview.id, 'expired');
    return null;
  end if;
  insert into platform_private.support_preview_audit (preview_id, event) values (v_preview.id, 'viewed');
  return jsonb_build_object(
    'tenantId', v_preview.tenant_id,
    'tenantName', v_target.tenant_name,
    'membershipId', v_preview.membership_id,
    'firstName', v_target.first_name,
    'lastName', v_target.last_name,
    'roleName', v_target.role_name,
    'roleCode', v_target.role_code,
    'permissions', v_target.permissions,
    'isOwner', v_target.is_owner,
    'subscriptionOpen', v_target.subscription_open,
    'expiresAt', v_preview.expires_at,
    'overview', v_overview
  );
end;
$$;

create function platform_private.end_support_preview(p_preview_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preview platform_private.support_preview%rowtype;
begin
  v_preview := platform_private.support_preview_for_session(p_preview_id);
  if v_preview.id is null then
    return null;
  end if;
  if v_preview.expires_at <= clock_timestamp() then
    perform platform_private.close_support_preview(v_preview.id, 'expired');
  end if;
  if platform_private.support_preview_actor() is null then
    perform platform_private.close_support_preview(v_preview.id, 'revoked');
    return null;
  end if;

  perform platform_private.close_support_preview(v_preview.id, 'ended');
  return v_preview.tenant_id;
end;
$$;

create function public.platform_support_preview_status()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select platform_private.support_preview_status();
$$;

create function public.platform_start_support_preview(p_tenant_id uuid, p_membership_id uuid, p_reason text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select platform_private.start_support_preview(p_tenant_id, p_membership_id, p_reason);
$$;

create function public.platform_read_support_preview(p_preview_id uuid, p_range text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select platform_private.read_support_preview(p_preview_id, p_range);
$$;

create function public.platform_end_support_preview(p_preview_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select platform_private.end_support_preview(p_preview_id);
$$;

revoke all on function
  platform_private.maintenance_overview_for_tenant(uuid, uuid, text),
  platform_private.support_preview_actor(),
  platform_private.support_preview_status(),
  platform_private.support_preview_target(uuid, uuid),
  platform_private.support_preview_for_session(uuid),
  platform_private.close_support_preview(uuid, text),
  platform_private.close_revoked_support_previews(),
  platform_private.start_support_preview(uuid, uuid, text),
  platform_private.read_support_preview(uuid, text),
  platform_private.end_support_preview(uuid),
  public.platform_support_preview_status(),
  public.platform_start_support_preview(uuid, uuid, text),
  public.platform_read_support_preview(uuid, text),
  public.platform_end_support_preview(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  platform_private.maintenance_overview_for_tenant(uuid, uuid, text),
  platform_private.support_preview_status(),
  platform_private.start_support_preview(uuid, uuid, text),
  platform_private.read_support_preview(uuid, text),
  platform_private.end_support_preview(uuid),
  public.platform_support_preview_status(),
  public.platform_start_support_preview(uuid, uuid, text),
  public.platform_read_support_preview(uuid, text),
  public.platform_end_support_preview(uuid)
to authenticated;
