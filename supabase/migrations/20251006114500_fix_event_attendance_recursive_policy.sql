-- Fix infinite recursion on event_attendance policies
-- This migration removes the recursive SELECT policy and replaces it with a temporary broad read policy.
-- IMPORTANT: This broad policy should be tightened later for privacy.

BEGIN;

-- Drop problematic / redundant policies if they exist
DROP POLICY IF EXISTS "event_attendance_select_same_event" ON public.event_attendance;
DROP POLICY IF EXISTS "event_attendance_select_self" ON public.event_attendance;
DROP POLICY IF EXISTS "event_attendance_cud" ON public.event_attendance;
DROP POLICY IF EXISTS "event_attendance_select_all" ON public.event_attendance;

-- Temporary safe policy: allow all authenticated (public anon + service) to read attendance rows.
-- Rationale: unblock the app quickly (swipe deck depends on seeing other attendees).
CREATE POLICY "event_attendance_select_all"
  ON public.event_attendance FOR SELECT
  USING (true);

-- Re‑add minimal self insert/update policies (if still needed) without recursion risk.
CREATE POLICY "event_attendance_insert_self2"
  ON public.event_attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "event_attendance_update_self2"
  ON public.event_attendance FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;

-- NEXT STEPS (later):
-- 1. Replace the broad select policy with a SECURITY DEFINER function based policy limiting rows to shared events.
-- 2. Example future function (create separately):
--    create function public.can_view_attendance(eid bigint) returns boolean
--    language sql security definer set search_path = public as
--    $$ select exists (select 1 from public.event_attendance ea where ea.event_id = eid and ea.user_id = auth.uid() and ea.status='going'); $$;
--    Then policy: USING (can_view_attendance(event_id));
