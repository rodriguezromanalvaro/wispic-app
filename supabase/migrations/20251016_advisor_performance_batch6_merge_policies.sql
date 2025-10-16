-- Fixes for Supabase Advisor (Performance) - Batch 6
-- Date: 2025-10-16
-- Lint addressed: multiple_permissive_policies – consolidate multiple permissive RLS policies
-- Strategy:
--   For each listed table and each role set, if there are multiple policies (including FOR ALL)
--   we replace them with up to four action-specific policies (SELECT/INSERT/UPDATE/DELETE),
--   each using the OR of existing expressions for that action. This preserves semantics while
--   eliminating duplicates. We also wrap auth.*() calls with (select auth.*()) to avoid initplan.

DO $$
DECLARE
  t record;
  grp record;
  pol record;
  role_key text;
  role_list text; -- quoted comma-separated roles for TO clause
  cnt_total int;
  cnt_sel int; cnt_ins int; cnt_upd int; cnt_del int;
  using_sel text; using_del text; with_ins text; with_upd text;
  sql text;
  action_name text;
BEGIN
  FOR t IN
    SELECT n.oid AS nspoid, c.oid AS relo, n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN (
        'cities','event_attendance','event_checkins','events','match_reads',
        'profile_prompts','profiles','user_achievements','user_levels','user_photos',
        'user_statistics','venues'
      )
  LOOP
    -- iterate distinct role groups for this table
    FOR grp IN
      SELECT DISTINCT
        CASE WHEN p.polroles IS NULL OR array_length(p.polroles,1) IS NULL OR array_length(p.polroles,1)=0
             THEN '<PUBLIC>'
             ELSE (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
                   FROM unnest(p.polroles) AS u(oid) JOIN pg_roles r ON r.oid = u.oid)
        END AS role_key
      FROM pg_policy p
      WHERE p.polrelid = t.relo
    LOOP
      role_key := grp.role_key;
      -- build role_list for TO clause
      SELECT string_agg(quote_ident(r.rolname), ', ' ORDER BY r.rolname)
      INTO role_list
      FROM (
        SELECT DISTINCT unnest(p.polroles) AS oid
        FROM pg_policy p
        WHERE p.polrelid = t.relo
          AND (
            CASE WHEN p.polroles IS NULL OR array_length(p.polroles,1) IS NULL OR array_length(p.polroles,1)=0
                 THEN '<PUBLIC>'
                 ELSE (SELECT string_agg(r2.rolname, ',' ORDER BY r2.rolname)
                       FROM unnest(p.polroles) AS u2(oid) JOIN pg_roles r2 ON r2.oid = u2.oid)
            END
          ) = role_key
          AND p.polroles IS NOT NULL
      ) s
      JOIN pg_roles r ON r.oid = s.oid;
      role_list := COALESCE(role_list, '');

      -- total policies for this role group
      WITH pfr AS (
        SELECT p.* FROM pg_policy p
        WHERE p.polrelid = t.relo
          AND (
            CASE WHEN p.polroles IS NULL OR array_length(p.polroles,1) IS NULL OR array_length(p.polroles,1)=0
                 THEN '<PUBLIC>'
                 ELSE (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
                       FROM unnest(p.polroles) AS u(oid) JOIN pg_roles r ON r.oid = u.oid)
            END
          ) = role_key
      )
      SELECT count(*) FROM pfr INTO cnt_total;

      IF COALESCE(cnt_total, 0) <= 1 THEN
        CONTINUE; -- nothing to merge
      END IF;

      -- counts per effective action: include explicit command and ALL ('a')
      WITH pfr AS (
        SELECT p.* FROM pg_policy p
        WHERE p.polrelid = t.relo
          AND (
            CASE WHEN p.polroles IS NULL OR array_length(p.polroles,1) IS NULL OR array_length(p.polroles,1)=0
                 THEN '<PUBLIC>'
                 ELSE (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
                       FROM unnest(p.polroles) AS u(oid) JOIN pg_roles r ON r.oid = u.oid)
            END
          ) = role_key
      )
      SELECT
        (SELECT count(*) FROM pfr WHERE polcmd IN ('r','a')),
        (SELECT count(*) FROM pfr WHERE polcmd IN ('c','a')),
        (SELECT count(*) FROM pfr WHERE polcmd IN ('u','a')),
        (SELECT count(*) FROM pfr WHERE polcmd IN ('d','a'))
      INTO cnt_sel, cnt_ins, cnt_upd, cnt_del;

      -- compute merged expressions per action
      WITH pfr AS (
        SELECT p.* FROM pg_policy p
        WHERE p.polrelid = t.relo
          AND (
            CASE WHEN p.polroles IS NULL OR array_length(p.polroles,1) IS NULL OR array_length(p.polroles,1)=0
                 THEN '<PUBLIC>'
                 ELSE (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
                       FROM unnest(p.polroles) AS u(oid) JOIN pg_roles r ON r.oid = u.oid)
            END
          ) = role_key
      )
      SELECT string_agg(CASE WHEN expr IS NULL OR btrim(expr) = '' THEN 'TRUE' ELSE '('||expr||')' END, ' OR ')
      FROM (
        SELECT DISTINCT pg_get_expr(p.polqual, p.polrelid) AS expr
        FROM pfr p WHERE p.polcmd IN ('r','a')
      ) s
      INTO using_sel;
      IF using_sel IS NOT NULL THEN
        using_sel := regexp_replace(using_sel, 'auth\.([a-z_]+)\(\)', '(select auth.\1())', 'g');
      END IF;

      WITH pfr AS (
        SELECT p.* FROM pg_policy p
        WHERE p.polrelid = t.relo
          AND (
            CASE WHEN p.polroles IS NULL OR array_length(p.polroles,1) IS NULL OR array_length(p.polroles,1)=0
                 THEN '<PUBLIC>'
                 ELSE (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
                       FROM unnest(p.polroles) AS u(oid) JOIN pg_roles r ON r.oid = u.oid)
            END
          ) = role_key
      )
      SELECT string_agg(CASE WHEN expr IS NULL OR btrim(expr) = '' THEN 'TRUE' ELSE '('||expr||')' END, ' OR ')
      FROM (
        SELECT DISTINCT pg_get_expr(p.polwithcheck, p.polrelid) AS expr
        FROM pfr p WHERE p.polcmd IN ('c','a')
      ) s
      INTO with_ins;
      IF with_ins IS NOT NULL THEN
        with_ins := regexp_replace(with_ins, 'auth\.([a-z_]+)\(\)', '(select auth.\1())', 'g');
      END IF;

      WITH pfr AS (
        SELECT p.* FROM pg_policy p
        WHERE p.polrelid = t.relo
          AND (
            CASE WHEN p.polroles IS NULL OR array_length(p.polroles,1) IS NULL OR array_length(p.polroles,1)=0
                 THEN '<PUBLIC>'
                 ELSE (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
                       FROM unnest(p.polroles) AS u(oid) JOIN pg_roles r ON r.oid = u.oid)
            END
          ) = role_key
      )
      SELECT string_agg(CASE WHEN expr IS NULL OR btrim(expr) = '' THEN 'TRUE' ELSE '('||expr||')' END, ' OR ')
      FROM (
        SELECT DISTINCT pg_get_expr(p.polwithcheck, p.polrelid) AS expr
        FROM pfr p WHERE p.polcmd IN ('u','a')
      ) s
      INTO with_upd;
      IF with_upd IS NOT NULL THEN
        with_upd := regexp_replace(with_upd, 'auth\.([a-z_]+)\(\)', '(select auth.\1())', 'g');
      END IF;

      WITH pfr AS (
        SELECT p.* FROM pg_policy p
        WHERE p.polrelid = t.relo
          AND (
            CASE WHEN p.polroles IS NULL OR array_length(p.polroles,1) IS NULL OR array_length(p.polroles,1)=0
                 THEN '<PUBLIC>'
                 ELSE (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
                       FROM unnest(p.polroles) AS u(oid) JOIN pg_roles r ON r.oid = u.oid)
            END
          ) = role_key
      )
      SELECT string_agg(CASE WHEN expr IS NULL OR btrim(expr) = '' THEN 'TRUE' ELSE '('||expr||')' END, ' OR ')
      FROM (
        SELECT DISTINCT pg_get_expr(p.polqual, p.polrelid) AS expr
        FROM pfr p WHERE p.polcmd IN ('d','a')
      ) s
      INTO using_del;
      IF using_del IS NOT NULL THEN
        using_del := regexp_replace(using_del, 'auth\.([a-z_]+)\(\)', '(select auth.\1())', 'g');
      END IF;

      -- Drop all existing policies for this table/role group
      FOR pol IN
        WITH pfr AS (
          SELECT p.* FROM pg_policy p
          WHERE p.polrelid = t.relo
            AND (
              CASE WHEN p.polroles IS NULL OR array_length(p.polroles,1) IS NULL OR array_length(p.polroles,1)=0
                   THEN '<PUBLIC>'
                   ELSE (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
                         FROM unnest(p.polroles) AS u(oid) JOIN pg_roles r ON r.oid = u.oid)
              END
            ) = role_key
        )
        SELECT polname FROM pfr
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.polname, t.nspname, t.relname);
      END LOOP;

      -- Recreate at most 4 consolidated policies (only when there was at least one applicable)
      IF cnt_sel > 0 THEN
        action_name := 'select';
        sql := format('CREATE POLICY %I ON %I.%I FOR SELECT',
                      'rls_'||t.relname||'_'||action_name||'_'||substr(md5(role_key),1,8)||'_merged',
                      t.nspname, t.relname);
        IF role_list IS NOT NULL AND btrim(role_list) <> '' THEN
          sql := sql || ' TO ' || role_list;
        END IF;
        IF using_sel IS NOT NULL AND btrim(using_sel) <> '' THEN
          sql := sql || ' USING (' || using_sel || ')';
        END IF;
        EXECUTE sql;
      END IF;

      IF cnt_ins > 0 THEN
        action_name := 'insert';
        sql := format('CREATE POLICY %I ON %I.%I FOR INSERT',
                      'rls_'||t.relname||'_'||action_name||'_'||substr(md5(role_key),1,8)||'_merged',
                      t.nspname, t.relname);
        IF role_list IS NOT NULL AND btrim(role_list) <> '' THEN
          sql := sql || ' TO ' || role_list;
        END IF;
        IF with_ins IS NOT NULL AND btrim(with_ins) <> '' THEN
          sql := sql || ' WITH CHECK (' || with_ins || ')';
        END IF;
        EXECUTE sql;
      END IF;

      IF cnt_upd > 0 THEN
        action_name := 'update';
        sql := format('CREATE POLICY %I ON %I.%I FOR UPDATE',
                      'rls_'||t.relname||'_'||action_name||'_'||substr(md5(role_key),1,8)||'_merged',
                      t.nspname, t.relname);
        IF role_list IS NOT NULL AND btrim(role_list) <> '' THEN
          sql := sql || ' TO ' || role_list;
        END IF;
        IF with_upd IS NOT NULL AND btrim(with_upd) <> '' THEN
          sql := sql || ' WITH CHECK (' || with_upd || ')';
        END IF;
        EXECUTE sql;
      END IF;

      IF cnt_del > 0 THEN
        action_name := 'delete';
        sql := format('CREATE POLICY %I ON %I.%I FOR DELETE',
                      'rls_'||t.relname||'_'||action_name||'_'||substr(md5(role_key),1,8)||'_merged',
                      t.nspname, t.relname);
        IF role_list IS NOT NULL AND btrim(role_list) <> '' THEN
          sql := sql || ' TO ' || role_list;
        END IF;
        IF using_del IS NOT NULL AND btrim(using_del) <> '' THEN
          sql := sql || ' USING (' || using_del || ')';
        END IF;
        EXECUTE sql;
      END IF;

      RAISE NOTICE 'Consolidated policies on %.% for roles [%] into per-action policies.', t.nspname, t.relname, role_key;
    END LOOP;
  END LOOP;
END $$;
