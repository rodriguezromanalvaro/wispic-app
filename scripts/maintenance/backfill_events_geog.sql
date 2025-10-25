-- Maintenance: Backfill events.geog for old records using venue geog (and optional event lat/lng)
-- Safe, idempotent, and schema-aware. Run in Supabase SQL editor when needed.

-- 0) Ensure PostGIS
create extension if not exists postgis;

-- 1) Ensure geography on venues from lat/lng where missing
update public.venues v
set geog = ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography
where v.geog is null and v.lat is not null and v.lng is not null;

-- 2) Backfill events.geog from venue.geog where missing
update public.events e
set geog = v.geog
from public.venues v
where e.geog is null and e.venue_id = v.id and v.geog is not null;

-- 3) Optionally: if events has lat/lng columns, use them as a fallback
DO $$
DECLARE
  has_ev_lat boolean := (
    select exists (
      select 1
      from information_schema.columns
      where table_schema='public' and table_name='events' and column_name='lat'
    )
  );
  has_ev_lng boolean := (
    select exists (
      select 1
      from information_schema.columns
      where table_schema='public' and table_name='events' and column_name='lng'
    )
  );
BEGIN
  IF has_ev_lat AND has_ev_lng THEN
    update public.events e
    set geog = ST_SetSRID(ST_MakePoint(e.lng, e.lat), 4326)::geography
    where e.geog is null and e.lat is not null and e.lng is not null;
  END IF;
END $$;

-- 4) Indexes (no-op if already exist)
create index if not exists events_geog_gix on public.events using gist (geog);
create index if not exists venues_geog_gix on public.venues using gist (geog);

-- 5) Summary checks
select
  (select count(*) from public.events where geog is null) as events_without_geog,
  (select count(*) from public.events where geog is not null) as events_with_geog,
  (select count(*) from public.venues where geog is null) as venues_without_geog,
  (select count(*) from public.venues where geog is not null) as venues_with_geog;
