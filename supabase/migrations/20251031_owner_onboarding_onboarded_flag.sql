-- Marcar owner_onboarded=true en auth.users al completar el onboarding de owner

BEGIN;

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
  -- Derivar city_id por coordenadas si es posible (PostGIS primero, Haversine fallback)
  v_city_id := p_city_id;
  IF v_have_coords THEN
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
      v_city_id := NULL;
    END;

    IF v_city_id IS NULL THEN
      SELECT c.id INTO v_city_id
      FROM public.cities c
      WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
      ORDER BY (
        (c.lat - p_lat)*(c.lat - p_lat) + (c.lng - p_lng)*(c.lng - p_lng)
      ) ASC
      LIMIT 1;
    END IF;
    v_city_id := COALESCE(v_city_id, p_city_id);
  END IF;

  -- Upsert principal (v2)
  BEGIN
    v_venue_id := public.owner_onboarding_upsert_v2(
      p_user_id, p_name, p_category, v_city_id, p_location_text, p_description, p_avatar_url,
      p_promote, p_attract, p_other, p_place_id, p_increase_sales
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='Ya existe un local con ese nombre en esa ciudad. Elige otro nombre.';
  END;

  -- Guardar coordenadas -> trigger BEFORE rellenará geog
  IF v_have_coords THEN
    UPDATE public.venues
    SET lat = p_lat,
        lng = p_lng
    WHERE id = v_venue_id AND (lat IS DISTINCT FROM p_lat OR lng IS DISTINCT FROM p_lng);
  END IF;

  -- Marcar que el owner completó onboarding (telemetría)
  BEGIN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{owner_onboarded}', 'true'::jsonb, true),
        updated_at = now()
    WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- No romper el flujo si no tenemos permisos
    NULL;
  END;

  RETURN v_venue_id;
END
$function$;

REVOKE ALL ON FUNCTION public.owner_onboarding_upsert_v3(uuid,text,venue_category,bigint,text,text,text,boolean,boolean,text,text,boolean,double precision,double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_upsert_v3(uuid,text,venue_category,bigint,text,text,text,boolean,boolean,text,text,boolean,double precision,double precision) TO authenticated;

COMMIT;
