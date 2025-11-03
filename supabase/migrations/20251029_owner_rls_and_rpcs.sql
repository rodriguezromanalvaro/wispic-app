-- Tighten RLS for events and add owner-friendly RPCs
-- This migration removes overly permissive SELECT policies on events,
-- introduces scoped SELECT policies, and adds SECURITY DEFINER functions
-- for owner dashboards.

BEGIN;

-- 1) Functions: owner data access wrappers

-- get_owner_venues: returns venues where caller is active owner/manager
CREATE OR REPLACE FUNCTION public.get_owner_venues()
RETURNS SETOF public.venues
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT v.*
  FROM public.venues v
  WHERE EXISTS (
    SELECT 1
    FROM public.venue_staff vs
    WHERE vs.venue_id = v.id
      AND vs.user_id = auth.uid()
      AND vs.active = true
      AND vs.role IN ('owner','manager')
  );
$$;

-- list_owner_events: returns events for venues where caller is active owner/manager
CREATE OR REPLACE FUNCTION public.list_owner_events(
  p_venue_id bigint DEFAULT NULL,
  p_include_drafts boolean DEFAULT true
)
RETURNS SETOF public.events
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT e.*
  FROM public.events e
  WHERE EXISTS (
    SELECT 1
    FROM public.venue_staff vs
    WHERE vs.venue_id = e.venue_id
      AND vs.user_id = auth.uid()
      AND vs.active = true
      AND vs.role IN ('owner','manager')
  )
  AND (p_venue_id IS NULL OR e.venue_id = p_venue_id)
  AND (p_include_drafts OR e.status = 'published');
$$;

-- Restrict execution to authenticated (and service_role implicitly)
REVOKE ALL ON FUNCTION public.get_owner_venues() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_owner_events(bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_venues() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_owner_events(bigint, boolean) TO authenticated;

-- 2) RLS: events SELECT tightening
-- Drop existing SELECT policies on events (some were effectively public via OR true)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'events'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.events', r.policyname);
  END LOOP;
END$$;

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Public can view only published events
CREATE POLICY public_select_published_events
  ON public.events
  FOR SELECT
  USING (status = 'published');

-- Staff (owner/manager, active) can view their venue's events (drafts included)
CREATE POLICY staff_select_venue_events
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_staff vs
      WHERE vs.venue_id = events.venue_id
        AND vs.user_id = auth.uid()
        AND vs.active = true
        AND vs.role IN ('owner','manager')
    )
  );

COMMIT;