-- Fixes for Supabase Advisor (Security) - Batch 5
-- Date: 2025-10-16
-- Lints addressed:
--  - function_search_path_mutable (set explicit search_path for functions)
--  - extension_in_public (move unaccent extension to safe schema)

-- 1) Functions: set deterministic search_path
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
        'calculate_level',
        'update_user_level',
        'check_achievement_progress',
        'initialize_user_gamification',
        'slugify_prompt'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public', r);
  END LOOP;
END $$;

-- 2) Move unaccent extension out of public schema
-- Strategy: create a dedicated schema (if not exists), then reinstall extension into that schema.
-- Note: Moving requires recreate; ensure nothing depends on unaccent in public specifically.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'extensions'
  ) THEN
    EXECUTE 'CREATE SCHEMA extensions AUTHORIZATION postgres';
  END IF;
END $$;

-- If unaccent exists in public, drop it and recreate in extensions schema
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'unaccent' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP EXTENSION IF EXISTS unaccent';
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions';
  ELSE
    -- Ensure installed in extensions schema
    IF NOT EXISTS (
      SELECT 1 FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE e.extname = 'unaccent' AND n.nspname = 'extensions'
    ) THEN
      EXECUTE 'CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions';
    END IF;
  END IF;
END $$;
