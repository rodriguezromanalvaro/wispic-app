-- ==========================================
-- Update match_profiles: require onboarding_completed and prioritize/filter by proximity
-- Idempotent and safe to re-run
-- ==========================================

-- Notes:
-- - Keeps the same signature and return type (SETOF public.public_profile_public)
-- - Enforces that BOTH the viewer and candidates have onboarding_completed = true
-- - Applies distance filter ONLY when both sides have city_id and coordinates
-- - Uses viewer.max_distance_km (default 50) as the distance cutoff
-- - Orders primarily by available distance (nearer first), then by recency

CREATE OR REPLACE FUNCTION public.match_profiles(
  _viewer uuid,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS SETOF public.public_profile_public
LANGUAGE sql STABLE
SET search_path TO 'pg_catalog', 'extensions', 'public'
AS $$
  WITH me AS (
    SELECT id, gender, interested_in, onboarding_completed, city_id, max_distance_km
    FROM public.profiles
    WHERE id = _viewer
  ),
  me_city AS (
    SELECT c.id, c.lat, c.lng
    FROM me m
    JOIN public.cities c ON c.id = m.city_id
  ),
  candidates_raw AS (
    SELECT p.*,
      -- Compute Haversine distance in KM when both have city coords; otherwise NULL
      CASE 
        WHEN me.city_id IS NOT NULL AND p.city_id IS NOT NULL 
             AND (SELECT lat FROM me_city) IS NOT NULL AND (SELECT lng FROM me_city) IS NOT NULL
             AND c.lat IS NOT NULL AND c.lng IS NOT NULL
        THEN (
          2 * 6371::numeric * asin(
            sqrt(
              power(sin(radians((c.lat - (SELECT lat FROM me_city))::numeric) / 2), 2)
              + cos(radians((SELECT lat FROM me_city)::numeric)) * cos(radians(c.lat::numeric))
              * power(sin(radians((c.lng - (SELECT lng FROM me_city))::numeric) / 2), 2)
            )
          )
        )::numeric
        ELSE NULL
      END AS distance_km
    FROM public.profiles p
    CROSS JOIN me
    LEFT JOIN public.cities c ON c.id = p.city_id
    WHERE p.id <> me.id
      -- Require onboarding completion for both sides
      AND me.onboarding_completed = true
      AND p.onboarding_completed = true
      -- Mutual interest by gender/orientation
      AND me.gender IS NOT NULL
      AND p.gender IS NOT NULL
      AND array_length(me.interested_in, 1) > 0
      AND array_length(p.interested_in, 1) > 0
      AND me.gender = ANY(p.interested_in)
      AND p.gender = ANY(me.interested_in)
  ),
  candidates AS (
    SELECT cr.*
    FROM candidates_raw cr
    CROSS JOIN me
    WHERE 
      -- If we have a distance, enforce viewer's max_distance_km; otherwise keep
      (cr.distance_km IS NULL OR cr.distance_km <= COALESCE(me.max_distance_km, 50))
  )
  SELECT
    c.id,
    c.display_name,
    c.bio,
    CASE WHEN c.show_gender THEN c.gender ELSE NULL END AS gender,
    CASE WHEN c.show_orientation THEN c.interested_in ELSE '{}'::text[] END AS interested_in,
    c.avatar_url,
    c.updated_at
  FROM candidates c
  ORDER BY
    (c.distance_km IS NULL) ASC,  -- candidates with known distance first
    c.distance_km ASC NULLS LAST,
    c.updated_at DESC
  LIMIT COALESCE(_limit, 50)
  OFFSET COALESCE(_offset, 0);
$$;

-- Grants (kept consistent with previous schema dumps; adjust if you manage grants elsewhere)
DO $$
BEGIN
  -- These will no-op if already granted
  GRANT ALL ON FUNCTION public.match_profiles(uuid, integer, integer) TO anon;
  GRANT ALL ON FUNCTION public.match_profiles(uuid, integer, integer) TO authenticated;
  GRANT ALL ON FUNCTION public.match_profiles(uuid, integer, integer) TO service_role;
EXCEPTION WHEN OTHERS THEN
  -- Safe guard: ignore errors if roles are missing in local environments
  NULL;
END$$;
