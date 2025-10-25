-- Fix notification_jobs status CHECK to include 'processing'
-- Idempotent: drops old constraint if exists, then adds the correct one.

alter table if exists public.notification_jobs
  drop constraint if exists notification_jobs_status_check;

alter table if exists public.notification_jobs
  add constraint notification_jobs_status_check
  check (status in ('pending','processing','sent','failed'));

-- Optional: ensure index on scheduled_at exists for claiming performance
create index if not exists idx_notification_jobs_scheduled_at
  on public.notification_jobs (scheduled_at);
