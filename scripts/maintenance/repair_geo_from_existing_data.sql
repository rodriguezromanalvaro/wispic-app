-- Maintenance: Repair missing lat/lng and geog using existing data (venues <- events / cities)
-- Run in Supabase SQL editor; safe and idempotent.

-- 0) Ensure PostGIS
create extension if not exists postgis;

-- 1) Normalize venues: if legacy columns latitude/longitude exist, migrate to lat/lng
DO $$
BEGIN
  IF exists (select 1 from information_schema.columns where table_schema='public' and table_name='venues' and column_name='latitude') THEN
    EXECUTE 'update public.venues set lat = latitude where lat is null and latitude is not null';
  END IF;
  IF exists (select 1 from information_schema.columns where table_schema='public' and table_name='venues' and column_name='longitude') THEN
    EXECUTE 'update public.venues set lng = longitude where lng is null and longitude is not null';
  END IF;
END $$;

-- 2) If events has lat/lng, infer venue lat/lng from their events (average per venue)
DO $$
DECLARE
  has_ev_lat boolean := (
    select exists (
      select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='lat'
    )
  );
  has_ev_lng boolean := (
    select exists (
      select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='lng'
    )
  );
BEGIN
  IF has_ev_lat AND has_ev_lng THEN
    with agg as (
      select venue_id, avg(lat) as lat, avg(lng) as lng
      from public.events
      where venue_id is not null and lat is not null and lng is not null
      group by venue_id
    )
    update public.venues v
    set lat = coalesce(v.lat, a.lat),
        lng = coalesce(v.lng, a.lng)
    from agg a
    where v.id = a.venue_id and (v.lat is null or v.lng is null);
  END IF;
END $$;

-- 3) Use cities lat/lng as coarse fallback for venues still missing lat/lng
update public.venues v
set lat = coalesce(v.lat, c.lat),
    lng = coalesce(v.lng, c.lng)
from public.cities c
where v.city_id = c.id
  and (v.lat is null or v.lng is null)
  and c.lat is not null and c.lng is not null;

-- 4) Build venue geog where possible
update public.venues v
set geog = ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography
where v.geog is null and v.lat is not null and v.lng is not null;

-- 5) Propagate geog from venue to events when events.geog is missing
update public.events e
set geog = v.geog
from public.venues v
where e.venue_id = v.id
  and e.geog is null
  and v.geog is not null;

-- 6) Final fallback: if events has lat/lng, set its own geog
DO $$
DECLARE
  has_ev_lat boolean := (
    select exists (
      select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='lat'
    )
  );
  has_ev_lng boolean := (
    select exists (
      select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='lng'
    )
  );
BEGIN
  IF has_ev_lat AND has_ev_lng THEN
    update public.events e
    set geog = ST_SetSRID(ST_MakePoint(e.lng, e.lat), 4326)::geography
    where e.geog is null and e.lat is not null and e.lng is not null;
  END IF;
END $$;

-- 7) Indexes
create index if not exists events_geog_gix on public.events using gist (geog);
create index if not exists venues_geog_gix on public.venues using gist (geog);

-- 8) Summary
select
  (select count(*) from public.events where geog is null) as events_without_geog,
  (select count(*) from public.events where geog is not null) as events_with_geog,
  (select count(*) from public.venues where geog is null) as venues_without_geog,
  (select count(*) from public.venues where geog is not null) as venues_with_geog;