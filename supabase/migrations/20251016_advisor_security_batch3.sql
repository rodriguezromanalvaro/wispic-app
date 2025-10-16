-- Fixes for Supabase Advisor (Security) - Batch 3
-- Date: 2025-10-16
-- Lints addressed: function_search_path_mutable (set explicit search_path for functions)

-- We set a deterministic search_path so function name resolution cannot be influenced by role/session.
-- Using 'pg_catalog, public' is a safe default for functions in the public schema.

DO $$
DECLARE
  r regprocedure;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'calculate_age',
        'update_calculated_age_trigger',
        'update_profile_completion_achievement',
        'touch_updated_at'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public', r);
  END LOOP;
END $$;
