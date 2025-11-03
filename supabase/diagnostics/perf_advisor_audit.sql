-- Perf Advisor Audit (public schema)
-- Purpose: surface common categories behind Supabase Performance Advisor warnings so we can fix them systematically.
-- How to run: paste in Supabase Studio > SQL Editor, or run via your VS Code Postgres connection.
-- Safe to run: read-only queries.

\echo '1) Unused indexes (idx_scan = 0)'
SELECT
  n.nspname     AS schema,
  t.relname     AS table_name,
  c.relname     AS index_name,
  pg_size_pretty(pg_relation_size(c.oid)) AS index_size,
  COALESCE(s.idx_scan,0) AS idx_scans
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = c.oid
WHERE n.nspname = 'public'
  AND COALESCE(s.idx_scan,0) = 0
  AND i.indisprimary = FALSE
  AND i.indisunique = FALSE
ORDER BY pg_relation_size(c.oid) DESC, 1,2;

\echo '2) Foreign keys without a supporting index on referencing columns'
WITH fk_cols AS (
  SELECT con.oid AS con_oid,
         n.nspname,
         cl.relname AS table_name,
         con.conname,
         ARRAY(
           SELECT att.attname
           FROM unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord)
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum
           ORDER BY u.ord
         ) AS fk_columns
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE con.contype = 'f' AND n.nspname = 'public'
), idx_cols AS (
  SELECT i.indrelid,
         i.indexrelid,
         ARRAY(
           SELECT a.attname
           FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
           ORDER BY k.ord
         ) AS cols
  FROM pg_index i
)
SELECT f.nspname AS schema,
       f.table_name,
       f.conname AS fk_name,
       f.fk_columns
FROM fk_cols f
LEFT JOIN idx_cols ic ON ic.indrelid = (SELECT oid FROM pg_class WHERE relname = f.table_name AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = f.nspname))
WHERE NOT EXISTS (
  SELECT 1 FROM idx_cols ic2
  WHERE ic2.indrelid = (SELECT oid FROM pg_class WHERE relname = f.table_name AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = f.nspname))
    AND ic2.cols[1:array_length(f.fk_columns,1)] = f.fk_columns -- leading columns match
)
ORDER BY 1,2,3;

\echo '3) Tables without a primary key'
SELECT n.nspname AS schema, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_index i ON i.indrelid = c.oid AND i.indisprimary
WHERE c.relkind = 'r' AND n.nspname = 'public' AND i.indexrelid IS NULL
ORDER BY 1,2;

\echo '4) Sequences not owned by any column (may indicate drift)'
SELECT n.nspname AS schema, c.relname AS sequence_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_depend d ON d.objid = c.oid AND d.deptype IN ('a','i')
WHERE c.relkind = 'S' AND n.nspname = 'public' AND d.objid IS NULL
ORDER BY 1,2;

\echo '5) Multiple permissive policies per table/action (RLS)'
SELECT n.nspname AS schema, c.relname AS table_name, p.polcmd AS action,
       COUNT(*) AS permissive_policies
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE p.polpermissive IS TRUE AND n.nspname = 'public'
GROUP BY 1,2,3
HAVING COUNT(*) > 1
ORDER BY 1,2,3;

\echo '6) Policies referencing auth.*() without (select auth.*()) wrapper (can cause initplans)'
SELECT n.nspname AS schema, c.relname AS table_name, p.polname, p.polcmd,
       pg_get_expr(p.polqual, p.polrelid)      AS using_expr,
       pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (
    (
      pg_get_expr(p.polqual, p.polrelid) ~* E'auth\\.[a-z_]+\\(\\)'
      AND pg_get_expr(p.polqual, p.polrelid) !~* E'\\(\\s*select\\s*\\(*\\s*auth\\.'
    )
    OR
    (
      pg_get_expr(p.polwithcheck, p.polrelid) ~* E'auth\\.[a-z_]+\\(\\)'
      AND pg_get_expr(p.polwithcheck, p.polrelid) !~* E'\\(\\s*select\\s*\\(*\\s*auth\\.'
    )
  )
ORDER BY 1,2,3;

\echo '7) Potentially redundant indexes (one index columns is a left-prefix of another on same table)'
WITH idx AS (
  SELECT
    n.nspname,
    t.relname AS table_name,
    i.relname AS index_name,
    i.oid     AS index_oid,
    (SELECT string_agg(pg_get_indexdef(i.oid, k, TRUE), ',')
     FROM generate_subscripts(ix.indkey,1) AS k
    ) AS columns,
    ix.indisunique AS is_unique
  FROM pg_class t
  JOIN pg_index ix ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
)
SELECT a.nspname AS schema, a.table_name, a.index_name AS potentially_redundant, b.index_name AS covered_by
FROM idx a
JOIN idx b ON a.table_name = b.table_name AND a.index_oid <> b.index_oid
WHERE b.columns LIKE a.columns || '%'
  AND a.is_unique = b.is_unique
ORDER BY 1,2,3;

\echo 'Done.'
