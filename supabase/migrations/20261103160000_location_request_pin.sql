-- PIN por localização para o QR público do ativo.
-- O PIN fica legível: o gestor precisa vê-lo e repassá-lo. Não é senha.
-- O acesso público passa por token de 30 minutos, depois de acertar o PIN.
-- As funções internas não são concedidas a anon/authenticated.

alter table public.location
  add column if not exists request_pin text;

update public.location
set request_pin = lpad((floor(random() * 10000))::int::text, 4, '0')
where request_pin is null
   or request_pin !~ '^[0-9]{4}$';

alter table public.location
  alter column request_pin set default lpad((floor(random() * 10000))::int::text, 4, '0');

alter table public.location
  alter column request_pin set not null;

alter table public.location
  drop constraint if exists location_request_pin_check;

alter table public.location
  add constraint location_request_pin_check
  check (request_pin ~ '^[0-9]{4}$');

update public.tenant
set settings = settings - 'requestPin'
where settings ? 'requestPin';

create table if not exists public.public_access_session (
  token uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant (id) on delete cascade,
  asset_id uuid not null references public.asset (id) on delete cascade,
  location_id uuid not null references public.location (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.public_pin_attempt (
  id bigint generated always as identity primary key,
  location_id uuid not null references public.location (id) on delete cascade,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists public_pin_attempt_location_created_idx
  on public.public_pin_attempt (location_id, created_at desc);

alter table public.public_access_session enable row level security;
alter table public.public_pin_attempt enable row level security;

revoke all on table public.public_access_session from public, anon, authenticated;
revoke all on table public.public_pin_attempt from public, anon, authenticated;

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
  where s.token = p_token
    and s.expires_at > now()
    and a.archived = false
    and a.location_id = s.location_id;

  if not found then
    raise exception 'Sessão expirada. Informe o PIN novamente.';
  end if;

  return v_asset;
end;
$$;

create or replace function public.public_asset_history(p_asset_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(payload order by sort_at desc), '[]'::jsonb)
  from (
    select
      coalesce(wo.completed_on, wo.created_at) as sort_at,
      jsonb_build_object(
        'id', wo.id,
        'customId', wo.custom_id,
        'title', wo.title,
        'description', wo.description,
        'status', wo.status,
        'type', wo.type,
        'priority', wo.priority,
        'at', coalesce(wo.completed_on, wo.created_at),
        'billingMode', wo.billing_mode,
        'partsCost', round(costs.parts_cost, 2),
        'laborCost', round(costs.labor_cost, 2),
        'serviceCost', round(costs.service_cost, 2),
        'total', round(costs.parts_cost + costs.service_cost, 2)
      ) as payload
    from public.work_order wo
    cross join lateral (
      select
        coalesce((
          select sum(p.cost * wop.quantity)
          from public.work_order_part wop
          join public.part p on p.id = wop.part_id
          where wop.work_order_id = wo.id
        ), 0) as parts_cost,
        coalesce((
          select sum((l.duration_seconds / 3600.0) * coalesce(l.hourly_rate, 0))
          from public.labor l
          where l.work_order_id = wo.id
            and (not l.logged or l.started_at is not null or l.duration_seconds > 0)
        ), 0) as labor_cost
    ) base
    cross join lateral (
      select
        base.parts_cost,
        base.labor_cost,
        case wo.billing_mode
          when 'FIXED' then coalesce(wo.service_amount, 0)
          else base.labor_cost
        end as service_cost
    ) costs
    where wo.asset_id = p_asset_id
      and wo.archived = false
  ) rows;
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

  select name, request_pin
    into v_location_name, v_stored
  from public.location
  where id = v_asset.location_id;

  if v_stored is null then
    raise exception 'Este equipamento não tem localização. Procure o gestor.';
  end if;

  if v_pin is null or v_pin !~ '^[0-9]{4}$' then
    raise exception 'Informe o PIN de 4 dígitos.';
  end if;

  delete from public.public_pin_attempt
  where location_id = v_asset.location_id
    and created_at < now() - interval '1 day';

  delete from public.public_access_session
  where asset_id = v_asset.id
    and expires_at < now();

  select count(*)::integer into v_failures
  from public.public_pin_attempt
  where location_id = v_asset.location_id
    and success = false
    and created_at > now() - interval '15 minutes';

  if v_failures >= 10 then
    raise exception 'Muitas tentativas. Tente novamente em alguns minutos.';
  end if;

  if v_stored <> v_pin then
    insert into public.public_pin_attempt (location_id, success)
    values (v_asset.location_id, false);
    raise exception 'PIN incorreto.';
  end if;

  insert into public.public_pin_attempt (location_id, success)
  values (v_asset.location_id, true);

  v_expires := now() + interval '30 minutes';

  insert into public.public_access_session (tenant_id, asset_id, location_id, expires_at)
  values (v_asset.tenant_id, v_asset.id, v_asset.location_id, v_expires)
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

create or replace function public.public_asset_overview(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_asset public.asset%rowtype;
  v_location_name text;
begin
  v_asset := public.public_session_asset(p_token);

  select name into v_location_name
  from public.location
  where id = v_asset.location_id;

  return jsonb_build_object(
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

create or replace function public.public_work_order_report(
  p_token uuid,
  p_work_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_asset public.asset%rowtype;
  v_result jsonb;
begin
  v_asset := public.public_session_asset(p_token);

  select jsonb_build_object(
    'companyName', (select t.name from public.tenant t where t.id = wo.tenant_id),
    'order', jsonb_build_object(
      'customId', wo.custom_id,
      'title', wo.title,
      'description', wo.description,
      'status', wo.status,
      'priority', wo.priority,
      'type', wo.type,
      'dueDate', wo.due_date,
      'completedOn', wo.completed_on,
      'locationName', loc.name,
      'assetName', ast.name,
      'billingMode', wo.billing_mode,
      'serviceAmount', wo.service_amount,
      'primaryUserName', nullif(btrim(concat_ws(' ', pu.first_name, pu.last_name)), ''),
      'assignees', coalesce((
        select jsonb_agg(nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), '') order by m.first_name, m.last_name)
        from public.work_order_assignee wa
        join public.membership m on m.id = wa.membership_id
        where wa.work_order_id = wo.id
      ), '[]'::jsonb)
    ),
    'tasks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'label', t.label,
          'taskType', t.task_type,
          'value', t.value
        )
        order by t.order_index
      )
      from public.task t
      where t.work_order_id = wo.id
    ), '[]'::jsonb),
    'parts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', p.name,
          'unit', p.unit,
          'quantity', wop.quantity,
          'cost', p.cost
        )
        order by p.name
      )
      from public.work_order_part wop
      join public.part p on p.id = wop.part_id
      where wop.work_order_id = wo.id
    ), '[]'::jsonb),
    'labors', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'workedOn', case when l.logged then l.tracked_at else l.started_at end,
          'durationSeconds', l.duration_seconds,
          'hourlyRate', l.hourly_rate,
          'author', coalesce(
            nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), ''),
            'Usuário'
          )
        )
        order by l.started_at desc nulls last
      )
      from public.labor l
      left join public.membership m on m.id = l.membership_id
      where l.work_order_id = wo.id
        and (not l.logged or l.started_at is not null or l.duration_seconds > 0)
    ), '[]'::jsonb),
    'updates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'body', u.body,
          'createdAt', u.created_at,
          'author', coalesce(
            nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), ''),
            'Usuário'
          )
        )
        order by u.created_at
      )
      from public.work_order_update u
      left join public.membership m on m.id = u.membership_id
      where u.work_order_id = wo.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.work_order wo
  left join public.location loc on loc.id = wo.location_id
  left join public.asset ast on ast.id = wo.asset_id
  left join public.membership pu on pu.id = wo.primary_user_id
  where wo.id = p_work_order_id
    and wo.asset_id = v_asset.id
    and wo.archived = false;

  if v_result is null then
    raise exception 'Ordem não encontrada.';
  end if;

  return v_result;
end;
$$;

drop function if exists public.submit_public_request(uuid, text, text, text, text);

create or replace function public.submit_public_request(
  p_token uuid,
  p_name text,
  p_phone text,
  p_description text
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
    requester_name, requester_phone
  ) values (
    v_asset.tenant_id,
    left(v_description, 120),
    v_description,
    'NONE',
    v_asset.location_id,
    v_asset.id,
    left(v_name, 120),
    left(v_phone, 32)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.public_session_asset(uuid) from public, anon, authenticated;
revoke all on function public.public_asset_history(uuid) from public, anon, authenticated;

revoke all on function public.public_asset_unlock(uuid, text) from public;
revoke all on function public.public_asset_overview(uuid) from public;
revoke all on function public.public_work_order_report(uuid, uuid) from public;
revoke all on function public.submit_public_request(uuid, text, text, text) from public;

grant execute on function public.public_asset_unlock(uuid, text) to anon, authenticated;
grant execute on function public.public_asset_overview(uuid) to anon, authenticated;
grant execute on function public.public_work_order_report(uuid, uuid) to anon, authenticated;
grant execute on function public.submit_public_request(uuid, text, text, text) to anon, authenticated;
