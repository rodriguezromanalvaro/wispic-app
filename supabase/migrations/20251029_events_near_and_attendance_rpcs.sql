-- Events proximity RPC and attendance toggle RPCs
-- - get_events_near(lat, lng, radius_km, min_start, search?)
-- - join_event(event_id)
-- - leave_event(event_id)
-- Includes helpful geospatial indexes if missing.

-- Safety: create GiST indexes if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_events_geog'
  ) THEN
    EXECUTE 'CREATE INDEX idx_events_geog ON public.events USING GIST (geog)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_venues_geog'
  ) THEN
    EXECUTE 'CREATE INDEX idx_venues_geog ON public.venues USING GIST (geog)';
  END IF;
END$$;

-- Drop old signatures if any (to allow changes)
DROP FUNCTION IF EXISTS public.get_events_near(double precision,double precision,integer,timestamptz,text);
DROP FUNCTION IF EXISTS public.get_events_near(double precision,double precision,integer,timestamptz);

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

-- Attendance RPCs
DROP FUNCTION IF EXISTS public.join_event(bigint);
CREATE OR REPLACE FUNCTION public.join_event(p_event bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  PERFORM set_config('search_path', 'public,pg_temp', true);
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.event_attendance(event_id, user_id, status)
  VALUES (p_event, uid, 'going')
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = EXCLUDED.status;
END;
$$;

REVOKE ALL ON FUNCTION public.join_event(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_event(bigint) TO authenticated;

DROP FUNCTION IF EXISTS public.leave_event(bigint);
CREATE OR REPLACE FUNCTION public.leave_event(p_event bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  PERFORM set_config('search_path', 'public,pg_temp', true);
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM public.event_attendance
  WHERE event_id = p_event AND user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_event(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_event(bigint) TO authenticated;

COMMENT ON FUNCTION public.get_events_near(double precision,double precision,integer,timestamptz,text)
  IS 'Returns nearby event ids ordered by distance_km from given lat/lng within radius (km); filters by min start and optional search in title/venue.';
COMMENT ON FUNCTION public.join_event(bigint)
  IS 'Marks the current authenticated user as going to the given event (upsert).';
COMMENT ON FUNCTION public.leave_event(bigint)
  IS 'Removes the current authenticated user''s attendance for the given event.';
