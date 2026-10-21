create or replace function public.assign_custom_id()
returns trigger
language plpgsql
as $$
begin
  if new.custom_id is null or btrim(new.custom_id) = '' then
    if tg_table_name = 'work_order' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'work_order', 'OS-');
    elsif tg_table_name = 'preventive_maintenance' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'preventive_maintenance', 'PM-');
    elsif tg_table_name = 'asset' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'asset', 'A-');
    elsif tg_table_name = 'location' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'location', 'L-');
    elsif tg_table_name = 'request' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'request', 'R-');
    end if;
  end if;
  return new;
end;
$$;

update public.work_order
set custom_id = 'OS-' || substr(custom_id, 4)
where custom_id like 'WO-%';
