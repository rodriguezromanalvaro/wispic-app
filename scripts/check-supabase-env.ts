/*
  Quick environment verifier for Supabase variables.
  - Loads .env (dotenv)
  - Prints sanitized values presence and shape
  - Calls /auth/v1/health on SUPABASE_URL

  Usage (PowerShell):
    npx ts-node scripts/check-supabase-env.ts
    # or
    npm run env:check
*/

import 'dotenv/config';
import 'cross-fetch/dist/node-polyfill.js';

function sanitizeUrl(u?: string) {
  if (!u) return 'missing';
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.host}`;
  } catch {
    return u;
  }
}

function looksLikeJwt(k?: string | null) {
  return !!(k && k.split('.').length === 3);
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const EXPO_PUBLIC_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const EXPO_PUBLIC_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  console.log('--- Supabase env check ---');
  console.log('SUPABASE_URL                =', sanitizeUrl(SUPABASE_URL));
  console.log('SUPABASE_SERVICE_ROLE_KEY   = present?', !!SERVICE_ROLE, ' JWT?', looksLikeJwt(SERVICE_ROLE));
  console.log('EXPO_PUBLIC_SUPABASE_URL    =', sanitizeUrl(EXPO_PUBLIC_URL));
  console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY = present?', !!EXPO_PUBLIC_ANON, ' JWT?', looksLikeJwt(EXPO_PUBLIC_ANON));

  if (SUPABASE_URL) {
    const base = sanitizeUrl(SUPABASE_URL);
    try {
      const res = await fetch(`${base}/auth/v1/health`);
      console.log('Auth health status          =', res.status);
    } catch (e: any) {
      console.error('Auth health failed          =', e?.message || e);
    }
  }

  // Basic conclusions
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.warn('\nWarning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.');
  }
  if (!EXPO_PUBLIC_URL || !EXPO_PUBLIC_ANON) {
    console.warn('Warning: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY missing for the mobile app.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
