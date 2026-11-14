-- A preventiva guarda vários responsáveis, como a ordem de serviço.

create table if not exists public.pm_assignee (
  pm_id uuid not null references public.preventive_maintenance(id) on delete cascade,
  membership_id uuid not null references public.membership(id) on delete cascade,
  primary key (pm_id, membership_id)
);

alter table public.pm_assignee enable row level security;

drop policy if exists pm_assignee_isolation on public.pm_assignee;
create policy pm_assignee_isolation on public.pm_assignee
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

insert into public.pm_assignee (pm_id, membership_id)
select id, primary_user_id
from public.preventive_maintenance
where primary_user_id is not null
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

