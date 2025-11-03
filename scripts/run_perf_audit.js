/*
  Run Performance Audit
  - Reads SUPABASE_DB_URL from env (use Session Pooler URI with sslmode=require)
  - Executes the queries in supabase/diagnostics/perf_advisor_audit.sql
  - Prints compact JSON per section for easy sharing
*/

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
require('dotenv').config();
const { Client } = require('pg');
// Fallback to avoid self-signed certificate issues in Node TLS during audits
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error('Missing SUPABASE_DB_URL env var. Set it to your Session Pooler URI with sslmode=require');
    process.exit(1);
  }

  // Load SQL and strip psql-specific meta commands like \echo
  const sqlPath = path.join(process.cwd(), 'supabase', 'diagnostics', 'perf_advisor_audit.sql');
  const raw = fs.readFileSync(sqlPath, 'utf8');
  const cleaned = raw
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (t.startsWith('\\echo')) return false;
      if (t.startsWith('--')) return false;
      return true;
    })
    .join('\n');

  // Split by semicolons into individual statements (basic splitter)
  const statements = cleaned
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const sectionTitles = [
    'Unused indexes',
    'FKs without supporting index',
    'Tables without primary key',
    'Sequences without owner',
    'Multiple permissive policies (RLS)',
    'Policies with auth.*() without wrapper',
    'Potentially redundant indexes',
  ];

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const results = [];
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      // Run SELECT or CTE (WITH ...) statements; skip others just in case
      if (!/^\s*(select|with)/i.test(stmt)) continue;
      const res = await client.query(stmt);
      results.push({
        section: sectionTitles[i] || `Section ${i + 1}`,
        rowCount: res.rowCount,
        rows: res.rows,
      });
    }

    // Print compact summary per section
    for (const r of results) {
      console.log(`\n=== ${r.section} (rows: ${r.rowCount}) ===`);
      // Show up to 20 rows per section to keep output readable
      const sample = r.rows.slice(0, 20);
      console.log(JSON.stringify(sample, null, 2));
      if (r.rows.length > sample.length) {
        console.log(`... ${r.rows.length - sample.length} more rows omitted`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
