-- Policies to allow users to see other attendees of the same events and their profiles
-- Adjust or remove existing conflicting policies before applying if needed.

-- Enable RLS (idempotent-ish; if already enabled this just keeps it on)
ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- (Optional) Drop old policies if they exist (commented out to avoid accidental deletion)
-- DROP POLICY IF EXISTS "Only self attendance select" ON public.event_attendance;
-- DROP POLICY IF EXISTS "Public profiles" ON public.profiles;

-- Allow a user to see their own attendance rows
CREATE POLICY "event_attendance_select_self"
  ON public.event_attendance FOR SELECT
  USING (auth.uid() = user_id);

-- Allow a user to see OTHER attendees of any event they are 'going' to
CREATE POLICY "event_attendance_select_same_event"
  ON public.event_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_attendance me
      WHERE me.event_id = event_attendance.event_id
        AND me.user_id = auth.uid()
        AND me.status = 'going'
    )
  );

-- Allow inserting your own attendance
CREATE POLICY "event_attendance_insert_self"
  ON public.event_attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- (Optional) allow updating your own attendance status
CREATE POLICY "event_attendance_update_self"
  ON public.event_attendance FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Profiles: allow selecting profiles for users who share at least one event (going) with you OR yourself.
CREATE POLICY "profiles_select_shared_event_or_self"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id OR EXISTS (
      SELECT 1 FROM public.event_attendance ea1
      JOIN public.event_attendance ea2 ON ea1.event_id = ea2.event_id
      WHERE ea1.user_id = auth.uid()
        AND ea2.user_id = profiles.id
        AND ea1.status = 'going'
        AND ea2.status = 'going'
    )
  );

-- (Optional) If you want profiles broadly visible, you could loosen the above to USING (true)
-- but current logic keeps visibility constrained to shared events.

-- NOTE: If you previously had a blanket restrictive policy (like only self), ensure it's dropped.
-- After applying, test with:
-- select * from public.event_attendance where event_id = <id>;
-- select id, display_name from public.profiles where id in (select user_id from public.event_attendance where event_id = <id>);
