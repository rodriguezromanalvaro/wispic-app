-- Fix PostGIS availability and search_path issues
-- 1) Remove accidental shadow table that breaks SRID lookups
-- 2) Ensure PostGIS extension is enabled
-- 3) Recreate functions that use PostGIS with safe search_path including 'extensions'

-- 1) Drop misplaced public.spatial_ref_sys if it exists (PostGIS manages its own)
DROP TABLE IF EXISTS public.spatial_ref_sys CASCADE;

-- 2) Enable PostGIS (installs objects under the 'extensions' schema in Supabase)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 3) Recreate functions with search_path including 'extensions'

-- 3.a) Mirror profiles.city_id -> profile_locations
CREATE OR REPLACE FUNCTION public.mirror_profile_city_to_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
  v_label text;
BEGIN
  IF NEW.city_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.lat, c.lng, c.name INTO v_lat, v_lng, v_label
  FROM public.cities c WHERE c.id = NEW.city_id;

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profile_locations(user_id, lat, lng, city_label, updated_at)
  VALUES(NEW.id, v_lat, v_lng, COALESCE(NEW.city, v_label), now())
  ON CONFLICT (user_id) DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    city_label = COALESCE(EXCLUDED.city_label, public.profile_locations.city_label),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 3.b) Sync profiles.city_id from profile_locations (coords)
CREATE OR REPLACE FUNCTION public.sync_profile_city_from_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_uid uuid;
  v_lat double precision;
  v_lng double precision;
  v_country text;
  v_cid bigint;
  v_cname text;
  v_dist_km double precision;
BEGIN
  BEGIN
    v_uid := NEW.user_id;
    v_lat := NEW.lat;
    v_lng := NEW.lng;
    v_country := NEW.country_code;

    IF v_lat IS NULL OR v_lng IS NULL THEN
      RETURN NEW;
    END IF;

    WITH loc AS (
      SELECT extensions.ST_SetSRID(extensions.ST_MakePoint(v_lng, v_lat), 4326)::geography AS g
    )
    SELECT c.id,
           c.name,
           ROUND(
             extensions.ST_Distance(
               COALESCE(c.geog, extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng, c.lat), 4326)::geography),
               (SELECT g FROM loc)
             ) / 1000.0, 2
           ) AS dist_km
    INTO v_cid, v_cname, v_dist_km
    FROM public.cities c
    WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
    ORDER BY
      CASE WHEN v_country IS NOT NULL AND c.country_code = v_country THEN 0 ELSE 1 END,
      extensions.ST_Distance(
        COALESCE(c.geog, extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng, c.lat), 4326)::geography),
        (SELECT g FROM loc)
      )
    LIMIT 1;

    IF v_cid IS NULL THEN
      RETURN NEW;
    END IF;

    IF v_dist_km IS NULL OR v_dist_km > 300 THEN
      RETURN NEW;
    END IF;

    UPDATE public.profiles p
    SET city_id = v_cid,
        city = COALESCE(p.city, v_cname)
    WHERE p.id = v_uid
      AND (p.city_id IS DISTINCT FROM v_cid);

    RETURN NEW;
  EXCEPTION WHEN others THEN
    RETURN NEW;
  END;
END;
$$;

-- 3.c) Ensure get_events_near uses a search_path that can see PostGIS
DROP FUNCTION IF EXISTS public.get_events_near(double precision,double precision,integer,timestamptz,text);
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
SET search_path = public, extensions
AS $$
  WITH center AS (
    SELECT extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography AS g
  )
  SELECT e.id AS event_id,
         ROUND((extensions.ST_Distance(
           COALESCE(e.geog, v.geog),
           (SELECT g FROM center)
         ) / 1000.0)::numeric, 2)::double precision AS distance_km
  FROM public.events e
  JOIN public.venues v ON v.id = e.venue_id
  WHERE e.start_at >= p_min_start
    AND COALESCE(e.status, 'published') = 'published'
    AND COALESCE(e.geog, v.geog) IS NOT NULL
    AND extensions.ST_DWithin(
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

-- After applying, reload PostgREST schema
-- NOTIFY pgrst, 'reload schema';
