-- Series-only cleanup: drop legacy occurrences artifacts if present
-- Safe IF EXISTS guards; no-ops if objects do not exist.

-- Views/Functions
drop view if exists public.v_feed_occurrences cascade;
drop function if exists public.get_feed_occurrences(text, timestamptz) cascade;

-- Tables
drop table if exists public.event_rsvps cascade;
drop table if exists public.event_occurrences cascade;

-- Optional: opening_schedules was used for occurrences; keep unless sure
drop table if exists public.opening_schedules cascade;
