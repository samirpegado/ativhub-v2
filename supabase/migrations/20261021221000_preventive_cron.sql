-- Gera as ordens vencidas mesmo quando ninguém abre o app.

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'preventive-work-orders') then
    perform cron.unschedule('preventive-work-orders');
  end if;
end $$;

select cron.schedule(
  'preventive-work-orders',
  '15 * * * *',
  $$select public.generate_due_preventive_work_orders()$$
);
