/*
  Run SQL files sequentially against SUPABASE_DB_URL
  - Intended for single-statement files (e.g., DO $$...$$;)
  - Usage: node scripts/run_sql_files.js <file1.sql> <file2.sql> ...
*/
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
require('dotenv').config();
const { Client } = require('pg');

if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node scripts/run_sql_files.js <file1.sql> <file2.sql> ...');
    process.exit(1);
  }

  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error('Missing SUPABASE_DB_URL env var.');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const f of files) {
      const abs = path.isAbsolute(f) ? f : path.join(process.cwd(), f);
      const sql = fs.readFileSync(abs, 'utf8');
      process.stdout.write(`\n-- Running ${f} ... `);
      await client.query(sql);
      console.log('OK');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
