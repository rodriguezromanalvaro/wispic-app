-- Añadir guard en v1 para validar que el usuario existe en Auth antes de intentar crear venue_staff
-- Evita el error de FK y devuelve un mensaje claro para el cliente

BEGIN;

CREATE OR REPLACE FUNCTION public.owner_onboarding_upsert(
  p_user_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_category venue_category,
  p_city_id bigint,
  p_location_text text,
  p_description text,
  p_avatar_url text,
  p_promote boolean,
  p_attract boolean,
  p_other text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_venue_id bigint;
  v_exists boolean;
BEGIN
  -- Guard: el usuario debe existir en Auth antes de continuar
  SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id = p_user_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'No existe el usuario en Auth. Crea la cuenta e inicia sesión antes de continuar.';
  END IF;

  INSERT INTO public.venues (name, email, phone, category, city_id, location_text, description, avatar_url)
  VALUES (p_name, p_email, p_phone, p_category, p_city_id, p_location_text, p_description, p_avatar_url)
  RETURNING id INTO v_venue_id;

  INSERT INTO public.venue_staff (venue_id, user_id, role)
  VALUES (v_venue_id, p_user_id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.venue_goals (venue_id, promote, attract, other)
  VALUES (v_venue_id, p_promote, p_attract, p_other)
  ON CONFLICT (venue_id) DO UPDATE
  SET promote = EXCLUDED.promote,
      attract = EXCLUDED.attract,
      other = EXCLUDED.other,
      updated_at = now();

  RETURN v_venue_id;
END
$function$;

REVOKE ALL ON FUNCTION public.owner_onboarding_upsert(uuid,text,text,text,venue_category,bigint,text,text,text,boolean,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_upsert(uuid,text,text,text,venue_category,bigint,text,text,text,boolean,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_upsert(uuid,text,text,text,venue_category,bigint,text,text,text,boolean,boolean,text) TO service_role;

COMMIT;
