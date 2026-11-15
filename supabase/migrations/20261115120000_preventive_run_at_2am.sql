-- A preventiva nasce às 2h em America/Sao_Paulo (05:00 UTC; o Brasil não tem horário de verão).

update public.preventive_maintenance
set
  starts_on = (((starts_on at time zone 'UTC')::date + time '05:00:00') at time zone 'UTC'),
  ends_on = case
    when ends_on is null then null
    else (((ends_on at time zone 'UTC')::date + time '05:00:00') at time zone 'UTC')
  end,
  next_run_at = case
    when next_run_at is null then null
    else (((next_run_at at time zone 'UTC')::date + time '05:00:00') at time zone 'UTC')
  end;

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
  v_result timestamptz;
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
          v_result := v_cursor;
          exit;
        end if;
      end if;
    end loop;
  else
    v_result := case p_type
      when 'WEEKLY' then p_from + make_interval(weeks => v_freq)
      when 'MONTHLY' then p_from + make_interval(months => v_freq)
      when 'YEARLY' then p_from + make_interval(years => v_freq)
      else p_from + make_interval(days => v_freq)
    end;
  end if;

  if v_result is null then
    return null;
  end if;

  return (((v_result at time zone 'UTC')::date + time '05:00:00') at time zone 'UTC');
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
    if pm.ends_on is not null and pm.next_run_at > pm.ends_on then
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

      insert into public.work_order_assignee (work_order_id, membership_id)
      select v_wo, source.membership_id
      from (
        select pa.membership_id
        from public.pm_assignee pa
        where pa.pm_id = pm.id
        union
        select pm.primary_user_id
        where pm.primary_user_id is not null
      ) source
      on conflict do nothing;

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

      insert into public.work_order_assignee (work_order_id, membership_id)
      select v_wo, source.membership_id
      from (
        select pa.membership_id
        from public.pm_assignee pa
        where pa.pm_id = pm.id
        union
        select pm.primary_user_id
        where pm.primary_user_id is not null
      ) source
      on conflict do nothing;

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

do $$
begin
  if exists (select 1 from cron.job where jobname = 'preventive-work-orders') then
    perform cron.unschedule('preventive-work-orders');
  end if;
end $$;

select cron.schedule(
  'preventive-work-orders',
  '0 * * * *',
  $$select public.generate_due_preventive_work_orders()$$
);
