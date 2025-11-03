-- PostGIS-free fallback: redefine proximity functions using Haversine math only
-- This avoids dependence on spatial_ref_sys and SRID 4326 presence

-- 1) get_events_near: pure math using venue lat/lng (and event geog ignored)
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
AS $$
  WITH base AS (
    SELECT e.id AS event_id,
           COALESCE(v.lat, NULL) AS lat,
           COALESCE(v.lng, NULL) AS lng,
           e.start_at,
           e.title,
           v.name AS venue_name
    FROM public.events e
    JOIN public.venues v ON v.id = e.venue_id
    WHERE e.start_at >= p_min_start
      AND COALESCE(e.status, 'published') = 'published'
  ),
  with_dist AS (
    SELECT event_id,
           CASE
             WHEN lat IS NULL OR lng IS NULL THEN NULL
             ELSE (
               2 * 6371 * asin(
                 sqrt(
                   pow(sin(radians((lat - p_lat) / 2)), 2)
                   + cos(radians(p_lat)) * cos(radians(lat)) * pow(sin(radians((lng - p_lng) / 2)), 2)
                 )
               )
             )
           END AS distance_km,
           start_at,
           title,
           venue_name
    FROM base
  )
  SELECT event_id,
         ROUND(distance_km::numeric, 2)::double precision AS distance_km
  FROM with_dist
  WHERE distance_km IS NOT NULL
    AND distance_km <= GREATEST(0, p_radius_km)
    AND (p_search IS NULL OR title ILIKE '%'||p_search||'%' OR venue_name ILIKE '%'||p_search||'%')
  ORDER BY distance_km ASC, start_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_events_near(double precision,double precision,integer,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_events_near(double precision,double precision,integer,timestamptz,text) TO anon, authenticated;

-- 2) sync_profile_city_from_location trigger function using Haversine (no PostGIS)
CREATE OR REPLACE FUNCTION public.sync_profile_city_from_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

    WITH c AS (
      SELECT c.id, c.name,
             (
               2 * 6371 * asin(
                 sqrt(
                   pow(sin(radians((c.lat - v_lat) / 2)), 2)
                   + cos(radians(v_lat)) * cos(radians(c.lat)) * pow(sin(radians((c.lng - v_lng) / 2)), 2)
                 )
               )
             ) AS dist_km,
             CASE WHEN v_country IS NOT NULL AND c.country_code = v_country THEN 0 ELSE 1 END AS country_rank
      FROM public.cities c
      WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
    )
    SELECT id, name, dist_km INTO v_cid, v_cname, v_dist_km
    FROM c
    ORDER BY country_rank ASC, dist_km ASC
    LIMIT 1;

    IF v_cid IS NULL OR v_dist_km IS NULL OR v_dist_km > 300 THEN
      RETURN NEW;
    END IF;

    UPDATE public.profiles p
      SET city_id = v_cid,
          city = COALESCE(p.city, v_cname)
      WHERE p.id = v_uid AND (p.city_id IS DISTINCT FROM v_cid);

    RETURN NEW;
  EXCEPTION WHEN others THEN
    RETURN NEW;
  END;
END;
$$;

-- Ensure trigger exists and points to this function
DROP TRIGGER IF EXISTS trg_profile_locations_to_profile_city ON public.profile_locations;
CREATE TRIGGER trg_profile_locations_to_profile_city
AFTER INSERT OR UPDATE OF lat, lng, country_code ON public.profile_locations
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_city_from_location();
