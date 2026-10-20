alter table public.membership
  add column if not exists email text;

update public.membership m
set email = u.email
from auth.users u
where u.id = m.user_id
  and m.email is null;

create or replace function public.is_tenant_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.membership m
    join public.role r on r.id = m.role_id
    where m.user_id = auth.uid()
      and m.tenant_id = public.current_tenant_id()
      and m.enabled
      and r.code = 'ADMIN'
  );
$$;

revoke all on function public.is_tenant_admin() from public;
grant execute on function public.is_tenant_admin() to authenticated;

create or replace function public.protect_membership_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select u.email into v_email
    from auth.users u
    where u.id = new.user_id;
    new.email := v_email;
    return new;
  end if;

  if new.email is distinct from old.email then
    new.email := old.email;
  end if;

  if new.role_id is distinct from old.role_id and not public.is_tenant_admin() then
    raise exception 'only admins can assign roles';
  end if;

  return new;
end;
$$;

drop trigger if exists membership_protect_identity on public.membership;

create trigger membership_protect_identity
  before insert or update on public.membership
  for each row execute function public.protect_membership_identity();

drop policy if exists membership_write on public.membership;

create policy membership_insert on public.membership
  for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );

create policy membership_update on public.membership
  for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (user_id = auth.uid() or public.is_tenant_admin())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (user_id = auth.uid() or public.is_tenant_admin())
  );

create policy membership_delete on public.membership
  for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and user_id <> auth.uid()
    and is_owner = false
    and public.is_tenant_admin()
  );

create or replace function public.bootstrap_tenant(
  p_name text,
  p_first_name text,
  p_last_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_admin_role_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.membership m where m.user_id = v_user_id) then
    raise exception 'user already belongs to a tenant';
  end if;

  insert into public.tenant (name) values (p_name) returning id into v_tenant_id;
  perform public.seed_default_roles(v_tenant_id);

  select r.id into v_admin_role_id
  from public.role r
  where r.tenant_id = v_tenant_id and r.code = 'ADMIN';

  insert into public.membership (
    tenant_id, user_id, role_id, first_name, last_name, is_owner, email
  )
  select
    v_tenant_id, v_user_id, v_admin_role_id, p_first_name, p_last_name, true, u.email
  from auth.users u
  where u.id = v_user_id;

  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', v_tenant_id)
  where id = v_user_id;

  return v_tenant_id;
end;
$$;
