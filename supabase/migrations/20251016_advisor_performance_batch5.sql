-- Fixes for Supabase Advisor (Performance) - Batch 5
-- Date: 2025-10-16
-- Lint addressed: auth_rls_initplan – rewrite policies to use (select auth.*())
-- Note: 'multiple_permissive_policies' for cities (authenticated INSERT) is deferred to a dedicated review,
--       since merging policies can change semantics if roles differ. We can handle it in a separate PR.

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
      ('public','events','events_select_owner_drafts'),
      ('public','user_photos','user_photos_insert'),
      ('public','user_photos','user_photos_update'),
      ('public','user_photos','user_photos_delete'),
      ('public','venue_staff','read_own_venue_staff'),
      ('public','venue_goals','read_venue_goals_as_staff')
    )
  LOOP
    -- roles list (may be empty -> omit TO and let default PUBLIC apply)
    IF r.polroles IS NULL OR array_length(r.polroles,1) IS NULL OR array_length(r.polroles,1) = 0 THEN
      role_list := '';
    ELSE
      SELECT string_agg(quote_ident(pr.rolname), ', ')
      INTO role_list
      FROM pg_roles pr
      WHERE pr.oid = ANY (r.polroles);
    END IF;

    -- command
    for_clause := CASE r.polcmd
      WHEN 'r' THEN 'FOR SELECT'
      WHEN 'c' THEN 'FOR INSERT'
      WHEN 'u' THEN 'FOR UPDATE'
      WHEN 'd' THEN 'FOR DELETE'
      WHEN 'a' THEN 'FOR ALL'
      ELSE ''
    END;

    -- wrap auth.*() with (select auth.*())
    using_expr := r.using_expr;
    IF using_expr IS NOT NULL THEN
      using_expr := regexp_replace(using_expr, 'auth\.([a-z_]+)\(\)', '(select auth.\1())', 'g');
    END IF;
    with_expr := r.with_expr;
    IF with_expr IS NOT NULL THEN
      with_expr := regexp_replace(with_expr, 'auth\.([a-z_]+)\(\)', '(select auth.\1())', 'g');
    END IF;

    -- drop & recreate
    sql := format('DROP POLICY IF EXISTS %I ON %I.%I', r.polname, r.nspname, r.relname);
    EXECUTE sql;

    sql := format('CREATE POLICY %I ON %I.%I %s', r.polname, r.nspname, r.relname, for_clause);
    IF role_list IS NOT NULL AND btrim(role_list) <> '' THEN
      sql := sql || ' TO ' || role_list;
    END IF;
    IF using_expr IS NOT NULL THEN
      sql := sql || ' USING (' || using_expr || ')';
    END IF;
    IF with_expr IS NOT NULL THEN
      sql := sql || ' WITH CHECK (' || with_expr || ')';
    END IF;
    EXECUTE sql;
  END LOOP;

  -- Advisory note for cities multiple permissive policies (authenticated INSERT)
  RAISE NOTICE 'Advisor: Table public.cities has multiple permissive INSERT policies for authenticated. Consider merging them into a single policy to improve performance.';
END $$;
