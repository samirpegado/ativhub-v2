alter table public.work_order
  drop constraint work_order_parent_request_id_fkey;

alter table public.work_order
  add constraint work_order_parent_request_id_fkey
  foreign key (parent_request_id) references public.request(id) on delete set null;
