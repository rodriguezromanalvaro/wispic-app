-- ==========================================
-- City <-> CityId sync + interested_in normalization
-- Idempotent and safe to re-run
-- ==========================================

-- 0) Optional: keep things scoped to public
-- SET search_path TO public;

-- 1) Sync city from city_id (source of truth: city_id)
CREATE OR REPLACE FUNCTION public.sync_profile_city_from_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If city_id is set, mirror city name (if available)
  IF NEW.city_id IS NOT NULL THEN
    SELECT name INTO NEW.city FROM public.cities WHERE id = NEW.city_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_city_from_id ON public.profiles;
CREATE TRIGGER trg_sync_profile_city_from_id
BEFORE INSERT OR UPDATE OF city_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_city_from_id();

-- 1b) Best-effort: sync city_id from city (only if city_id is null)
CREATE OR REPLACE FUNCTION public.sync_profile_city_id_from_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_city_id bigint;
BEGIN
  -- Only try to resolve if city_id is null and we have a city name
  IF NEW.city_id IS NULL AND COALESCE(NEW.city, '') <> '' THEN
    SELECT c.id INTO v_city_id
    FROM public.cities c
    WHERE lower(c.name) = lower(NEW.city)
    LIMIT 1;

    IF v_city_id IS NOT NULL THEN
      NEW.city_id := v_city_id;
    END IF;
  END IF;

  -- If city_id is already present, do nothing (city_id remains the source of truth)
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_city_id_from_name ON public.profiles;
CREATE TRIGGER trg_sync_profile_city_id_from_name
BEFORE INSERT OR UPDATE OF city ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_city_id_from_name();

-- 2) Set default interested_in to "Todos" for future users
ALTER TABLE public.profiles
  ALTER COLUMN interested_in SET DEFAULT ARRAY['male','female','nonbinary']::text[];

-- 2b) Normalize '*' in interested_in to the explicit list on insert/update
CREATE OR REPLACE FUNCTION public.normalize_interested_in()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If array contains '*', replace with the full list
  IF NEW.interested_in IS NOT NULL AND array_length(NEW.interested_in, 1) IS NOT NULL THEN
    IF '*' = ANY(NEW.interested_in) THEN
      NEW.interested_in := ARRAY['male','female','nonbinary']::text[];
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_interested_in ON public.profiles;
CREATE TRIGGER trg_normalize_interested_in
BEFORE INSERT OR UPDATE OF interested_in ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_interested_in();

-- ==========================================
-- Optional cleanups (uncomment if you agree)
-- ==========================================
-- -- If you don't use onboarding_version anymore:
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS onboarding_version;

-- -- Remove duplicated push token columns (we use public.push_tokens instead):
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS push_token;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS expo_push_token;

-- Done.
