-- Fixes for Supabase Advisor (Security) - Batch 1
-- Date: 2025-10-16

-- 1) Views: enforce SECURITY INVOKER so queries respect caller's RLS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'public_profile_public'
  ) THEN
    EXECUTE 'ALTER VIEW public.public_profile_public SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'active_matches'
  ) THEN
    EXECUTE 'ALTER VIEW public.active_matches SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'prompt_locale_audit'
  ) THEN
    EXECUTE 'ALTER VIEW public.prompt_locale_audit SET (security_invoker = true)';
  END IF;
END$$;

-- 2) Enable RLS on public tables flagged by advisor
ALTER TABLE IF EXISTS public.prompt_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prompt_template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.venue_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.venue_goals ENABLE ROW LEVEL SECURITY;

-- 3) Ensure authenticated role has SELECT privilege (RLS will still restrict rows)
GRANT SELECT ON TABLE public.prompt_categories TO authenticated;
GRANT SELECT ON TABLE public.prompt_template_categories TO authenticated;
GRANT SELECT ON TABLE public.venue_staff TO authenticated;
GRANT SELECT ON TABLE public.venue_goals TO authenticated;

-- 4) Create safe, minimal SELECT policies (idempotent via policy-exists checks)

-- prompt_categories: readable by authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prompt_categories'
      AND policyname = 'read_prompt_categories_authenticated'
  ) THEN
    EXECUTE 'CREATE POLICY "read_prompt_categories_authenticated"'
      ' ON public.prompt_categories'
      ' FOR SELECT'
      ' TO authenticated'
      ' USING (true)';
  END IF;
END$$;

-- prompt_template_categories: readable by authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prompt_template_categories'
      AND policyname = 'read_prompt_template_categories_authenticated'
  ) THEN
    EXECUTE 'CREATE POLICY "read_prompt_template_categories_authenticated"'
      ' ON public.prompt_template_categories'
      ' FOR SELECT'
      ' TO authenticated'
      ' USING (true)';
  END IF;
END$$;

-- venue_staff: readable only by the user on their own memberships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'venue_staff'
      AND policyname = 'read_own_venue_staff'
  ) THEN
    EXECUTE 'CREATE POLICY "read_own_venue_staff"'
      ' ON public.venue_staff'
      ' FOR SELECT'
      ' TO authenticated'
      ' USING (user_id = auth.uid())';
  END IF;
END$$;

-- venue_goals: readable only by active staff/owners of the venue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'venue_goals'
      AND policyname = 'read_venue_goals_as_staff'
  ) THEN
    EXECUTE 'CREATE POLICY "read_venue_goals_as_staff"'
      ' ON public.venue_goals'
      ' FOR SELECT'
      ' TO authenticated'
      ' USING (EXISTS ('
      '   SELECT 1 FROM public.venue_staff vs'
      '   WHERE vs.venue_id = venue_goals.venue_id'
      '     AND vs.user_id = auth.uid()'
      '     AND vs.active = true'
      ' ))';
  END IF;
END$$;

-- Note: We intentionally only add SELECT policies to avoid accidental writes from clients.
-- If the app needs INSERT/UPDATE/DELETE, we will add stricter policies in a follow-up.
