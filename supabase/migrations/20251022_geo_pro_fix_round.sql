-- Fix get_events_near: use numeric for rounding with 2 decimals, then cast back to double precision
-- This avoids ERROR: function round(double precision, integer) does not exist

create or replace function public.get_events_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision,
  p_min_start timestamptz,
  p_search text default null
) returns table (
  event_id bigint,
  distance_km double precision
)
language sql
set search_path = public
as $$
  with center as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  ), base as (
    select
      e.id as event_id,
      e.start_at,
      ST_Distance(e.geog, (select g from center)) as meters
    from public.events e
    where e.geog is not null
      and e.start_at >= p_min_start
      and ST_DWithin(e.geog, (select g from center), p_radius_km * 1000.0)
      and (
        p_search is null
        or to_tsvector('simple', coalesce(e.title,'') || ' ' || coalesce(e.description,'')) @@ plainto_tsquery('simple', p_search)
      )
  )
  select
    b.event_id,
    (round((b.meters / 1000.0)::numeric, 2))::double precision as distance_km
  from base b
  order by b.meters asc, b.start_at asc, b.event_id asc;
$$;

-- Permissions (adjust as needed; assuming events are readable by authenticated users)
revoke all on function public.get_events_near(double precision, double precision, double precision, timestamptz, text) from public;
grant execute on function public.get_events_near(double precision, double precision, double precision, timestamptz, text) to authenticated;
