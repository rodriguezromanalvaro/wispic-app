-- Secure public tables flagged by Supabase Security Advisor
-- Date: 2025-10-31
-- Notes:
--  - Enables RLS on: public.superlike_counters, public.profile_locations, public.notification_jobs
--  - Adds minimal safe policies for profile_locations (self-manage only)
--  - Removes permissive policies on superlike_counters (access via SECURITY DEFINER only)
--  - spatial_ref_sys is left unchanged (owned by PostGIS) — see footnote below

-- 1) superlike_counters: enable RLS and remove overly-permissive policies
ALTER TABLE public.superlike_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_superlike_counters_select_700633a1_merged ON public.superlike_counters;
DROP POLICY IF EXISTS "update own counters" ON public.superlike_counters;
-- Intentionally no public policies; access via SECURITY DEFINER functions only

-- 2) profile_locations: enable RLS and allow users to manage ONLY their own location
ALTER TABLE public.profile_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own location"
  ON public.profile_locations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "insert own location"
  ON public.profile_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "update own location"
  ON public.profile_locations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete own location"
  ON public.profile_locations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 3) notification_jobs: internal table; enable RLS, no public policies
ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;

-- Footnote: spatial_ref_sys
-- Supabase Advisor flags RLS disabled on public.spatial_ref_sys. This table is managed by PostGIS
-- and may not be alterable by project roles. If needed, enable RLS and add a broad SELECT policy:
--   ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "select all spatial_ref_sys" ON public.spatial_ref_sys FOR SELECT TO anon, authenticated USING (true);
-- If permissions prevent altering, you can safely ignore the lint for this PostGIS system table.
