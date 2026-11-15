create or replace function public.assign_custom_id()
returns trigger
language plpgsql
as $$
begin
  if new.custom_id is null or btrim(new.custom_id) = '' then
    if tg_table_name = 'work_order' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'work_order', 'OS-');
    elsif tg_table_name = 'preventive_maintenance' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'preventive_maintenance', 'PV-');
    elsif tg_table_name = 'asset' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'asset', 'A-');
    elsif tg_table_name = 'location' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'location', 'L-');
    elsif tg_table_name = 'request' then
      new.custom_id := public.next_custom_id(new.tenant_id, 'request', 'S-');
    end if;
  end if;
  return new;
end;
$$;

update public.preventive_maintenance
set custom_id = 'PV-' || substr(custom_id, 4)
where custom_id like 'PM-%';

update public.request
set custom_id = 'S-' || substr(custom_id, 3)
where custom_id like 'R-%';
