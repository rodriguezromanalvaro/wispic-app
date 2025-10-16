-- Fixes for Supabase Advisor (Performance) - Batch 2
-- Date: 2025-10-16
-- Lint addressed: auth_rls_initplan – wrap auth.*() calls as (select auth.*()) in existing policies
-- This migration preserves roles, command, and expressions; only modifies auth.* calls to avoid initplan.

DO $$
DECLARE
  r record;
  role_list text;
  to_clause text;
  for_clause text;
  using_expr text;
  with_expr text;
  sql text;
BEGIN
  FOR r IN
    SELECT pol.polname,
           n.nspname,
           c.relname,
           pol.polcmd,
           pol.polroles,
           pg_get_expr(pol.polqual, pol.polrelid)   AS using_expr,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_expr
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE (n.nspname, c.relname, pol.polname) IN (
      ('public','match_reads','match_reads_update'),
      ('public','cities','cities_admin'),
      ('public','venues','venues_admin'),
      ('public','event_attendance','event_attendance_insert_self2'),
      ('public','event_attendance','event_attendance_update_self2'),
      ('public','events','events_insert_owner'),
      ('public','event_checkins','event_checkins_select_own')
    )
  LOOP
    -- Build role list
    IF r.polroles IS NULL OR array_length(r.polroles,1) IS NULL OR array_length(r.polroles,1) = 0 THEN
      role_list := 'PUBLIC';
    ELSE
      SELECT string_agg(quote_ident(pr.rolname), ', ')
      INTO role_list
      FROM pg_roles pr
      WHERE pr.oid = ANY (r.polroles);
    END IF;

    -- Map command to FOR clause
    for_clause := CASE r.polcmd
      WHEN 'r' THEN 'FOR SELECT'
      WHEN 'c' THEN 'FOR INSERT'
      WHEN 'u' THEN 'FOR UPDATE'
      WHEN 'd' THEN 'FOR DELETE'
      WHEN 'a' THEN 'FOR ALL'
      ELSE ''
    END;

    -- Replace auth.*() with (select auth.*()) in USING / WITH CHECK
    using_expr := r.using_expr;
    IF using_expr IS NOT NULL THEN
      using_expr := regexp_replace(using_expr, 'auth\.([a-z_]+)\(\)', '(select auth.\1())', 'g');
    END IF;

    with_expr := r.with_expr;
    IF with_expr IS NOT NULL THEN
      with_expr := regexp_replace(with_expr, 'auth\.([a-z_]+)\(\)', '(select auth.\1())', 'g');
    END IF;

    -- Recreate policy
    sql := format('DROP POLICY IF EXISTS %I ON %I.%I', r.polname, r.nspname, r.relname);
    EXECUTE sql;

    -- Build optional TO clause (omit if empty -> defaults to PUBLIC)
    IF role_list IS NULL OR btrim(role_list) = '' THEN
      to_clause := '';
    ELSE
      to_clause := ' TO ' || role_list;
    END IF;

    sql := format('CREATE POLICY %I ON %I.%I %s', r.polname, r.nspname, r.relname, for_clause) || to_clause;
    IF using_expr IS NOT NULL THEN
      sql := sql || ' USING (' || using_expr || ')';
    END IF;
    IF with_expr IS NOT NULL THEN
      sql := sql || ' WITH CHECK (' || with_expr || ')';
    END IF;
    EXECUTE sql;
  END LOOP;
END $$;
