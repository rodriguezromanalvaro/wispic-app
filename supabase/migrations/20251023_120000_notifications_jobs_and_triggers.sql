-- Notifications queue and triggers
-- Idempotent-ish: uses IF NOT EXISTS and DROP TRIGGER IF EXISTS

-- 1) Queue table
create table if not exists public.notification_jobs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  type text not null check (type in ('message','like','match','friend_request','general')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts int not null default 0,
  scheduled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists notification_jobs_status_scheduled_idx on public.notification_jobs(status, scheduled_at);

-- 2) Helper: insert job
create or replace function public.enqueue_notification_job(p_user uuid, p_type text, p_payload jsonb)
returns void language plpgsql as $$
begin
  insert into public.notification_jobs(user_id, type, payload)
  values (p_user, p_type, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- 3) On new message -> notify the other participant(s)
create or replace function public.notify_on_message()
returns trigger language plpgsql as $$
declare
  r_match record;
  recipient uuid;
begin
  select user_a, user_b into r_match from public.matches where id = new.match_id;
  if not found then
    return new;
  end if;
  if new.sender = r_match.user_a then
    recipient := r_match.user_b;
  else
    recipient := r_match.user_a;
  end if;

  perform public.enqueue_notification_job(recipient, 'message', jsonb_build_object(
    'match_id', new.match_id,
    'message_id', new.id
  ));
  return new;
end;
$$;

drop trigger if exists trg_notify_on_message on public.messages;
create trigger trg_notify_on_message
  after insert on public.messages
  for each row execute function public.notify_on_message();

-- 4) On new match -> notify both users
create or replace function public.notify_on_match()
returns trigger language plpgsql as $$
begin
  perform public.enqueue_notification_job(new.user_a, 'match', jsonb_build_object('match_id', new.id));
  perform public.enqueue_notification_job(new.user_b, 'match', jsonb_build_object('match_id', new.id));
  return new;
end;
$$;

drop trigger if exists trg_notify_on_match on public.matches;
create trigger trg_notify_on_match
  after insert on public.matches
  for each row execute function public.notify_on_match();

-- 5) On new like -> notify liked user (could be limited to superlikes in app logic)
create or replace function public.notify_on_like()
returns trigger language plpgsql as $$
begin
  perform public.enqueue_notification_job(new.liked, 'like', jsonb_build_object('like_id', new.id, 'type', new.type));
  return new;
end;
$$;

drop trigger if exists trg_notify_on_like on public.likes;
create trigger trg_notify_on_like
  after insert on public.likes
  for each row execute function public.notify_on_like();

-- NOTE: Event reminder jobs can be scheduled by a periodic task selecting upcoming RSVPs and enqueuing 'general' type
-- with appropriate payload (occurrence_id, starts_at). Implemented as a cron or edge function scheduler outside this migration.
