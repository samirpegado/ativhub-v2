-- O histórico de manutenção do ativo passa a voltar no máximo 10 ordens por chamada.
-- Os totais (custo, contagem, status) continuam agregados, sem serializar a lista inteira.

drop function if exists public.asset_detail(uuid);
drop function if exists public.asset_detail(uuid, text, integer, integer);

create index if not exists work_order_asset_active_idx
  on public.work_order (asset_id)
  where archived = false;

create index if not exists labor_work_order_id_idx
  on public.labor (work_order_id);

create index if not exists asset_downtime_asset_idx
  on public.asset_downtime (asset_id);

create function public.asset_detail(
  p_asset_id uuid,
  p_history_type text default null,
  p_limit integer default 10,
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
      least(greatest(coalesce(p_limit, 10), 1), 10) as lim,
      greatest(coalesce(p_offset, 0), 0) as off,
      case
        when upper(btrim(coalesce(p_history_type, ''))) in ('PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE')
          then upper(btrim(p_history_type))
        else null
      end as kind
  ),
  target as (
    select a.*
    from public.asset a
    where a.id = p_asset_id
      and a.archived = false
  ),
  line_cost as materialized (
    select
      wo.id,
      wo.custom_id,
      wo.title,
      wo.status,
      wo.type,
      coalesce(wo.completed_on, wo.due_date, wo.created_at) as at,
      coalesce((
        select sum(wop.quantity * p.cost)
        from public.work_order_part wop
        join public.part p on p.id = wop.part_id
        where wop.work_order_id = wo.id
      ), 0) as parts_cost,
      coalesce((
        select sum((l.duration_seconds / 3600.0) * coalesce(l.hourly_rate, 0))
        from public.labor l
        where l.work_order_id = wo.id
      ), 0) as labor_cost
    from public.work_order wo
    join target a on a.id = wo.asset_id
    where wo.archived = false
  )
  select jsonb_build_object(
    'asset', jsonb_build_object(
      'id', a.id,
      'customId', a.custom_id,
      'name', a.name,
      'description', a.description,
      'status', a.status,
      'model', a.model,
      'manufacturer', a.manufacturer,
      'serialNumber', a.serial_number,
      'barCode', a.bar_code,
      'power', a.power,
      'area', a.area,
      'additionalInfos', a.additional_infos,
      'acquisitionCost', a.acquisition_cost,
      'inServiceDate', a.in_service_date,
      'warrantyExpirationDate', a.warranty_expiration_date,
      'locationId', a.location_id,
      'locationName', loc.name,
      'categoryId', a.category_id,
      'categoryName', cat.name,
      'imagePath', a.image_url
    ),
    'partsCost', coalesce((select round(sum(round(lc.parts_cost, 2)), 2) from line_cost lc), 0),
    'laborCost', coalesce((select round(sum(round(lc.labor_cost, 2)), 2) from line_cost lc), 0),
    'workOrderCount', (select count(*) from line_cost),
    'correctiveCount', (select count(*) from line_cost lc where lc.type = 'CORRECTIVE'),
    'preventiveCount', (select count(*) from line_cost lc where lc.type = 'PREVENTIVE'),
    'predictiveCount', (select count(*) from line_cost lc where lc.type = 'PREDICTIVE'),
    'zeroCostCount', (
      select count(*)
      from line_cost lc
      where round(lc.parts_cost + lc.labor_cost, 2) = 0
    ),
    'failureCount', (
      select count(*)
      from public.asset_downtime d
      where d.asset_id = a.id
    ),
    'downtimeSeconds', coalesce((
      select sum(
        case
          when d.ended_at is not null then greatest(extract(epoch from (d.ended_at - d.started_at)), 0)
          when d.duration_seconds > 0 then d.duration_seconds
          else greatest(extract(epoch from (now() - d.started_at)), 0)
        end
      )
      from public.asset_downtime d
      where d.asset_id = a.id
    ), 0),
    'mttrSeconds', (
      select avg(
        case
          when d.ended_at is not null then greatest(extract(epoch from (d.ended_at - d.started_at)), 0)
          else d.duration_seconds
        end
      )
      from public.asset_downtime d
      where d.asset_id = a.id
        and (d.ended_at is not null or d.duration_seconds > 0)
    ),
    'trackedSeconds', greatest(
      extract(epoch from (now() - coalesce(a.in_service_date::timestamptz, a.created_at))),
      0
    ),
    'statusCounts', coalesce((
      select jsonb_object_agg(grouped.status, grouped.cnt)
      from (
        select lc.status, count(*) as cnt
        from line_cost lc
        group by lc.status
      ) grouped
    ), '{}'::jsonb),
    'costLeaders', coalesce((
      select jsonb_agg(item order by (item->>'total')::numeric desc, item->>'id')
      from (
        select jsonb_build_object(
          'id', lc.id,
          'customId', lc.custom_id,
          'title', lc.title,
          'total', round(lc.parts_cost + lc.labor_cost, 2)
        ) as item
        from line_cost lc
        where round(lc.parts_cost + lc.labor_cost, 2) > 0
        order by round(lc.parts_cost + lc.labor_cost, 2) desc, lc.id
        limit 5
      ) top_costs
    ), '[]'::jsonb),
    'history', jsonb_build_object(
      'total', (
        select count(*)
        from line_cost lc
        cross join bounds b
        where b.kind is null or lc.type = b.kind
      ),
      'items', coalesce((
        select jsonb_agg(item order by item->>'at' desc, item->>'id' desc)
        from (
          select jsonb_build_object(
            'id', lc.id,
            'at', lc.at,
            'customId', lc.custom_id,
            'title', lc.title,
            'status', lc.status,
            'type', lc.type,
            'partsCost', round(lc.parts_cost, 2),
            'laborCost', round(lc.labor_cost, 2)
          ) as item
          from line_cost lc
          cross join bounds b
          where b.kind is null or lc.type = b.kind
          order by lc.at desc, lc.id desc
          limit (select lim from bounds)
          offset (select off from bounds)
        ) page
      ), '[]'::jsonb)
    )
  )
  from target a
  left join public.location loc on loc.id = a.location_id
  left join public.category cat on cat.id = a.category_id;
$$;

revoke all on function public.asset_detail(uuid, text, integer, integer) from public, anon;
grant execute on function public.asset_detail(uuid, text, integer, integer) to authenticated;
