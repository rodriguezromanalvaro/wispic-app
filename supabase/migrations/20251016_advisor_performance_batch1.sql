-- Fixes for Supabase Advisor (Performance) - Batch 1
-- Date: 2025-10-16
-- Lint addressed: auth_rls_initplan – replace auth.uid() with (select auth.uid()) in RLS policies
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- Helper: function to recreate a policy idempotently
DO $$
BEGIN
  -- profile_prompts.profile_prompts_mutate_own
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profile_prompts' AND policyname='profile_prompts_mutate_own'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "profile_prompts_mutate_own" ON public.profile_prompts';
  END IF;
  EXECUTE 'CREATE POLICY "profile_prompts_mutate_own" ON public.profile_prompts FOR ALL TO authenticated USING (profile_id = (select auth.uid())) WITH CHECK (profile_id = (select auth.uid()))';

  -- prompt_interactions.prompt_interactions_insert_own
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prompt_interactions' AND policyname='prompt_interactions_insert_own'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "prompt_interactions_insert_own" ON public.prompt_interactions';
  END IF;
  EXECUTE 'CREATE POLICY "prompt_interactions_insert_own" ON public.prompt_interactions FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()))';

  -- prompt_interactions.prompt_interactions_select_own
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='prompt_interactions' AND policyname='prompt_interactions_select_own'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "prompt_interactions_select_own" ON public.prompt_interactions';
  END IF;
  EXECUTE 'CREATE POLICY "prompt_interactions_select_own" ON public.prompt_interactions FOR SELECT TO authenticated USING (user_id = (select auth.uid()))';

  -- event_attendance.event_attendance_insert_self
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_attendance' AND policyname='event_attendance_insert_self'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "event_attendance_insert_self" ON public.event_attendance';
  END IF;
  EXECUTE 'CREATE POLICY "event_attendance_insert_self" ON public.event_attendance FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()))';

  -- event_attendance.event_attendance_update_self
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_attendance' AND policyname='event_attendance_update_self'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "event_attendance_update_self" ON public.event_attendance';
  END IF;
  EXECUTE 'CREATE POLICY "event_attendance_update_self" ON public.event_attendance FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()))';

  -- profiles.profiles_select_shared_event_or_self
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_shared_event_or_self'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "profiles_select_shared_event_or_self" ON public.profiles';
  END IF;
  EXECUTE 'CREATE POLICY "profiles_select_shared_event_or_self"'
    || ' ON public.profiles'
    || ' FOR SELECT'
    || ' TO authenticated'
    || ' USING ('
    || ' id = (select auth.uid())'
    || ' OR EXISTS ('
    || '   SELECT 1 FROM public.event_attendance ea1'
    || '   JOIN public.event_attendance ea2 ON ea1.event_id = ea2.event_id'
    || '   WHERE ea1.user_id = profiles.id'
    || '     AND ea2.user_id = (select auth.uid())'
    || ' )'
    || ' )';

  -- match_reads.match_reads_select
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='match_reads' AND policyname='match_reads_select'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "match_reads_select" ON public.match_reads';
  END IF;
  EXECUTE 'CREATE POLICY "match_reads_select" ON public.match_reads FOR SELECT TO authenticated USING (user_id = (select auth.uid()))';

  -- match_reads.match_reads_insert
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='match_reads' AND policyname='match_reads_insert'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "match_reads_insert" ON public.match_reads';
  END IF;
  EXECUTE 'CREATE POLICY "match_reads_insert" ON public.match_reads FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()))';
END $$;
