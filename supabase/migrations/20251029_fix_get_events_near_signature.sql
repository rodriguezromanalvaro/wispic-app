-- Remove ambiguous get_events_near overloads so PostgREST can resolve the RPC
-- Some environments still have a legacy signature with p_radius_km as double precision
-- Keep only the canonical integer p_radius_km version

-- Drop legacy overloads if present
DROP FUNCTION IF EXISTS public.get_events_near(double precision,double precision,double precision,timestamptz,text);
DROP FUNCTION IF EXISTS public.get_events_near(double precision,double precision,double precision,timestamptz);

-- Ensure canonical function exists (integer p_radius_km)
CREATE OR REPLACE FUNCTION public.get_events_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_km integer,
  p_min_start timestamptz,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  event_id bigint,
  distance_km double precision
)
LANGUAGE sql
STABLE
AS $$
  WITH center AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS g
  )
  SELECT e.id AS event_id,
         ROUND((ST_Distance(
           COALESCE(e.geog, v.geog),
           (SELECT g FROM center)
         ) / 1000.0)::numeric, 2)::double precision AS distance_km
  FROM public.events e
  JOIN public.venues v ON v.id = e.venue_id
  WHERE e.start_at >= p_min_start
    AND COALESCE(e.status, 'published') = 'published'
    AND COALESCE(e.geog, v.geog) IS NOT NULL
    AND ST_DWithin(
      COALESCE(e.geog, v.geog),
      (SELECT g FROM center),
      GREATEST(0, p_radius_km) * 1000.0
    )
    AND (
      p_search IS NULL
      OR e.title ILIKE '%' || p_search || '%'
      OR v.name ILIKE '%' || p_search || '%'
    )
  ORDER BY 2 ASC, e.start_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_events_near(double precision,double precision,integer,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_events_near(double precision,double precision,integer,timestamptz,text) TO anon, authenticated;

-- After applying, reload PostgREST schema to clear overload cache:
-- NOTIFY pgrst, 'reload schema';
