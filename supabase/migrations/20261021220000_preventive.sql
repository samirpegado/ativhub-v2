-- Agendamentos de preventiva: lista, detalhe e geração de ordens.
-- security invoker nas RPCs de tela. A geração usa a sessão do usuário
-- (só o tenant dele) e, no cron, o papel do banco, que enxerga todos.

alter table public.pm_task_template
  add column if not exists options jsonb not null default '[]'::jsonb;

alter table public.work_order
  drop constraint if exists work_order_parent_pm_id_fkey;

alter table public.work_order
  add constraint work_order_parent_pm_id_fkey
  foreign key (parent_pm_id) references public.preventive_maintenance(id) on delete set null;

create or replace function public.pm_next_run(
  p_from timestamptz,
  p_starts_on timestamptz,
  p_frequency integer,
  p_type text,
  p_days integer[],
  p_use_weekdays boolean
)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_cursor timestamptz;
  v_dow integer;
  v_week integer;
  v_steps integer := 0;
  v_freq integer := greatest(coalesce(p_frequency, 1), 1);
begin
  if p_from is null then
    return null;
  end if;

  if p_type = 'WEEKLY' and p_use_weekdays and coalesce(cardinality(p_days), 0) > 0 then
    v_cursor := p_from;
    loop
      v_steps := v_steps + 1;
      if v_steps > 366 * v_freq then
        return null;
      end if;
      v_cursor := v_cursor + interval '1 day';
      v_dow := extract(isodow from v_cursor)::integer - 1;
      if v_dow = any (p_days) then
        v_week := floor(extract(epoch from (
          date_trunc('week', timezone('UTC', v_cursor))
          - date_trunc('week', timezone('UTC', p_starts_on))
        )) / 604800)::integer;
        if mod(v_week, v_freq) = 0 then
          return v_cursor;
        end if;
      end if;
    end loop;
  end if;

  return case p_type
    when 'WEEKLY' then p_from + make_interval(weeks => v_freq)
    when 'MONTHLY' then p_from + make_interval(months => v_freq)
    when 'YEARLY' then p_from + make_interval(years => v_freq)
    else p_from + make_interval(days => v_freq)
  end;
end;
$$;

create or replace function public.refresh_preventive_schedule(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  pm public.preventive_maintenance%rowtype;
  v_next timestamptz;
  v_done timestamptz;
  v_guard integer := 0;
begin
  select * into pm
  from public.preventive_maintenance
  where id = p_id
  for update;

  if pm.id is null or pm.disabled then
    return;
  end if;

  v_next := pm.starts_on;

  if exists (
    select 1 from public.work_order
    where parent_pm_id = pm.id and archived = false
  ) then
    if pm.recurrence_based_on = 'COMPLETED_DATE' then
      if exists (
        select 1 from public.work_order
        where parent_pm_id = pm.id
          and archived = false
          and status <> 'COMPLETE'
      ) then
        v_next := null;
      else
        select completed_on into v_done
        from public.work_order
        where parent_pm_id = pm.id and status = 'COMPLETE'
        order by completed_on desc nulls last
        limit 1;
        v_next := public.pm_next_run(
          coalesce(v_done, now()), pm.starts_on, pm.frequency, pm.recurrence_type, pm.days_of_week, false
        );
      end if;
    else
      while v_next is not null and v_next <= now() loop
        v_guard := v_guard + 1;
        if v_guard > 500 then
          v_next := null;
          exit;
        end if;
        v_next := public.pm_next_run(
          v_next, pm.starts_on, pm.frequency, pm.recurrence_type, pm.days_of_week, true
        );
      end loop;
    end if;
  end if;

  if pm.ends_on is not null and v_next is not null and v_next > pm.ends_on then
    v_next := null;
  end if;

  update public.preventive_maintenance
  set next_run_at = v_next
  where id = pm.id;
end;
$$;

create or replace function public.generate_due_preventive_work_orders()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  pm public.preventive_maintenance%rowtype;
  v_created integer := 0;
  v_count integer;
  v_reacted integer;
  v_wo uuid;
  v_next timestamptz;
  v_guard integer;
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

    select count(*), count(first_time_to_react)
      into v_count, v_reacted
    from public.work_order
    where parent_pm_id = pm.id
      and archived = false;

    if v_count >= 5 and v_reacted = 0 then
      update public.preventive_maintenance
      set disabled = true, next_run_at = null
      where id = pm.id;
      continue;
    end if;

    insert into public.work_order (
      tenant_id, title, description, priority, location_id, asset_id, team_id,
      primary_user_id, estimated_duration, due_date, parent_pm_id, status
    ) values (
      pm.tenant_id,
      pm.title,
      pm.description,
      pm.priority,
      pm.location_id,
      pm.asset_id,
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

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

create or replace function public.preventive_after_work_order()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_next timestamptz;
  pm public.preventive_maintenance%rowtype;
begin
  if new.parent_pm_id is null
    or new.status <> 'COMPLETE'
    or old.status = 'COMPLETE' then
    return new;
  end if;

  select * into pm
  from public.preventive_maintenance
  where id = new.parent_pm_id
    and recurrence_based_on = 'COMPLETED_DATE'
    and disabled = false;

  if pm.id is null then
    return new;
  end if;

  v_next := public.pm_next_run(
    coalesce(new.completed_on, now()),
    pm.starts_on,
    pm.frequency,
    pm.recurrence_type,
    pm.days_of_week,
    false
  );

  if pm.ends_on is not null and v_next is not null and v_next > pm.ends_on then
    v_next := null;
  end if;

  update public.preventive_maintenance
  set next_run_at = v_next
  where id = pm.id;

  return new;
end;
$$;

drop trigger if exists preventive_after_work_order on public.work_order;

create trigger preventive_after_work_order
  after update of status on public.work_order
  for each row
  execute function public.preventive_after_work_order();

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
          pm.asset_id as "assetId",
          ast.name as "assetName",
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
        left join public.asset ast on ast.id = pm.asset_id
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
        'assetId', pm.asset_id,
        'assetName', ast.name,
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
      left join public.asset ast on ast.id = pm.asset_id
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

revoke all on function public.pm_next_run(timestamptz, timestamptz, integer, text, integer[], boolean) from public;
revoke all on function public.pm_next_run(timestamptz, timestamptz, integer, text, integer[], boolean) from anon;
revoke all on function public.refresh_preventive_schedule(uuid) from public;
revoke all on function public.refresh_preventive_schedule(uuid) from anon;
revoke all on function public.generate_due_preventive_work_orders() from public;
revoke all on function public.generate_due_preventive_work_orders() from anon;
revoke all on function public.preventive_screen(text, text, integer, integer) from public;
revoke all on function public.preventive_screen(text, text, integer, integer) from anon;
revoke all on function public.preventive_detail(uuid) from public;
revoke all on function public.preventive_detail(uuid) from anon;

grant execute on function public.refresh_preventive_schedule(uuid) to authenticated;
grant execute on function public.generate_due_preventive_work_orders() to authenticated;
grant execute on function public.preventive_screen(text, text, integer, integer) to authenticated;
grant execute on function public.preventive_detail(uuid) to authenticated;
