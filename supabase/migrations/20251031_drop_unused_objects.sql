-- Cleanup unused backend objects (approved GO)
-- Objects:
--   - VIEW public.active_matches
--   - TABLE public.event_checkins
--   - TABLE public.match_notes
-- Safe drops with IF EXISTS and CASCADE; no-ops if already absent.

-- Drop view first (in case of dependencies)
DROP VIEW IF EXISTS public.active_matches CASCADE;

-- Drop tables
DROP TABLE IF EXISTS public.event_checkins CASCADE;
DROP TABLE IF EXISTS public.match_notes CASCADE;
