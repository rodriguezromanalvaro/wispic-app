-- Fixes for Supabase Advisor (Performance) - Batch 7
-- Date: 2025-10-16
-- Lint addressed: duplicate_index – drop redundant duplicate index

DO $$
DECLARE
  has_idx boolean;
  has_unique boolean;
BEGIN
  SELECT EXISTS (
           SELECT 1 FROM pg_class i
           JOIN pg_namespace n ON n.oid = i.relnamespace
           WHERE n.nspname = 'public' AND i.relkind = 'i' AND i.relname = 'idx_prompt_template_locale'
         ) INTO has_idx;

  SELECT EXISTS (
           SELECT 1 FROM pg_constraint c
           JOIN pg_class r ON r.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = r.relnamespace
           WHERE n.nspname = 'public'
             AND r.relname = 'profile_prompt_template_locales'
             AND c.contype = 'u'
             AND c.conname = 'profile_prompt_template_locales_template_id_locale_key'
         ) INTO has_unique;

  IF has_idx AND has_unique THEN
    EXECUTE 'DROP INDEX IF EXISTS public.idx_prompt_template_locale';
    RAISE NOTICE 'Dropped duplicate index public.idx_prompt_template_locale';
  ELSE
    RAISE NOTICE 'No duplicate index drop needed (has_idx=%, has_unique=%)', has_idx, has_unique;
  END IF;
END $$;
