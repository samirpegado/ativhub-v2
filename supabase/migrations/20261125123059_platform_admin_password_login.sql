-- Existing private callers still pass the former MFA flag.
create or replace function platform_private.platform_admin_actor(p_require_totp boolean)
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
    and (s.not_after is null or s.not_after > now());
$$;
