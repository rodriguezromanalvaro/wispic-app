/*
  Report top queries using pg_stat_statements
  - Outputs normalized query text, calls, total/mean time, rows, and shared_blks_hit/read
*/
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
require('dotenv').config();
const { Client } = require('pg');

if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function maskHost(host) {
  if (!host) return '';
  if (host.length <= 4) return '****';
  return host.slice(0, 2) + '***' + host.slice(-2);
}

async function connectWithRetry(client, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      await client.connect();
      return;
    } catch (e) {
      lastErr = e;
      const transient = /EAI_AGAIN|ETIMEDOUT|ENOTFOUND|ECONNRESET|ECONNREFUSED/i.test(e.message || '');
      if (!transient || i === attempts) throw lastErr;
      const backoffMs = i * 2000;
      console.error(`Connect attempt ${i} failed: ${e.message}. Retrying in ${backoffMs}ms...`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error('Missing SUPABASE_DB_URL');

  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch (e) {
    throw new Error('SUPABASE_DB_URL is not a valid URL. Expected: postgresql://USER:PASSWORD@HOST:PORT/postgres?sslmode=require');
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error('SUPABASE_DB_URL must start with postgres:// or postgresql://');
  }
  if (/^(host|hostname|example|localhost)$/i.test(parsed.hostname)) {
    throw new Error('SUPABASE_DB_URL contains a placeholder/invalid HOST. Set the Session Pooler host from Supabase.');
  }

  console.error(`Connecting to ${maskHost(parsed.hostname)}:${parsed.port || '5432'}`);

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await connectWithRetry(client);
  try {
    const appOnly = (process.env.APP_ONLY === '1' || process.argv.includes('--app-only'));
    const limit = Number(process.env.REPORT_LIMIT || 25);

    // Build WHERE filters
    const filters = [
      `dbid = (SELECT oid FROM pg_database WHERE datname = current_database())`,
    ];
    if (appOnly) {
      // Exclude introspection/system/admin queries and internal extension calls
      filters.push(`NOT (
        -- PostgREST per-request config
        query ~* '^\\s*select\\s+set_config\\s*\\('
        OR query ~* '(^|\\s)(from|join)\\s+(pg_|information_schema)'
        OR query ~* '(^|\\s)(from|join)\\s+pg_catalog\.'
        OR query ~* '(^|\\s)(from|join)\\s+information_schema\.'
        OR query ~* '(^|\\s)select\\s+\\*\\s+from\\s+realtime\.'
        OR query ~* 'pg_available_extensions|pg_stat_|pg_get_|pg_relation_|pg_total_relation_|pg_create_logical_replication_slot|pg_temp\.'
        OR query ~* 'pgbouncer\.'
      )`);
    }

    const sql = `
      SELECT
        round(s.total_exec_time::numeric,2) AS total_ms,
        s.calls,
        round((s.total_exec_time/s.calls)::numeric,2) AS mean_ms,
        s.rows,
        s.shared_blks_hit,
        s.shared_blks_read,
        r.rolname as role,
        s.query
      FROM extensions.pg_stat_statements s
      LEFT JOIN pg_roles r ON r.oid = s.userid
      WHERE ${filters.join(' AND ')}
      ORDER BY s.total_exec_time DESC
      LIMIT $1;
    `;
    const res = await client.query(sql, [limit]);
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
