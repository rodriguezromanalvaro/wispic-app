-- Diagnostic helper to understand why profiles.city_id is not being set
-- Call: select * from public.diagnose_profile_city('<user-uuid>');

DROP FUNCTION IF EXISTS public.diagnose_profile_city(uuid);
CREATE OR REPLACE FUNCTION public.diagnose_profile_city(p_user uuid)
RETURNS TABLE (
  user_id uuid,
  profile_city text,
  token_city text,
  has_profile_location boolean,
  loc_lat double precision,
  loc_lng double precision,
  loc_country_code text,
  exact_match_id bigint,
  exact_match_name text,
  ilike_match_id bigint,
  ilike_match_name text,
  nearest_city_id bigint,
  nearest_city_name text,
  nearest_distance_km double precision,
  chosen_by_trigger bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_city text;
  v_tok text;
  v_lat double precision;
  v_lng double precision;
  v_cc text;
  v_exact_id bigint; v_exact_name text;
  v_like_id bigint; v_like_name text;
  v_near_id bigint; v_near_name text; v_near_km double precision;
  v_chosen bigint;
BEGIN
  SELECT p.city, p.city_id INTO v_city, v_chosen FROM public.profiles p WHERE p.id = p_user;
  v_tok := trim(split_part(COALESCE(v_city,''), ',', 1));

  SELECT pl.lat, pl.lng, pl.country_code INTO v_lat, v_lng, v_cc
  FROM public.profile_locations pl WHERE pl.user_id = p_user;

  -- exact/diacritic/slug
  SELECT c.id, c.name INTO v_exact_id, v_exact_name
  FROM public.cities c
  WHERE lower(c.name) = lower(v_tok)
     OR lower(public._strip_diacritics(c.name)) = lower(public._strip_diacritics(v_tok))
     OR (COALESCE(c.slug,'') <> '' AND c.slug = public._slugify_city_name(v_tok))
  LIMIT 1;

  -- ilike partial
  IF v_exact_id IS NULL AND COALESCE(v_tok,'') <> '' THEN
    SELECT c.id, c.name INTO v_like_id, v_like_name
    FROM public.cities c
    WHERE c.name ILIKE v_tok || '%'
       OR c.name ILIKE '%' || v_tok || '%'
    ORDER BY (CASE WHEN c.name ILIKE v_tok || '%' THEN 0 ELSE 1 END), length(c.name) ASC
    LIMIT 1;
  END IF;

  -- nearest by coords
  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    SELECT c.id, c.name,
           (ST_Distance(
              ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography
            ) / 1000.0) AS dist_km
    INTO v_near_id, v_near_name, v_near_km
    FROM public.cities c
    WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
      AND (v_cc IS NULL OR c.country_code IS NULL OR c.country_code = v_cc)
    ORDER BY dist_km ASC
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT
    p_user,
    v_city,
    NULLIF(v_tok,''),
    (v_lat IS NOT NULL AND v_lng IS NOT NULL) AS has_profile_location,
    v_lat, v_lng, v_cc,
    v_exact_id, v_exact_name,
    v_like_id, v_like_name,
    v_near_id, v_near_name, v_near_km,
    v_chosen;
END;
$$;

REVOKE ALL ON FUNCTION public.diagnose_profile_city(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnose_profile_city(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.diagnose_profile_city(uuid)
  IS 'Returns diagnostics for resolving profiles.city into city_id: tokens, matches and nearest city with distance.';
