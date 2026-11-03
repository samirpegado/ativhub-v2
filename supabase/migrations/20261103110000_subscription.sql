-- Catálogo de planos e a assinatura de cada empresa.
-- O valor mora no plano. Por enquanto existe só o plano Padrão.

create table public.plan (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  amount numeric(12, 2) not null,
  interval text not null default 'MONTHLY',
  asaas_plan_ref text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint plan_code_check check (code ~ '^[A-Z0-9_]{1,32}$'),
  constraint plan_amount_check check (amount > 0)
);

create table public.subscription (
  tenant_id uuid primary key references public.tenant (id) on delete cascade,
  plan_id uuid not null references public.plan (id),
  status text not null default 'TRIALING',
  trial_ends_at timestamptz,
  asaas_customer_id text,
  asaas_subscription_id text,
  asaas_payment_link_id text,
  checkout_url text,
  checkout_env text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  constraint subscription_status_check check (status in ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED'))
);

create table public.asaas_webhook_event (
  id text primary key,
  event text not null,
  received_at timestamptz not null default now()
);

comment on table public.plan is 'Planos do produto. A assinatura aponta para um deles.';
comment on table public.asaas_webhook_event is 'Eventos do Asaas já processados, para não aplicar o mesmo pagamento duas vezes.';

alter table public.plan enable row level security;
alter table public.subscription enable row level security;
alter table public.asaas_webhook_event enable row level security;

revoke all on table public.plan from public, anon;
revoke all on table public.subscription from public, anon;
revoke all on table public.asaas_webhook_event from public, anon, authenticated;

grant select on table public.plan to authenticated;
grant select on table public.subscription to authenticated;

create policy plan_select on public.plan
  for select to authenticated
  using (is_active);

create policy subscription_select on public.subscription
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

insert into public.plan (code, name, amount, interval)
values ('STANDARD', 'Padrão', 99.90, 'MONTHLY')
on conflict (code) do nothing;

insert into public.subscription (tenant_id, plan_id, status, trial_ends_at)
select t.id, p.id, 'TRIALING', t.created_at + interval '14 days'
from public.tenant t
cross join public.plan p
where p.code = 'STANDARD'
  and not exists (
    select 1 from public.subscription s where s.tenant_id = t.id
  );

create or replace function public.provision_owner_tenant(
  p_user_id uuid,
  p_company_name text,
  p_first_name text,
  p_last_name text,
  p_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_admin_role_id uuid;
  v_plan_id uuid;
  v_email text;
  v_company text := btrim(coalesce(p_company_name, ''));
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last text := btrim(coalesce(p_last_name, ''));
begin
  if p_user_id is null then
    raise exception 'Usuário inválido.';
  end if;
  if v_company = '' or v_first = '' or v_last = '' then
    raise exception 'Informe empresa, nome e sobrenome.';
  end if;
  if exists (select 1 from public.membership m where m.user_id = p_user_id) then
    raise exception 'Este usuário já tem uma empresa.';
  end if;

  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    raise exception 'Usuário não encontrado.';
  end if;

  select id into v_plan_id from public.plan where code = 'STANDARD' and is_active;
  if v_plan_id is null then
    raise exception 'Plano padrão indisponível.';
  end if;

  insert into public.tenant (name) values (v_company) returning id into v_tenant_id;
  perform public.seed_default_roles(v_tenant_id);

  select r.id into v_admin_role_id
  from public.role r
  where r.tenant_id = v_tenant_id and r.code = 'ADMIN';

  insert into public.membership (
    tenant_id, user_id, role_id, first_name, last_name, is_owner, email, phone
  ) values (
    v_tenant_id, p_user_id, v_admin_role_id, v_first, v_last, true, v_email,
    nullif(btrim(coalesce(p_phone, '')), '')
  );

  insert into public.subscription (tenant_id, plan_id, status, trial_ends_at)
  values (v_tenant_id, v_plan_id, 'TRIALING', now() + interval '14 days');

  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', v_tenant_id)
  where id = p_user_id;

  return v_tenant_id;
end;
$$;

revoke all on function public.provision_owner_tenant(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.provision_owner_tenant(uuid, text, text, text, text) to service_role;
