-- Códigos e links de confirmação de e-mail e de redefinição de senha.
-- O valor cru não é gravado. Anon e authenticated não acessam a tabela.

create table public.adm_otp_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  purpose text not null,
  token_hash text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  constraint adm_otp_emails_purpose_check check (purpose in ('VERIFY_EMAIL', 'RESET_PASSWORD')),
  constraint adm_otp_emails_attempts_check check (attempts >= 0)
);

create index adm_otp_emails_user_purpose_idx
  on public.adm_otp_emails (user_id, purpose, created_at desc);

create index adm_otp_emails_token_hash_idx
  on public.adm_otp_emails (token_hash);

comment on table public.adm_otp_emails is
  'Tokens e códigos hasheados para confirmar e-mail ou redefinir senha. Expiram em 3 horas.';

alter table public.adm_otp_emails enable row level security;

revoke all on table public.adm_otp_emails from public, anon, authenticated;

-- Cria a empresa do dono sem depender da sessão. Só a service role chama.
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

  select u.email into v_email
  from auth.users u
  where u.id = p_user_id;

  if v_email is null then
    raise exception 'Usuário não encontrado.';
  end if;

  insert into public.tenant (name)
  values (v_company)
  returning id into v_tenant_id;

  perform public.seed_default_roles(v_tenant_id);

  select r.id into v_admin_role_id
  from public.role r
  where r.tenant_id = v_tenant_id
    and r.code = 'ADMIN';

  insert into public.membership (
    tenant_id, user_id, role_id, first_name, last_name, is_owner, email, phone
  ) values (
    v_tenant_id, p_user_id, v_admin_role_id, v_first, v_last, true, v_email, nullif(btrim(coalesce(p_phone, '')), '')
  );

  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', v_tenant_id)
  where id = p_user_id;

  return v_tenant_id;
end;
$$;

revoke all on function public.provision_owner_tenant(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.provision_owner_tenant(uuid, text, text, text, text) to service_role;

-- Quem já opera a empresa não fica preso na confirmação nova.
update auth.users u
set email_confirmed_at = coalesce(u.created_at, now())
where u.email_confirmed_at is null
  and exists (
    select 1 from public.membership m where m.user_id = u.id
  );
