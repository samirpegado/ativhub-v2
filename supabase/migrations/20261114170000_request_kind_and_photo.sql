alter table public.request
  add column if not exists kind text not null default 'SERVICE';

alter table public.request
  drop constraint if exists request_kind_check;

alter table public.request
  add constraint request_kind_check check (kind in ('SERVICE', 'PARTS'));

alter table public.request
  add column if not exists image_url text;

drop function if exists public.submit_public_request(uuid, text, text, text);

create or replace function public.submit_public_request(
  p_token uuid,
  p_name text,
  p_phone text,
  p_description text,
  p_kind text default 'SERVICE'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.asset%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_kind text := upper(btrim(coalesce(p_kind, 'SERVICE')));
  v_open integer;
  v_id uuid;
begin
  v_asset := public.public_session_asset(p_token);

  if v_name = '' then
    raise exception 'Informe o nome.';
  end if;
  if v_phone = '' then
    raise exception 'Informe o telefone.';
  end if;
  if v_description = '' then
    raise exception 'Descreva o que aconteceu.';
  end if;
  if v_kind not in ('SERVICE', 'PARTS') then
    raise exception 'Informe o tipo da solicitação.';
  end if;

  select count(*)::integer into v_open
  from public.request
  where asset_id = v_asset.id
    and cancelled = false
    and work_order_id is null
    and created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo')
      at time zone 'America/Sao_Paulo';

  if v_open >= 3 then
    raise exception 'Este equipamento já tem 3 solicitações abertas hoje.';
  end if;

  insert into public.request (
    tenant_id, title, description, priority, location_id, asset_id,
    requester_name, requester_phone, kind
  ) values (
    v_asset.tenant_id,
    left(v_description, 120),
    v_description,
    'NONE',
    v_asset.location_id,
    v_asset.id,
    left(v_name, 120),
    left(v_phone, 32),
    v_kind
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_public_request(uuid, text, text, text, text) from public;
grant execute on function public.submit_public_request(uuid, text, text, text, text) to anon, authenticated;
