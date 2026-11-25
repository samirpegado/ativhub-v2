create table platform_private.membership_activity (
  membership_id uuid primary key references public.membership (id) on delete cascade,
  last_access_at timestamptz not null
);

alter table platform_private.membership_activity enable row level security;
revoke all on table platform_private.membership_activity from public, anon, authenticated, service_role;

create function platform_private.record_membership_access()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into platform_private.membership_activity as activity (membership_id, last_access_at)
  select m.id, now()
  from public.membership m
  join public.subscription sub on sub.tenant_id = m.tenant_id
  join auth.users u on u.id = m.user_id
  join auth.sessions s on s.user_id = m.user_id
    and s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  where m.user_id = auth.uid()
    and m.tenant_id = public.current_tenant_id()
    and m.enabled
    and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until <= now())
    and (s.not_after is null or s.not_after > now())
    -- Same operational access rule as src/lib/billing/access.ts.
    and (
      (sub.status = 'TRIALING' and sub.trial_ends_at > now())
      or (sub.status = 'ACTIVE' and (sub.current_period_end is null or sub.current_period_end > now()))
    )
    and not exists (
      select 1 from platform_private.platform_admin a where a.user_id = m.user_id
    )
  on conflict (membership_id) do update
    set last_access_at = excluded.last_access_at
    where activity.last_access_at <= excluded.last_access_at - interval '5 minutes';
$$;

create function public.record_membership_access()
returns void
language sql
security invoker
set search_path = ''
as $$
  select platform_private.record_membership_access();
$$;

revoke all on function platform_private.record_membership_access(), public.record_membership_access()
  from public, anon, authenticated, service_role;
grant execute on function platform_private.record_membership_access(), public.record_membership_access()
  to authenticated;

create or replace function platform_private.platform_tenant_screen(
  p_tenant_id uuid,
  p_tab text,
  p_search text,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := platform_private.platform_admin_actor(true);
  v_search text := nullif(lower(left(btrim(p_search), 120)), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_tenant jsonb;
  v_page jsonb;
begin
  if v_actor is null then
    raise exception 'Platform administrator access required' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_tab is null or p_tab not in ('customers', 'people') then
    raise exception 'Invalid tenant or tab' using errcode = '22023';
  end if;

  insert into platform_private.platform_admin_audit (actor_user_id, action, tenant_id)
  values (
    v_actor,
    case p_tab when 'customers' then 'tenant_customers_listed' else 'tenant_people_listed' end,
    p_tenant_id
  );

  select platform_private.tenant_summary(t.id, t.name, t.created_at)
  into v_tenant
  from public.tenant t
  where t.id = p_tenant_id;
  if not found then
    return null;
  end if;

  if p_tab = 'customers' then
    with filtered as (
      select c.id, c.name, c.is_internal, c.customer_type
      from public.customer c
      where c.tenant_id = p_tenant_id
        and (
          v_search is null
          or strpos(lower(c.name), v_search) > 0
          or strpos(lower(c.customer_type), v_search) > 0
        )
    ), page as (
      select * from filtered
      order by is_internal desc, name, id
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'rows', coalesce(jsonb_agg(jsonb_build_object(
        'id', page.id,
        'name', page.name,
        'isInternal', page.is_internal,
        'customerType', page.customer_type
      ) order by page.is_internal desc, page.name, page.id), '[]'::jsonb)
    )
    into v_page
    from page;
  else
    with filtered as (
      select m.id, m.user_id, m.first_name, m.last_name, m.email, m.enabled, r.name as role_name
      from public.membership m
      left join public.role r on r.id = m.role_id and r.tenant_id = p_tenant_id
      where m.tenant_id = p_tenant_id
        and (
          v_search is null
          or strpos(lower(concat_ws(' ', m.first_name, m.last_name)), v_search) > 0
          or strpos(lower(m.email), v_search) > 0
          or strpos(lower(r.name), v_search) > 0
        )
    ), page as (
      select * from filtered
      order by first_name, last_name, id
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'rows', coalesce(jsonb_agg(jsonb_build_object(
        'id', page.id,
        'firstName', page.first_name,
        'lastName', page.last_name,
        'email', page.email,
        'roleName', page.role_name,
        'enabled', page.enabled,
        'lastSignInAt', u.last_sign_in_at,
        'lastAccessAt', activity.last_access_at
      ) order by page.first_name, page.last_name, page.id), '[]'::jsonb)
    )
    into v_page
    from page
    left join auth.users u on u.id = page.user_id
    left join platform_private.membership_activity activity on activity.membership_id = page.id;
  end if;

  return v_page || jsonb_build_object('tenant', v_tenant);
end;
$$;
