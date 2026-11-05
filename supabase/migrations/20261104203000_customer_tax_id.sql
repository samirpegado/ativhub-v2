-- CPF ou CNPJ do cliente. Opcional, único por empresa quando preenchido.

alter table public.customer
  add column if not exists tax_id text;

alter table public.customer
  drop constraint if exists customer_tax_id_check;

alter table public.customer
  add constraint customer_tax_id_check
  check (
    tax_id is null
    or tax_id ~ '^\d{3}\.\d{3}\.\d{3}-\d{2}$'
    or tax_id ~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$'
  );

create unique index if not exists customer_tenant_tax_id_idx
  on public.customer (tenant_id, tax_id)
  where tax_id is not null;

create or replace function public.customers_screen(
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
    select case
      when term is null then null
      else '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    end as pattern
    from bounds
  ),
  filtered as (
    select c.*
    from public.customer c
    cross join needle
    where needle.pattern is null
      or c.name ilike needle.pattern escape '\'
      or coalesce(c.email, '') ilike needle.pattern escape '\'
      or coalesce(c.phone, '') ilike needle.pattern escape '\'
      or coalesce(c.customer_type, '') ilike needle.pattern escape '\'
      or coalesce(c.tax_id, '') ilike needle.pattern escape '\'
      or c.request_pin ilike needle.pattern escape '\'
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'totalAll', (select count(*) from public.customer),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'phone', phone,
          'email', email,
          'website', website,
          'customerType', customer_type,
          'description', description,
          'requestPin', request_pin,
          'taxId', tax_id
        )
        order by name
      )
      from (
        select *
        from filtered
        order by name
        limit (select lim from bounds)
        offset (select off from bounds)
      ) page
    ), '[]'::jsonb)
  );
$$;
