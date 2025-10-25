-- Add helpful columns to notification_jobs for processing diagnostics
alter table if exists public.notification_jobs
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text;

-- Helpful index to prioritize schedule and status
create index if not exists notification_jobs_sched_idx on public.notification_jobs(scheduled_at);
