-- Cleanup gamification, add profile auto-create trigger, and seed SRID 4326
BEGIN;

-- 1) Remove gamification: triggers, functions, policies, and tables
-- Triggers
DROP TRIGGER IF EXISTS trigger_check_achievement_progress ON public.user_achievements;
DROP TRIGGER IF EXISTS trigger_update_profile_completion_achievement ON public.profiles;
DROP TRIGGER IF EXISTS trigger_update_user_level ON public.user_achievements;
DROP TRIGGER IF EXISTS trigger_update_user_level ON public.user_levels;

-- Functions
DROP FUNCTION IF EXISTS public.check_achievement_progress() CASCADE;
DROP FUNCTION IF EXISTS public.update_profile_completion_achievement() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_level() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_level(integer) CASCADE;
DROP FUNCTION IF EXISTS public.initialize_user_gamification() CASCADE;

-- Policies (safe to drop if tables exist)
DROP POLICY IF EXISTS "Achievement templates are viewable by all authenticated users" ON public.achievement_templates;
DROP POLICY IF EXISTS "System can update user achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "System can update user levels" ON public.user_levels;
DROP POLICY IF EXISTS "System can update user statistics" ON public.user_statistics;
DROP POLICY IF EXISTS "Users can view their own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Users can view their own levels" ON public.user_levels;
DROP POLICY IF EXISTS "Users can view their own statistics" ON public.user_statistics;

-- Tables
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.user_levels CASCADE;
DROP TABLE IF EXISTS public.user_statistics CASCADE;
DROP TABLE IF EXISTS public.achievement_templates CASCADE;

-- 2) Add auto-create profile trigger on auth.users
CREATE OR REPLACE FUNCTION public.create_profile_on_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
BEGIN
  -- Prefer provided display_name in auth metadata; else email local-part; else short id fallback
  v_display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'user-' || left(NEW.id::text, 8)
  );

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, v_display_name)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_create_profile_after_signup ON auth.users;
CREATE TRIGGER trg_create_profile_after_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_on_auth_user();

-- 3) Ensure spatial_ref_sys exists and seed SRID 4326 (WGS84)
CREATE TABLE IF NOT EXISTS public.spatial_ref_sys (
  srid integer NOT NULL PRIMARY KEY,
  auth_name varchar(256),
  auth_srid integer,
  srtext text,
  proj4text text
);

INSERT INTO public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text)
VALUES (
  4326,
  'EPSG',
  4326,
  'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]',
  '+proj=longlat +datum=WGS84 +no_defs'
)
ON CONFLICT (srid) DO NOTHING;

COMMIT;

-- 4) Improve city sync: normalize country_code and add country-agnostic fallback
CREATE OR REPLACE FUNCTION public.sync_profile_city_from_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cc text;
  v_city_id bigint;
BEGIN
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    RETURN NEW;
  END IF;

  -- Normalize country_code to ISO-3166 alpha-2 (uppercase letters only)
  v_cc := NULLIF(NEW.country_code, '');
  IF v_cc IS NOT NULL THEN
    v_cc := UPPER(REGEXP_REPLACE(v_cc, '[^A-Za-z]', '', 'g'));
    IF length(v_cc) <> 2 THEN
      v_cc := NULL;
    END IF;
  END IF;

  -- Try nearest city within same country if available
  SELECT c.id
  INTO v_city_id
  FROM public.cities c
  WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
    AND (v_cc IS NULL OR c.country_code = v_cc)
  ORDER BY 2 * 6371 * ASIN(
            SQRT(
              POWER(SIN(RADIANS(c.lat - NEW.lat) / 2), 2)
              + COS(RADIANS(NEW.lat)) * COS(RADIANS(c.lat))
              * POWER(SIN(RADIANS(c.lng - NEW.lng) / 2), 2)
            )
          )
  LIMIT 1;

  -- Fallback ignoring country
  IF v_city_id IS NULL THEN
    SELECT c.id
    INTO v_city_id
    FROM public.cities c
    WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
    ORDER BY 2 * 6371 * ASIN(
              SQRT(
                POWER(SIN(RADIANS(c.lat - NEW.lat) / 2), 2)
                + COS(RADIANS(NEW.lat)) * COS(RADIANS(c.lat))
                * POWER(SIN(RADIANS(c.lng - NEW.lng) / 2), 2)
              )
            )
    LIMIT 1;
  END IF;

  UPDATE public.profiles p
  SET city_id = v_city_id
  WHERE p.id = NEW.user_id
    AND p.city_id IS DISTINCT FROM v_city_id;

  RETURN NEW;
END
$$;

-- 5) Harden mirror to avoid trigger loops: only upsert when values change
CREATE OR REPLACE FUNCTION public.mirror_profile_city_to_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
  v_label text;
BEGIN
  -- Avoid recursion on nested trigger invocations just in case
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- If no city set, nothing to mirror
  IF NEW.city_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If this is an UPDATE and city_id didn't change, skip work
  IF TG_OP = 'UPDATE' AND NEW.city_id IS NOT DISTINCT FROM OLD.city_id THEN
    RETURN NEW;
  END IF;

  SELECT c.lat, c.lng, c.name INTO v_lat, v_lng, v_label
  FROM public.cities c WHERE c.id = NEW.city_id;

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert only when values would actually change; otherwise do nothing
  INSERT INTO public.profile_locations(user_id, lat, lng, city_label, updated_at)
  VALUES(NEW.id, v_lat, v_lng, COALESCE(NEW.city, v_label), now())
  ON CONFLICT (user_id) DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    city_label = COALESCE(EXCLUDED.city_label, public.profile_locations.city_label),
    updated_at = now()
  WHERE public.profile_locations.lat IS DISTINCT FROM EXCLUDED.lat
     OR public.profile_locations.lng IS DISTINCT FROM EXCLUDED.lng
     OR COALESCE(public.profile_locations.city_label,'') <> COALESCE(EXCLUDED.city_label,'');

  RETURN NEW;
END
$$;
