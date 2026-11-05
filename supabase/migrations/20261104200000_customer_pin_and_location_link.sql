-- O PIN do QR público passa a ser do cliente.
-- A localização aponta para o cliente e deixa de guardar PIN.

alter table public.customer
  add column if not exists request_pin text;

update public.customer
set request_pin = lpad((floor(random() * 10000))::int::text, 4, '0')
where request_pin is null
   or request_pin !~ '^[0-9]{4}$';

alter table public.customer
  alter column request_pin set default lpad((floor(random() * 10000))::int::text, 4, '0');

alter table public.customer
  alter column request_pin set not null;

alter table public.customer
  drop constraint if exists customer_request_pin_check;

alter table public.customer
  add constraint customer_request_pin_check
  check (request_pin ~ '^[0-9]{4}$');

alter table public.location
  add column if not exists customer_id uuid references public.customer (id) on delete set null;

create index if not exists location_customer_id_idx
  on public.location (customer_id);

create or replace function public.location_customer_same_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.customer_id is not null and not exists (
    select 1
    from public.customer
    where id = new.customer_id
      and tenant_id = new.tenant_id
  ) then
    raise exception 'O cliente não pertence a esta empresa.';
  end if;
  return new;
end;
$$;

drop trigger if exists location_customer_same_tenant on public.location;

create trigger location_customer_same_tenant
  before insert or update of customer_id, tenant_id on public.location
  for each row execute function public.location_customer_same_tenant();

alter table public.public_access_session
  add column if not exists customer_id uuid references public.customer (id) on delete cascade;

truncate public.public_pin_attempt;

drop index if exists public.public_pin_attempt_location_created_idx;

alter table public.public_pin_attempt
  drop column if exists location_id;

alter table public.public_pin_attempt
  add column if not exists customer_id uuid references public.customer (id) on delete cascade;

alter table public.public_pin_attempt
  alter column customer_id set not null;

create index if not exists public_pin_attempt_customer_created_idx
  on public.public_pin_attempt (customer_id, created_at desc);

create or replace function public.public_session_asset(p_token uuid)
returns public.asset
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_asset public.asset%rowtype;
begin
  select a.* into v_asset
  from public.public_access_session s
  join public.asset a on a.id = s.asset_id
  join public.location loc on loc.id = a.location_id
  where s.token = p_token
    and s.expires_at > now()
    and a.archived = false
    and a.location_id = s.location_id
    and (
      s.customer_id is null
      or loc.customer_id = s.customer_id
    );

  if not found then
    raise exception 'Sessão expirada. Informe o PIN novamente.';
  end if;

  return v_asset;
end;
$$;

create or replace function public.public_asset_unlock(
  p_asset_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.asset%rowtype;
  v_pin text := nullif(btrim(coalesce(p_pin, '')), '');
  v_stored text;
  v_location_name text;
  v_customer_id uuid;
  v_failures integer;
  v_token uuid;
  v_expires timestamptz;
begin
  select * into v_asset
  from public.asset
  where id = p_asset_id
    and archived = false;

  if not found then
    raise exception 'Equipamento não encontrado.';
  end if;

  if v_asset.location_id is null then
    raise exception 'Este equipamento não tem localização. Procure o gestor.';
  end if;

  select loc.name, loc.customer_id, cust.request_pin
    into v_location_name, v_customer_id, v_stored
  from public.location loc
  left join public.customer cust on cust.id = loc.customer_id
  where loc.id = v_asset.location_id;

  if v_customer_id is null or v_stored is null then
    raise exception 'Este equipamento não está vinculado a um cliente. Procure o gestor.';
  end if;

  if v_pin is null or v_pin !~ '^[0-9]{4}$' then
    raise exception 'Informe o PIN de 4 dígitos.';
  end if;

  delete from public.public_pin_attempt
  where customer_id = v_customer_id
    and created_at < now() - interval '1 day';

  delete from public.public_access_session
  where asset_id = v_asset.id
    and expires_at < now();

  select count(*)::integer into v_failures
  from public.public_pin_attempt
  where customer_id = v_customer_id
    and success = false
    and created_at > now() - interval '15 minutes';

  if v_failures >= 10 then
    raise exception 'Muitas tentativas. Tente novamente em alguns minutos.';
  end if;

  if v_stored <> v_pin then
    insert into public.public_pin_attempt (customer_id, success)
    values (v_customer_id, false);
    raise exception 'PIN incorreto.';
  end if;

  insert into public.public_pin_attempt (customer_id, success)
  values (v_customer_id, true);

  v_expires := now() + interval '30 minutes';

  insert into public.public_access_session (
    tenant_id, asset_id, location_id, customer_id, expires_at
  )
  values (v_asset.tenant_id, v_asset.id, v_asset.location_id, v_customer_id, v_expires)
  returning token into v_token;

  return jsonb_build_object(
    'token', v_token,
    'expiresAt', v_expires,
    'asset', jsonb_build_object(
      'id', v_asset.id,
      'name', v_asset.name,
      'customId', v_asset.custom_id,
      'locationName', v_location_name
    ),
    'history', public.public_asset_history(v_asset.id)
  );
end;
$$;

create or replace function public.customers_screen(
  p_search text default null,
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
      least(greatest(coalesce(p_limit, 20), 1), 20) as lim,
      greatest(coalesce(p_offset, 0), 0) as off
  ),
  needle as (
    select case
      when term is null then null
      else '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    end as pattern
    from bounds
  ),
  filtered as (
    select c.*
    from public.customer c
    cross join needle
    where needle.pattern is null
      or c.name ilike needle.pattern escape '\'
      or coalesce(c.email, '') ilike needle.pattern escape '\'
      or coalesce(c.phone, '') ilike needle.pattern escape '\'
      or coalesce(c.customer_type, '') ilike needle.pattern escape '\'
      or c.request_pin ilike needle.pattern escape '\'
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'totalAll', (select count(*) from public.customer),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'phone', phone,
          'email', email,
          'website', website,
          'customerType', customer_type,
          'description', description,
          'requestPin', request_pin
        )
        order by name
      )
      from (
        select *
        from filtered
        order by name
        limit (select lim from bounds)
        offset (select off from bounds)
      ) page
    ), '[]'::jsonb)
  );
$$;

alter table public.location
  drop constraint if exists location_request_pin_check;

alter table public.location
  drop column if exists request_pin;
