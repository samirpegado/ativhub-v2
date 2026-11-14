alter table public.request
  add column in_treatment boolean not null default false;

create or replace function public.requests_screen(
  p_search text default null,
  p_status text default null,
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
    select r.id, r.created_at
    from public.request r
    left join public.asset ast on ast.id = r.asset_id
    left join public.location loc on loc.id = r.location_id
    cross join needle
    where (
      p_status is null
      or p_status = ''
      or (p_status = 'pending' and r.cancelled = false and r.work_order_id is null and r.in_treatment = false)
      or (p_status = 'treating' and r.cancelled = false and r.work_order_id is null and r.in_treatment = true)
      or (p_status = 'approved' and r.work_order_id is not null)
      or (p_status = 'rejected' and r.cancelled = true)
    )
    and (
      needle.pattern is null
      or coalesce(r.custom_id, '') ilike needle.pattern escape '\'
      or r.title ilike needle.pattern escape '\'
      or coalesce(r.description, '') ilike needle.pattern escape '\'
      or coalesce(r.requester_name, '') ilike needle.pattern escape '\'
      or coalesce(r.requester_phone, '') ilike needle.pattern escape '\'
      or coalesce(ast.name, '') ilike needle.pattern escape '\'
      or coalesce(loc.name, '') ilike needle.pattern escape '\'
    )
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'totalAll', (select count(*) from public.request),
    'items', coalesce((
      select jsonb_agg(payload order by sort_at desc)
      from (
        select
          r.created_at as sort_at,
          jsonb_build_object(
            'id', r.id,
            'customId', r.custom_id,
            'title', r.title,
            'description', r.description,
            'requesterName', r.requester_name,
            'requesterPhone', r.requester_phone,
            'createdAt', r.created_at,
            'cancelled', r.cancelled,
            'cancellationReason', r.cancellation_reason,
            'workOrderId', r.work_order_id,
            'workOrderCustomId', wo.custom_id,
            'assetId', r.asset_id,
            'assetName', ast.name,
            'locationId', r.location_id,
            'locationName', loc.name,
            'inTreatment', r.in_treatment
          ) as payload
        from filtered
        join public.request r on r.id = filtered.id
        left join public.asset ast on ast.id = r.asset_id
        left join public.location loc on loc.id = r.location_id
        left join public.work_order wo on wo.id = r.work_order_id
        order by r.created_at desc
        limit (select lim from bounds)
        offset (select off from bounds)
      ) rows
    ), '[]'::jsonb)
  );
$$;
