-- Mejoras de consistencia para alta de locales (owners)
-- - owner_onboarding_upsert_v3: derivar city_id desde lat/lng si vienen (PostGIS primero, Haversine fallback)
-- - Evitar perfiles de consumidor en owners aunque el flag llegue tarde: borrar perfil al crearse vínculo owner en venue_staff

BEGIN;

-- 1) Reemplazar v3 para derivar city_id por coordenadas si están presentes
CREATE OR REPLACE FUNCTION public.owner_onboarding_upsert_v3(
  p_user_id uuid,
  p_name text,
  p_category venue_category,
  p_city_id bigint,
  p_location_text text,
  p_description text,
  p_avatar_url text,
  p_promote boolean,
  p_attract boolean,
  p_other text,
  p_place_id text DEFAULT NULL,
  p_increase_sales boolean DEFAULT false,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_venue_id bigint;
  v_city_id bigint;
  v_have_coords boolean := (p_lat IS NOT NULL AND p_lng IS NOT NULL);
BEGIN
  -- Si hay coordenadas, intentar localizar la ciudad más cercana
  v_city_id := p_city_id;
  IF v_have_coords THEN
    -- Preferir PostGIS usando geography si cities.geog no es nula
    BEGIN
      SELECT c.id INTO v_city_id
      FROM public.cities c
      WHERE c.geog IS NOT NULL
      ORDER BY ST_Distance(
        c.geog,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat),4326)::geography
      )
      LIMIT 1;
    EXCEPTION WHEN undefined_function THEN
      -- PostGIS no disponible: fallback Haversine aproximado con lat/lng
      v_city_id := NULL;
    END;

    IF v_city_id IS NULL THEN
      -- Fallback Haversine si no hay geog: requerimos lat/lng en cities
      SELECT c.id INTO v_city_id
      FROM public.cities c
      WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
      ORDER BY (
        -- distancia euclídea aproximada (suficiente para rankear)
        (c.lat - p_lat)*(c.lat - p_lat) + (c.lng - p_lng)*(c.lng - p_lng)
      ) ASC
      LIMIT 1;
    END IF;

    -- Si por lo que sea no encontramos, conservar p_city_id
    v_city_id := COALESCE(v_city_id, p_city_id);
  END IF;

  -- Upsert principal (v2) con city_id final
  BEGIN
    v_venue_id := public.owner_onboarding_upsert_v2(
      p_user_id, p_name, p_category, v_city_id, p_location_text, p_description, p_avatar_url,
      p_promote, p_attract, p_other, p_place_id, p_increase_sales
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Ya existe un local con ese nombre en esa ciudad. Elige otro nombre.';
  END;

  -- Si llegaron coordenadas, persistirlas (el trigger BEFORE pondrá geog)
  IF v_have_coords THEN
    UPDATE public.venues
    SET lat = p_lat,
        lng = p_lng
    WHERE id = v_venue_id
      AND (lat IS DISTINCT FROM p_lat OR lng IS DISTINCT FROM p_lng);
  END IF;

  RETURN v_venue_id;
END
$function$;

REVOKE ALL ON FUNCTION public.owner_onboarding_upsert_v3(uuid,text,venue_category,bigint,text,text,text,boolean,boolean,text,text,boolean,double precision,double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_upsert_v3(uuid,text,venue_category,bigint,text,text,text,boolean,boolean,text,text,boolean,double precision,double precision) TO authenticated;

-- 2) Borrar perfil de consumidor cuando el usuario pasa a ser owner (vínculo en venue_staff)
CREATE OR REPLACE FUNCTION public._remove_consumer_profile_when_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  IF NEW.role = 'owner' THEN
    DELETE FROM public.profiles WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END
$func$;

-- Trigger en inserts y en cambios de rol
DROP TRIGGER IF EXISTS trg_remove_profile_on_owner_ins ON public.venue_staff;
CREATE TRIGGER trg_remove_profile_on_owner_ins
AFTER INSERT ON public.venue_staff
FOR EACH ROW
EXECUTE FUNCTION public._remove_consumer_profile_when_owner();

DROP TRIGGER IF EXISTS trg_remove_profile_on_owner_upd ON public.venue_staff;
CREATE TRIGGER trg_remove_profile_on_owner_upd
AFTER UPDATE OF role ON public.venue_staff
FOR EACH ROW
WHEN (NEW.role IS DISTINCT FROM OLD.role)
EXECUTE FUNCTION public._remove_consumer_profile_when_owner();

COMMIT;
