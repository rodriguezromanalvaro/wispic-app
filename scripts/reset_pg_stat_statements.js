/*
  Reset pg_stat_statements safely. Requires CONFIRM_RESET=YES and SUPABASE_DB_URL.
  Usage:
    - PowerShell: $env:CONFIRM_RESET='YES'; node scripts/reset_pg_stat_statements.js
*/
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
require('dotenv').config();
const { Client } = require('pg');

if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

(async () => {
  if (process.env.CONFIRM_RESET !== 'YES') {
    console.error('Refusing to reset: set CONFIRM_RESET=YES to proceed.');
    process.exit(2);
  }
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error('Missing SUPABASE_DB_URL');
    process.exit(1);
  }
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('SELECT extensions.pg_stat_statements_reset();');
    console.log('pg_stat_statements reset OK');
  } finally {
    await client.end();
  }
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
