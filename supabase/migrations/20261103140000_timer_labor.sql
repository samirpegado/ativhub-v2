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
      'type', wo.type,
      'customerId', wo.customer_id,
      'customerName', cust.name,
      'customerEmail', cust.email,
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
      'billingMode', wo.billing_mode,
      'serviceAmount', wo.service_amount,
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
        'startedAt', l.started_at,
        'hourlyRate', l.hourly_rate
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
          'hourlyRate', l.hourly_rate,
          'workedOn', case when l.logged then null else l.started_at end,
          'startedAt', case when l.logged then l.started_at else null end,
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
    'logoPath', (select t.logo_url from public.tenant t where t.id = wo.tenant_id),
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
  left join public.customer cust on cust.id = wo.customer_id
  where wo.id = p_work_order_id
    and wo.archived = false;
$$;

revoke all on function public.work_order_detail(uuid) from public;
revoke all on function public.work_order_detail(uuid) from anon;
grant execute on function public.work_order_detail(uuid) to authenticated;
