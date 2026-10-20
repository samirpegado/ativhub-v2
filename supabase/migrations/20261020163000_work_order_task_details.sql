alter table public.task
  add column if not exists options jsonb not null default '[]'::jsonb,
  add column if not exists membership_id uuid references public.membership(id) on delete set null,
  add column if not exists asset_id uuid references public.asset(id) on delete set null;
