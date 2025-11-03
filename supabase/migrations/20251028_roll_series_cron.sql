-- Roll series forward automatically ~7 days ahead
-- Creates a helper function to roll forward all active series and a daily job via pg_cron.

-- Ensure pg_cron is available (managed by Supabase in most projects)
create extension if not exists pg_cron;

-- Helper function: roll forward all active series by a fixed horizon (default 1 week)
create or replace function public.roll_series_forward_all(p_horizon_weeks integer default 1)
returns void
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in
    select id from public.event_series where active = true
  loop
    perform public.roll_series_forward(p_series_id := r.id, p_horizon_weeks := p_horizon_weeks);
  end loop;
end;
$$;

comment on function public.roll_series_forward_all(integer) is 'Roll forward all active event series by the given horizon (weeks).';

-- Nightly schedule at 02:00 (UTC) to ensure the next ~7 days are generated
select cron.schedule(
  'roll_series_forward_all_nightly',
  '0 2 * * *',
  $$select public.roll_series_forward_all(1);$$
) on conflict do nothing;
