-- Harden city<->city_id sync triggers to bypass RLS issues by using SECURITY DEFINER
-- and a safe search_path. This ensures resolution works even if RLS is enabled on
-- cities/profile_locations.

-- 1) city_id -> city mirror (source of truth: city_id)
CREATE OR REPLACE FUNCTION public.sync_profile_city_from_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.city_id IS NOT NULL THEN
    SELECT name INTO NEW.city FROM public.cities WHERE id = NEW.city_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) city name -> city_id resolver (latest logic; prefers exact/diacritics/slug, then partial, then coords)
CREATE OR REPLACE FUNCTION public.sync_profile_city_id_from_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_city_id bigint;
  v_name text;
  v_lat double precision;
  v_lng double precision;
  v_cc text;
  v_near_id bigint;
  v_near_km double precision;
BEGIN
  IF NEW.city_id IS NULL AND COALESCE(NEW.city,'') <> '' THEN
    v_name := trim(split_part(NEW.city, ',', 1));

    SELECT c.id INTO v_city_id
    FROM public.cities c
    WHERE lower(c.name) = lower(v_name)
       OR lower(public._strip_diacritics(c.name)) = lower(public._strip_diacritics(v_name))
       OR (COALESCE(c.slug,'') <> '' AND c.slug = public._slugify_city_name(v_name))
    LIMIT 1;

    IF v_city_id IS NULL THEN
      SELECT c.id INTO v_city_id
      FROM public.cities c
      WHERE c.name ILIKE v_name || '%'
         OR c.name ILIKE '%' || v_name || '%'
      ORDER BY (CASE WHEN c.name ILIKE v_name || '%' THEN 0 ELSE 1 END), length(c.name) ASC
      LIMIT 1;
    END IF;

    IF v_city_id IS NULL THEN
      SELECT lat, lng, country_code INTO v_lat, v_lng, v_cc
      FROM public.profile_locations
      WHERE user_id = NEW.id;

      IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
        SELECT c.id,
               (ST_Distance(
                  ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography
                ) / 1000.0) AS dist_km
        INTO v_near_id, v_near_km
        FROM public.cities c
        WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
          AND (v_cc IS NULL OR c.country_code IS NULL OR c.country_code = v_cc)
        ORDER BY dist_km ASC
        LIMIT 1;

        IF v_near_id IS NOT NULL AND v_near_km <= 300 THEN
          v_city_id := v_near_id;
        END IF;
      END IF;
    END IF;

    IF v_city_id IS NOT NULL THEN
      NEW.city_id := v_city_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate triggers to bind to updated functions (no-op if already there)
DROP TRIGGER IF EXISTS trg_sync_profile_city_from_id ON public.profiles;
CREATE TRIGGER trg_sync_profile_city_from_id
BEFORE INSERT OR UPDATE OF city_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_city_from_id();

DROP TRIGGER IF EXISTS trg_sync_profile_city_id_from_name ON public.profiles;
CREATE TRIGGER trg_sync_profile_city_id_from_name
BEFORE INSERT OR UPDATE OF city ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_city_id_from_name();

COMMENT ON FUNCTION public.sync_profile_city_from_id() IS 'Mirrors profiles.city from profiles.city_id (SECURITY DEFINER to avoid RLS issues).';
COMMENT ON FUNCTION public.sync_profile_city_id_from_name() IS 'Resolves profiles.city to city_id using robust matching and profile_locations; SECURITY DEFINER to avoid RLS issues.';
