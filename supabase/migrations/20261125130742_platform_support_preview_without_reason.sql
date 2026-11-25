alter table platform_private.support_preview
  alter column reason drop not null;

create or replace function platform_private.start_support_preview(p_tenant_id uuid, p_membership_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := platform_private.support_preview_actor();
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'Support preview access denied' using errcode = '42501';
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

  insert into platform_private.support_preview (actor_user_id, auth_session_id, tenant_id, membership_id)
  values (v_actor, (auth.jwt() ->> 'session_id')::uuid, p_tenant_id, p_membership_id)
  returning id into v_id;

  insert into platform_private.support_preview_audit (preview_id, event) values (v_id, 'started');
  return v_id;
end;
$$;

-- Keep the third parameter for callers from before the rollout.
create or replace function public.platform_start_support_preview(
  p_tenant_id uuid,
  p_membership_id uuid,
  p_reason text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select platform_private.start_support_preview(p_tenant_id, p_membership_id, null);
$$;
