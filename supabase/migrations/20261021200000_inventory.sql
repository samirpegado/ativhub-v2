-- Peças e conjuntos. As listas filtram, buscam e paginam na RPC.

create table public.part_set (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.part_set_item (
  part_set_id uuid not null references public.part_set(id) on delete cascade,
  part_id uuid not null references public.part(id) on delete cascade,
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  primary key (part_set_id, part_id)
);

create index part_set_tenant_id_idx on public.part_set (tenant_id);
create index part_set_item_part_id_idx on public.part_set_item (part_id);

alter table public.part_set enable row level security;
alter table public.part_set_item enable row level security;

create policy part_set_isolation on public.part_set
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy part_set_item_isolation on public.part_set_item
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create trigger part_set_set_updated_at
  before update on public.part_set
  for each row execute function public.set_updated_at();

create function public.parts_screen(
  p_search text default null,
  p_stock text default null,
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
      nullif(btrim(p_stock), '') as stock,
      least(greatest(coalesce(p_limit, 20), 1), 20) as lim,
      greatest(coalesce(p_offset, 0), 0) as off
  ),
  needle as (
    select
      case
        when term is null then null
        else '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      end as pattern
    from bounds
  ),
  filtered as (
    select p.id, p.name
    from public.part p
    left join public.category c on c.id = p.category_id
    cross join bounds
    cross join needle
    where (
      bounds.stock is null
      or bounds.stock = 'all'
      or (bounds.stock = 'low' and p.non_stock = false and p.quantity < p.min_quantity)
      or (bounds.stock = 'ok' and p.non_stock = false and p.quantity >= p.min_quantity)
      or (bounds.stock = 'non_stock' and p.non_stock = true)
    )
    and (
      needle.pattern is null
      or p.name ilike needle.pattern escape '\'
      or coalesce(p.description, '') ilike needle.pattern escape '\'
      or coalesce(p.bar_code, '') ilike needle.pattern escape '\'
      or coalesce(p.area, '') ilike needle.pattern escape '\'
      or coalesce(p.unit, '') ilike needle.pattern escape '\'
      or coalesce(c.name, '') ilike needle.pattern escape '\'
    )
  )
  select jsonb_build_object(
    'parts', coalesce((
      select jsonb_agg(row_to_json(page)::jsonb)
      from (
        select
          p.id,
          p.name,
          p.description,
          p.cost,
          p.quantity,
          p.min_quantity as "minQuantity",
          p.non_stock as "nonStock",
          p.unit,
          p.bar_code as barcode,
          p.area,
          p.category_id as "categoryId",
          c.name as "categoryName",
          p.image_url as "imagePath",
          p.created_at as "createdAt"
        from filtered f
        join public.part p on p.id = f.id
        left join public.category c on c.id = p.category_id
        cross join bounds
        order by p.name
        limit (select lim from bounds)
        offset (select off from bounds)
      ) page
    ), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'totalAll', (select count(*) from public.part),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
      from public.category
      where type = 'PART'
    ), '[]'::jsonb)
  );
$$;

create function public.part_detail(p_part_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'part', (
      select jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'cost', p.cost,
        'quantity', p.quantity,
        'minQuantity', p.min_quantity,
        'nonStock', p.non_stock,
        'unit', p.unit,
        'barcode', p.bar_code,
        'area', p.area,
        'categoryId', p.category_id,
        'categoryName', c.name,
        'imagePath', p.image_url,
        'createdAt', p.created_at
      )
      from public.part p
      left join public.category c on c.id = p.category_id
      where p.id = p_part_id
    ),
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'quantity', m.quantity,
        'reason', m.reason,
        'createdAt', m.created_at,
        'workOrderId', m.work_order_id,
        'workOrderCustomId', wo.custom_id,
        'workOrderTitle', wo.title
      ) order by m.created_at desc)
      from public.stock_movement m
      left join public.work_order wo on wo.id = m.work_order_id
      where m.part_id = p_part_id
    ), '[]'::jsonb),
    'workOrders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', wo.id,
        'customId', wo.custom_id,
        'title', wo.title,
        'status', wo.status,
        'quantity', wop.quantity
      ) order by wo.created_at desc)
      from public.work_order_part wop
      join public.work_order wo on wo.id = wop.work_order_id
      where wop.part_id = p_part_id
        and wo.archived = false
    ), '[]'::jsonb)
  );
$$;

create function public.part_sets_screen(
  p_search text default null,
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
    select
      case
        when term is null then null
        else '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      end as pattern
    from bounds
  ),
  filtered as (
    select s.id, s.name
    from public.part_set s
    cross join needle
    where needle.pattern is null
      or s.name ilike needle.pattern escape '\'
      or exists (
        select 1
        from public.part_set_item i
        join public.part p on p.id = i.part_id
        where i.part_set_id = s.id
          and p.name ilike needle.pattern escape '\'
      )
  )
  select jsonb_build_object(
    'sets', coalesce((
      select jsonb_agg(row_to_json(page)::jsonb)
      from (
        select
          s.id,
          s.name,
          s.created_at as "createdAt",
          coalesce(items.part_count, 0) as "partCount",
          coalesce(items.total_cost, 0) as "totalCost",
          coalesce(items.part_ids, '[]'::jsonb) as "partIds"
        from filtered f
        join public.part_set s on s.id = f.id
        left join lateral (
          select
            count(*) as part_count,
            coalesce(sum(p.cost), 0) as total_cost,
            coalesce(jsonb_agg(p.id order by p.name), '[]'::jsonb) as part_ids
          from public.part_set_item i
          join public.part p on p.id = i.part_id
          where i.part_set_id = s.id
        ) items on true
        cross join bounds
        order by s.name
        limit (select lim from bounds)
        offset (select off from bounds)
      ) page
    ), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'totalAll', (select count(*) from public.part_set),
    'parts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'cost', cost,
        'unit', unit
      ) order by name)
      from public.part
    ), '[]'::jsonb)
  );
$$;

create function public.part_set_detail(p_set_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'set', (
      select jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'createdAt', s.created_at,
        'totalCost', coalesce((
          select sum(p.cost)
          from public.part_set_item i
          join public.part p on p.id = i.part_id
          where i.part_set_id = s.id
        ), 0),
        'parts', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'cost', p.cost,
            'unit', p.unit
          ) order by p.name)
          from public.part_set_item i
          join public.part p on p.id = i.part_id
          where i.part_set_id = s.id
        ), '[]'::jsonb)
      )
      from public.part_set s
      where s.id = p_set_id
    )
  );
$$;

revoke all on function public.parts_screen(text, text, integer, integer) from public;
revoke all on function public.parts_screen(text, text, integer, integer) from anon;
grant execute on function public.parts_screen(text, text, integer, integer) to authenticated;

revoke all on function public.part_detail(uuid) from public;
revoke all on function public.part_detail(uuid) from anon;
grant execute on function public.part_detail(uuid) to authenticated;

revoke all on function public.part_sets_screen(text, integer, integer) from public;
revoke all on function public.part_sets_screen(text, integer, integer) from anon;
grant execute on function public.part_sets_screen(text, integer, integer) to authenticated;

revoke all on function public.part_set_detail(uuid) from public;
revoke all on function public.part_set_detail(uuid) from anon;
grant execute on function public.part_set_detail(uuid) to authenticated;
