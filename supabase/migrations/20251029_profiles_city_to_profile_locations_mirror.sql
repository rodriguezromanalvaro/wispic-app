-- Mirror profiles.city_id into profile_locations using cities lat/lng when available
-- This ensures coordinate-first has data even if the user never granted OS location

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

DROP TRIGGER IF EXISTS trg_profiles_city_to_location ON public.profiles;
CREATE TRIGGER trg_profiles_city_to_location
AFTER INSERT OR UPDATE OF city_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.mirror_profile_city_to_location();

COMMENT ON FUNCTION public.mirror_profile_city_to_location()
  IS 'When profiles.city_id changes, upsert profile_locations with cities lat/lng and label; SECURITY DEFINER to bypass RLS.';
