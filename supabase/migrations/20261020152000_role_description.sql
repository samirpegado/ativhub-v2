alter table public.role
  add column if not exists description text;

update public.role as r
set description = d.description
from (
  values
    ('ADMIN', 'Acesso completo à empresa, inclusive pessoas, equipes e configurações.'),
    ('LIMITED_ADMIN', 'Administra a operação, sem as configurações sensíveis, e aprova solicitações.'),
    ('TECHNICIAN', 'Executa a manutenção: cria e edita ordens, ativos, peças e localizações.'),
    ('LIMITED_TECHNICIAN', 'Vê e atualiza só o que lhe é atribuído.'),
    ('VIEW_ONLY', 'Consulta as informações da empresa, sem criar nem editar.'),
    ('REQUESTER', 'Abre solicitações de manutenção e acompanha as próprias.')
) as d(code, description)
where r.code = d.code
  and r.description is null;

create or replace function public.seed_default_roles(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_all text[] := array[
    'PEOPLE_AND_TEAMS','CATEGORIES','WORK_ORDERS','PREVENTIVE_MAINTENANCES',
    'ASSETS','PARTS','METERS','VENDORS_AND_CUSTOMERS','FILES','LOCATIONS',
    'SETTINGS','REQUESTS','ANALYTICS'
  ];
  v_ops text[] := array[
    'WORK_ORDERS','PREVENTIVE_MAINTENANCES','ASSETS','PARTS','FILES',
    'LOCATIONS','REQUESTS','CATEGORIES'
  ];
begin
  insert into public.role (tenant_id, name, code, is_default, description, permissions) values
    (
      p_tenant_id, 'Administrador', 'ADMIN', false,
      'Acesso completo à empresa, inclusive pessoas, equipes e configurações.',
      jsonb_build_object(
        'create', v_all, 'view', v_all, 'viewOther', v_all,
        'editOther', v_all, 'deleteOther', v_all
      )
    ),
    (
      p_tenant_id, 'Administrador limitado', 'LIMITED_ADMIN', false,
      'Administra a operação, sem as configurações sensíveis, e aprova solicitações.',
      jsonb_build_object(
        'create', v_ops, 'view', v_all, 'viewOther', v_ops,
        'editOther', v_ops, 'deleteOther', v_ops
      )
    ),
    (
      p_tenant_id, 'Técnico', 'TECHNICIAN', true,
      'Executa a manutenção: cria e edita ordens, ativos, peças e localizações.',
      jsonb_build_object(
        'create', v_ops, 'view', v_ops || array['ANALYTICS'],
        'viewOther', array['WORK_ORDERS','ASSETS','PARTS','LOCATIONS'],
        'editOther', array[]::text[], 'deleteOther', array[]::text[]
      )
    ),
    (
      p_tenant_id, 'Técnico limitado', 'LIMITED_TECHNICIAN', false,
      'Vê e atualiza só o que lhe é atribuído.',
      jsonb_build_object(
        'create', array['WORK_ORDERS','REQUESTS'],
        'view', array['WORK_ORDERS','ASSETS','PARTS','LOCATIONS','REQUESTS','FILES'],
        'viewOther', array[]::text[], 'editOther', array[]::text[],
        'deleteOther', array[]::text[]
      )
    ),
    (
      p_tenant_id, 'Somente leitura', 'VIEW_ONLY', false,
      'Consulta as informações da empresa, sem criar nem editar.',
      jsonb_build_object(
        'create', array[]::text[], 'view', v_all,
        'viewOther', v_all, 'editOther', array[]::text[],
        'deleteOther', array[]::text[]
      )
    ),
    (
      p_tenant_id, 'Solicitante', 'REQUESTER', false,
      'Abre solicitações de manutenção e acompanha as próprias.',
      jsonb_build_object(
        'create', array['REQUESTS'], 'view', array['REQUESTS'],
        'viewOther', array[]::text[], 'editOther', array[]::text[],
        'deleteOther', array[]::text[]
      )
    );
end;
$$;
