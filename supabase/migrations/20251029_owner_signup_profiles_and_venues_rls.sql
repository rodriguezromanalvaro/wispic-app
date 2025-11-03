-- Owner-specific improvements:
-- - Skip creating profiles for owner signups via auth.users trigger
-- - Add owner_onboarding_upsert_v3 with lat/lng support
-- - Tighten RLS on venues so owners don't see others' data during onboarding

BEGIN;

-- 1) Update create_profile_on_auth_user: do NOT create profiles for owner accounts
CREATE OR REPLACE FUNCTION public.create_profile_on_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_display_name text;
  v_is_owner boolean;
BEGIN
  -- Detect owner signups from user metadata
  v_is_owner := COALESCE((NEW.raw_user_meta_data->>'owner')::boolean, false);

  IF v_is_owner THEN
    -- Skip creating a consumer profile for owner accounts
    RETURN NEW;
  END IF;

  -- For non-owner users, create minimal profile
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
$function$;

COMMENT ON FUNCTION public.create_profile_on_auth_user() IS 'Creates a consumer profile on auth.users insert, except when the user metadata indicates an owner account.';

-- 2) Add v3 owner onboarding upsert with lat/lng
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
BEGIN
  -- Delegate main insert/update to v2, but provide a clearer error if the venue name+city already exists
  BEGIN
    v_venue_id := public.owner_onboarding_upsert_v2(
      p_user_id, p_name, p_category, p_city_id, p_location_text, p_description, p_avatar_url,
      p_promote, p_attract, p_other, p_place_id, p_increase_sales
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Friendly error for unique (name, city_id) collisions
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Ya existe un local con ese nombre en esa ciudad. Elige otro nombre.';
  END;

  -- If client provided coordinates, persist them (BEFORE trigger will set geog)
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    UPDATE public.venues
    SET lat = p_lat,
        lng = p_lng
    WHERE id = v_venue_id AND (lat IS DISTINCT FROM p_lat OR lng IS DISTINCT FROM p_lng);
  END IF;

  RETURN v_venue_id;
END
$function$;

REVOKE ALL ON FUNCTION public.owner_onboarding_upsert_v3(uuid,text,venue_category,bigint,text,text,text,boolean,boolean,text,text,boolean,double precision,double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_onboarding_upsert_v3(uuid,text,venue_category,bigint,text,text,text,boolean,boolean,text,text,boolean,double precision,double precision) TO authenticated;

-- 3) Tighten venues RLS: remove public SELECT-all, restrict to owner/manager
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='venues' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.venues', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_select_own_venues
  ON public.venues
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_staff vs
      WHERE vs.venue_id = venues.id
        AND vs.user_id = auth.uid()
        AND vs.active = true
        AND vs.role IN ('owner','manager')
    )
  );

COMMIT;