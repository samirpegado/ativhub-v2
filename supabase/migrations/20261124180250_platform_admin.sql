create schema platform_private;
revoke all on schema platform_private from public, anon, authenticated, service_role;

create table platform_private.platform_admin (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint platform_admin_authorized_user_only
    check (user_id = '204a038b-d164-47d4-9495-39b32ca2ef89'::uuid)
);

create table platform_private.platform_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  action text not null,
  tenant_id uuid,
  occurred_at timestamptz not null default now(),
  check (
    (action = 'tenants_listed' and tenant_id is null)
    or (action in ('tenant_customers_listed', 'tenant_people_listed') and tenant_id is not null)
  )
);

alter table platform_private.platform_admin enable row level security;
alter table platform_private.platform_admin_audit enable row level security;
revoke all on all tables in schema platform_private from public, anon, authenticated, service_role;

insert into platform_private.platform_admin (user_id)
select id from auth.users where id = '204a038b-d164-47d4-9495-39b32ca2ef89'::uuid;

-- Called only from the privileged functions below. Compare the live Auth session
-- with the claim so revoking a session or its factor also blocks existing JWTs.
create function platform_private.platform_admin_actor(p_require_totp boolean)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select a.user_id
  from platform_private.platform_admin a
  join auth.users u on u.id = a.user_id
  join auth.sessions s on s.user_id = u.id
    and s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  where a.user_id = auth.uid()
    and a.revoked_at is null
    and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until <= now())
    and (s.not_after is null or s.not_after > now())
    and (
      not p_require_totp
      or (
        auth.jwt() ->> 'aal' = 'aal2'
        and s.aal = 'aal2'
        and exists (
          select 1
          from auth.mfa_factors f
          where f.id = s.factor_id
            and f.user_id = u.id
            and f.factor_type = 'totp'
            and f.status = 'verified'
        )
      )
    );
$$;

create function platform_private.platform_admin_status()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select platform_private.platform_admin_actor(false) is not null;
$$;

create function platform_private.tenant_summary(
  p_tenant_id uuid,
  p_name text,
  p_created_at timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_tenant_id,
    'name', p_name,
    'createdAt', p_created_at,
    'assetCount', (select count(*) from public.asset where tenant_id = p_tenant_id and not archived),
    'workOrderCount', (select count(*) from public.work_order where tenant_id = p_tenant_id and not archived),
    'customerCount', customers.total,
    'externalCustomerCount', customers.external,
    'locationCount', (select count(*) from public.location where tenant_id = p_tenant_id),
    'peopleCount', people.total,
    'enabledPeopleCount', people.enabled
  )
  from (
    select count(*) as total, count(*) filter (where not is_internal) as external
    from public.customer
    where tenant_id = p_tenant_id
  ) customers
  cross join (
    select count(*) as total, count(*) filter (where enabled) as enabled
    from public.membership
    where tenant_id = p_tenant_id
  ) people;
$$;

create function platform_private.platform_tenants_screen(p_search text, p_limit integer, p_offset integer)
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
begin
  if v_actor is null then
    raise exception 'Platform administrator access required' using errcode = '42501';
  end if;

  insert into platform_private.platform_admin_audit (actor_user_id, action)
  values (v_actor, 'tenants_listed');

  return (
    with filtered as (
      select id, name, created_at
      from public.tenant
      where v_search is null or strpos(lower(name), v_search) > 0
    ), page as (
      select id, name, created_at
      from filtered
      order by name, id
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'rows', coalesce(jsonb_agg(
        platform_private.tenant_summary(page.id, page.name, page.created_at)
        order by page.name, page.id
      ), '[]'::jsonb)
    )
    from page
  );
end;
$$;

create function platform_private.platform_tenant_screen(
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
        'lastSignInAt', u.last_sign_in_at
      ) order by page.first_name, page.last_name, page.id), '[]'::jsonb)
    )
    into v_page
    from page
    left join auth.users u on u.id = page.user_id;
  end if;

  return v_page || jsonb_build_object('tenant', v_tenant);
end;
$$;

-- Public RPCs are invokers. Their implementations remain outside the Data API.
create function public.platform_admin_status()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select platform_private.platform_admin_status();
$$;

create function public.platform_tenants_screen(
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select platform_private.platform_tenants_screen(p_search, p_limit, p_offset);
$$;

create function public.platform_tenant_screen(
  p_tenant_id uuid,
  p_tab text,
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select platform_private.platform_tenant_screen(p_tenant_id, p_tab, p_search, p_limit, p_offset);
$$;

revoke all on all functions in schema platform_private from public, anon, authenticated, service_role;
revoke all on function public.platform_admin_status() from public, anon, authenticated, service_role;
revoke all on function public.platform_tenants_screen(text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.platform_tenant_screen(uuid, text, text, integer, integer) from public, anon, authenticated, service_role;

grant usage on schema platform_private to authenticated;
grant execute on function platform_private.platform_admin_status(), public.platform_admin_status() to authenticated;
grant execute on function platform_private.platform_tenants_screen(text, integer, integer), public.platform_tenants_screen(text, integer, integer) to authenticated;
grant execute on function platform_private.platform_tenant_screen(uuid, text, text, integer, integer), public.platform_tenant_screen(uuid, text, text, integer, integer) to authenticated;
