-- Detalhe do ativo para o drawer: cadastro, ordens e paradas.
-- security invoker: a linha some se não for do tenant do usuário.

create or replace function public.asset_detail(p_asset_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
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
      'area', a.area,
      'acquisitionCost', a.acquisition_cost,
      'inServiceDate', a.in_service_date,
      'warrantyExpirationDate', a.warranty_expiration_date,
      'locationName', loc.name,
      'categoryName', cat.name,
      'imagePath', a.image_url
    ),
    'maintenanceCost', coalesce((
      select round(sum(line.parts_cost + line.labor_cost), 2)
      from (
        select
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
        where wo.asset_id = a.id
          and wo.archived = false
      ) line
    ), 0),
    'events', coalesce((
      select jsonb_agg(item order by item->>'at' desc)
      from (
        select jsonb_build_object(
          'kind', 'work_order',
          'at', coalesce(wo.completed_on, wo.due_date, wo.created_at),
          'id', wo.id,
          'customId', wo.custom_id,
          'title', wo.title,
          'status', wo.status,
          'type', case when wo.parent_pm_id is not null then 'PREVENTIVE' else 'CORRECTIVE' end,
          'partsCost', coalesce(round((
            select sum(wop.quantity * p.cost)
            from public.work_order_part wop
            join public.part p on p.id = wop.part_id
            where wop.work_order_id = wo.id
          ), 2), 0),
          'laborCost', coalesce(round((
            select sum((l.duration_seconds / 3600.0) * coalesce(l.hourly_rate, 0))
            from public.labor l
            where l.work_order_id = wo.id
          ), 2), 0)
        ) as item
        from public.work_order wo
        where wo.asset_id = a.id
          and wo.archived = false
        union all
        select jsonb_build_object(
          'kind', 'downtime',
          'at', d.started_at,
          'id', d.id,
          'durationSeconds', d.duration_seconds
        )
        from public.asset_downtime d
        where d.asset_id = a.id
      ) rows
    ), '[]'::jsonb)
  )
  from public.asset a
  left join public.location loc on loc.id = a.location_id
  left join public.category cat on cat.id = a.category_id
  where a.id = p_asset_id
    and a.archived = false;
$$;

revoke all on function public.asset_detail(uuid) from public;
revoke all on function public.asset_detail(uuid) from anon;
grant execute on function public.asset_detail(uuid) to authenticated;
