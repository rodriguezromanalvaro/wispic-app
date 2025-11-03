-- Auto-sync profiles.city_id from profile_locations (coords) when available
-- Purpose: When a user location is saved/updated, set the nearest city_id automatically
-- Notes:
--  - SECURITY DEFINER to bypass RLS when reading cities/updating profiles
--  - Prefers same country_code if provided in profile_locations
--  - Uses PostGIS geography distance when available; falls back to lat/lng-created geography
--  - Applies a 300km threshold to avoid obviously wrong assignments

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
  -- Defensive: never block the original INSERT/UPDATE on unexpected errors
  BEGIN
  v_uid := NEW.user_id;
  v_lat := NEW.lat;
  v_lng := NEW.lng;
  v_country := NEW.country_code;

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN NEW;
  END IF;

  WITH loc AS (
    SELECT ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography AS g
  )
  SELECT c.id,
         c.name,
         ROUND(
           ST_Distance(
             COALESCE(c.geog, ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326)::geography),
             (SELECT g FROM loc)
           ) / 1000.0, 2
         ) AS dist_km
  INTO v_cid, v_cname, v_dist_km
  FROM public.cities c
  WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
  ORDER BY
    CASE WHEN v_country IS NOT NULL AND c.country_code = v_country THEN 0 ELSE 1 END,
    ST_Distance(
      COALESCE(c.geog, ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326)::geography),
      (SELECT g FROM loc)
    )
  LIMIT 1;

  IF v_cid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Avoid unreasonable matches: require <= 300km
  IF v_dist_km IS NULL OR v_dist_km > 300 THEN
    RETURN NEW;
  END IF;

  -- Only update when changing city_id to avoid loops with the mirror trigger
  UPDATE public.profiles p
  SET city_id = v_cid,
      city = COALESCE(p.city, v_cname)
  WHERE p.id = v_uid
    AND (p.city_id IS DISTINCT FROM v_cid);

  RETURN NEW;
  EXCEPTION WHEN others THEN
    -- Swallow any error to avoid breaking profile_locations writes
    RETURN NEW;
  END;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_locations_to_profile_city ON public.profile_locations;
CREATE TRIGGER trg_profile_locations_to_profile_city
AFTER INSERT OR UPDATE OF lat, lng, country_code ON public.profile_locations
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_city_from_location();

COMMENT ON FUNCTION public.sync_profile_city_from_location()
  IS 'When profile_locations(lat/lng) changes, set profiles.city_id to the nearest city (<=300km), preferring same country; SECURITY DEFINER to bypass RLS.';
