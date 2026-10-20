-- Autor da ordem de serviço e cargo editável só por ADMIN.

alter table public.work_order
  add column if not exists created_by uuid references public.membership(id);

comment on column public.work_order.created_by is 'Membership que criou a ordem de serviço';

create or replace function public.protect_membership_job_title()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  if tg_op = 'UPDATE' and new.job_title is not distinct from old.job_title then
    return new;
  end if;

  if tg_op = 'INSERT' and new.job_title is null then
    return new;
  end if;

  select exists (
    select 1
    from public.membership m
    join public.role r on r.id = m.role_id
    where m.user_id = auth.uid()
      and m.tenant_id = new.tenant_id
      and m.enabled
      and r.code = 'ADMIN'
  ) into v_is_admin;

  if not coalesce(v_is_admin, false) then
    raise exception 'only admins can change job_title';
  end if;

  return new;
end;
$$;

drop trigger if exists membership_protect_job_title on public.membership;

create trigger membership_protect_job_title
  before insert or update of job_title on public.membership
  for each row execute function public.protect_membership_job_title();
