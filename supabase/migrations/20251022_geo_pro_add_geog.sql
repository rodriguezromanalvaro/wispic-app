-- Geo Pro: add geography columns, backfill, indexes, and triggers
-- Safe to run multiple times (idempotent where possible)

-- Ensure PostGIS
create extension if not exists postgis;

-- 1) VENUES: geog from lat/lng
-- Ensure lat/lng exist (if schema used other names previously)
alter table public.venues add column if not exists lat double precision;
alter table public.venues add column if not exists lng double precision;

-- Try to migrate from common alternate column names if present (latitude/longitude)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='venues' and column_name='latitude'
  ) then
    execute 'update public.venues set lat = latitude where lat is null and latitude is not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='venues' and column_name='longitude'
  ) then
    execute 'update public.venues set lng = longitude where lng is null and longitude is not null';
  end if;
end $$;

alter table public.venues add column if not exists geog geography(Point, 4326);

-- Backfill existing rows (only where lat/lng present and geog is NULL)
update public.venues v
set geog = ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography
where v.geog is null and v.lat is not null and v.lng is not null;

-- Index
create index if not exists venues_geog_gix on public.venues using gist (geog);

-- Trigger to keep geog in sync when lat/lng change
create or replace function public._venues_set_geog() returns trigger
language plpgsql as $$
begin
  if NEW.lat is not null and NEW.lng is not null then
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  else
    NEW.geog := null;
  end if;
  return NEW;
end; $$;

-- Drop+create trigger to avoid duplicates
drop trigger if exists venues_set_geog on public.venues;
create trigger venues_set_geog
before insert or update of lat, lng on public.venues
for each row execute procedure public._venues_set_geog();

-- 2) EVENTS: geog copied from venue (preferred)
alter table public.events add column if not exists geog geography(Point, 4326);

-- Backfill from venue where possible
update public.events e
set geog = v.geog
from public.venues v
where e.geog is null and e.venue_id = v.id and v.geog is not null;

-- Index
create index if not exists events_geog_gix on public.events using gist (geog);

-- Trigger: on insert/update of venue_id, copy geog from venue
create or replace function public._events_copy_geog_from_venue() returns trigger
language plpgsql as $$
begin
  if NEW.venue_id is not null then
    select geog into NEW.geog from public.venues where id = NEW.venue_id;
  else
    NEW.geog := null;
  end if;
  return NEW;
end; $$;

drop trigger if exists events_copy_geog_from_venue on public.events;
create trigger events_copy_geog_from_venue
before insert or update of venue_id on public.events
for each row execute procedure public._events_copy_geog_from_venue();

-- Optionally, also update event geog when the referenced venue geog changes
-- (using a deferred maintenance trigger on venues)
create or replace function public._venues_propagate_geog_to_events() returns trigger
language plpgsql as $$
begin
  update public.events set geog = NEW.geog where venue_id = NEW.id;
  return NEW;
end; $$;

drop trigger if exists venues_propagate_geog_to_events on public.venues;
create trigger venues_propagate_geog_to_events
after insert or update of geog on public.venues
for each row execute procedure public._venues_propagate_geog_to_events();

-- 3) CITIES: geog from lat/lng (convenience)
-- Ensure lat/lng exist
alter table public.cities add column if not exists lat double precision;
alter table public.cities add column if not exists lng double precision;

alter table public.cities add column if not exists geog geography(Point, 4326);

update public.cities c
set geog = ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326)::geography
where c.geog is null and c.lat is not null and c.lng is not null;

create index if not exists cities_geog_gix on public.cities using gist (geog);
