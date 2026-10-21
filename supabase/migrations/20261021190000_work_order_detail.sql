-- Detalhe de uma ordem para o drawer: cabeçalho, tarefas, tempo, arquivos e atualizações.
-- security invoker: a linha some se não for do tenant do usuário.

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
    ), '[]'::jsonb)
  )
  from public.work_order wo
  left join public.location loc on loc.id = wo.location_id
  left join public.asset ast on ast.id = wo.asset_id
  left join public.membership pu on pu.id = wo.primary_user_id
  where wo.id = p_work_order_id
    and wo.archived = false;
$$;

revoke all on function public.work_order_detail(uuid) from public;
revoke all on function public.work_order_detail(uuid) from anon;
grant execute on function public.work_order_detail(uuid) to authenticated;
