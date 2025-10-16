-- Fixes for Supabase Advisor (Security) - Batch 6 (safety adjustments)
-- Date: 2025-10-16
-- Purpose:
--  - Move unaccent extension using ALTER EXTENSION (safer than drop/recreate)
--  - Ensure functions that may rely on unaccent include 'extensions' in search_path

-- 1) Ensure target schema exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'extensions'
  ) THEN
    EXECUTE 'CREATE SCHEMA extensions AUTHORIZATION postgres';
  END IF;
END $$;

-- 2) Move unaccent to extensions schema if currently in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'unaccent' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER EXTENSION unaccent SET SCHEMA extensions';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'unaccent' AND n.nspname = 'extensions'
  ) THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions';
  END IF;
END $$;

-- 3) Update search_path of known functions to include extensions
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
        'handle_like_create',
        'archive_inactive_matches',
        'migrate_venue_data',
        'owner_state',
        'calculate_age_immutable',
        'calculate_age',
        'update_calculated_age_trigger',
        'update_profile_completion_achievement',
        'touch_updated_at',
        'moddatetime',
        'set_match_last_message_at',
        'send_message_idempotent',
        'owner_onboarding_upsert',
        'enforce_upper_country_code',
        'match_profiles',
        'set_updated_at',
        'calculate_level',
        'update_user_level',
        'check_achievement_progress',
        'initialize_user_gamification',
        'slugify_prompt'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, extensions, public', r);
  END LOOP;
END $$;
