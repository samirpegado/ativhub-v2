-- Peças usadas na ordem: o detalhe devolve as linhas e o catálogo.
-- Consumo e estorno ficam na mesma transação do estoque.
-- security invoker: a linha some se não for do tenant do usuário.

create unique index if not exists work_order_part_order_part_key
  on public.work_order_part (work_order_id, part_id);

create or replace function public.work_order_detail(p_work_order_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', wo.id,
      'customId', wo.custom_id,
      'title', wo.title,
      'description', wo.description,
      'status', wo.status,
      'priority', wo.priority,
      'dueDate', wo.due_date,
      'estimatedStartDate', wo.estimated_start_date,
      'estimatedDuration', wo.estimated_duration,
      'requiredSignature', wo.required_signature,
      'locationId', wo.location_id,
      'locationName', loc.name,
      'assetId', wo.asset_id,
      'assetName', ast.name,
      'teamId', wo.team_id,
      'primaryUserId', wo.primary_user_id,
      'categoryId', wo.category_id,
      'firstTimeToReact', wo.first_time_to_react,
      'primaryUser', case
        when pu.id is null then null
        else jsonb_build_object(
          'id', pu.id,
          'firstName', pu.first_name,
          'lastName', pu.last_name,
          'imagePath', pu.image_url
        )
      end,
      'assignees', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'firstName', m.first_name,
            'lastName', m.last_name,
            'imagePath', m.image_url
          )
          order by m.first_name, m.last_name
        )
        from public.work_order_assignee wa
        join public.membership m on m.id = wa.membership_id
        where wa.work_order_id = wo.id
      ), '[]'::jsonb),
      'tasks', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'label', t.label,
            'taskType', t.task_type,
            'options', coalesce(t.options, '[]'::jsonb),
            'value', t.value
          )
          order by t.order_index
        )
        from public.task t
        where t.work_order_id = wo.id
      ), '[]'::jsonb)
    ),
    'timer', (
      select jsonb_build_object(
        'durationSeconds', l.duration_seconds,
        'startedAt', l.started_at
      )
      from public.labor l
      join public.membership m on m.id = l.membership_id
      where l.work_order_id = wo.id
        and l.logged
        and m.user_id = auth.uid()
      limit 1
    ),
    'labors', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'durationSeconds', l.duration_seconds,
          'workedOn', l.started_at,
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
        and not l.logged
    ), '[]'::jsonb),
    'files', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'name', f.name,
          'path', f.url
        )
        order by f.created_at desc
      )
      from public.file f
      where f.entity_type = 'WORK_ORDER'
        and f.entity_id = wo.id
    ), '[]'::jsonb),
    'updates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', u.id,
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
    ), '[]'::jsonb),
    'parts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', wop.id,
          'partId', p.id,
          'name', p.name,
          'unit', p.unit,
          'cost', p.cost,
          'quantity', wop.quantity,
          'nonStock', p.non_stock
        )
        order by p.name
      )
      from public.work_order_part wop
      join public.part p on p.id = wop.part_id
      where wop.work_order_id = wo.id
    ), '[]'::jsonb),
    'partOptions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'unit', p.unit,
          'cost', p.cost,
          'quantity', p.quantity,
          'nonStock', p.non_stock
        )
        order by p.name
      )
      from public.part p
    ), '[]'::jsonb)
  )
  from public.work_order wo
  left join public.location loc on loc.id = wo.location_id
  left join public.asset ast on ast.id = wo.asset_id
  left join public.membership pu on pu.id = wo.primary_user_id
  where wo.id = p_work_order_id
    and wo.archived = false;
$$;

create or replace function public.consume_work_order_part(
  p_work_order_id uuid,
  p_part_id uuid,
  p_quantity numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_non_stock boolean;
  v_stock numeric;
  v_found boolean;
  v_line_id uuid;
  v_take numeric;
  v_membership uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade inválida.';
  end if;
  v_take := round(p_quantity, 3);
  if v_take <= 0 then
    raise exception 'Quantidade inválida.';
  end if;

  if not exists (
    select 1
    from public.work_order
    where id = p_work_order_id
      and archived = false
  ) then
    raise exception 'Ordem não encontrada.';
  end if;

  select non_stock, quantity, true
    into v_non_stock, v_stock, v_found
  from public.part
  where id = p_part_id
  for update;

  if v_found is not true then
    raise exception 'Peça não encontrada.';
  end if;

  if v_non_stock is not true and v_stock < v_take then
    raise exception 'Estoque insuficiente.';
  end if;

  select id into v_line_id
  from public.work_order_part
  where work_order_id = p_work_order_id
    and part_id = p_part_id
  for update;

  if v_line_id is null then
    insert into public.work_order_part (tenant_id, work_order_id, part_id, quantity)
    values (public.current_tenant_id(), p_work_order_id, p_part_id, v_take);
  else
    update public.work_order_part
    set quantity = quantity + v_take
    where id = v_line_id;
  end if;

  if v_non_stock is not true then
    update public.part
    set quantity = quantity - v_take
    where id = p_part_id;

    select id into v_membership
    from public.membership
    where user_id = auth.uid()
      and tenant_id = public.current_tenant_id();

    insert into public.stock_movement (
      tenant_id, part_id, work_order_id, quantity, reason, created_by
    ) values (
      public.current_tenant_id(),
      p_part_id,
      p_work_order_id,
      -v_take,
      'WO_CONSUME',
      v_membership
    );
  end if;
end;
$$;

create or replace function public.return_work_order_part(
  p_work_order_id uuid,
  p_line_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_part_id uuid;
  v_qty numeric;
  v_non_stock boolean;
  v_membership uuid;
begin
  select part_id
    into v_part_id
  from public.work_order_part
  where id = p_line_id
    and work_order_id = p_work_order_id;

  if v_part_id is null then
    raise exception 'Peça não encontrada nesta ordem.';
  end if;

  select non_stock into v_non_stock
  from public.part
  where id = v_part_id
  for update;

  select quantity into v_qty
  from public.work_order_part
  where id = p_line_id
    and work_order_id = p_work_order_id
  for update;

  if v_qty is null then
    raise exception 'Peça não encontrada nesta ordem.';
  end if;

  delete from public.work_order_part where id = p_line_id;

  if v_non_stock is not true then
    update public.part
    set quantity = quantity + v_qty
    where id = v_part_id;

    select id into v_membership
    from public.membership
    where user_id = auth.uid()
      and tenant_id = public.current_tenant_id();

    insert into public.stock_movement (
      tenant_id, part_id, work_order_id, quantity, reason, created_by
    ) values (
      public.current_tenant_id(),
      v_part_id,
      p_work_order_id,
      v_qty,
      'WO_RETURN',
      v_membership
    );
  end if;
end;
$$;

revoke all on function public.consume_work_order_part(uuid, uuid, numeric) from public;
revoke all on function public.consume_work_order_part(uuid, uuid, numeric) from anon;
grant execute on function public.consume_work_order_part(uuid, uuid, numeric) to authenticated;

revoke all on function public.return_work_order_part(uuid, uuid) from public;
revoke all on function public.return_work_order_part(uuid, uuid) from anon;
grant execute on function public.return_work_order_part(uuid, uuid) to authenticated;
