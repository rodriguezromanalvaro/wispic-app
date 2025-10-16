/*
  Backfill city coordinates (lat/lng) using OpenStreetMap Nominatim.
  Usage (PowerShell):
    $env:SUPABASE_URL="https://YOUR-PROJECT.supabase.co";
    $env:SUPABASE_SERVICE_ROLE_KEY="YOUR-SERVICE-ROLE";
    npx ts-node scripts/backfill-city-coords.ts
*/
/*
  Backfill city coordinates (lat/lng) using OpenStreetMap Nominatim.
  Usage (PowerShell):
    $env:SUPABASE_URL="https://YOUR-PROJECT.supabase.co";
    $env:SUPABASE_SERVICE_ROLE_KEY="YOUR-SERVICE-ROLE";
    npx ts-node scripts/backfill-city-coords.ts

  Notes:
    - Requires service role key because cities updates are admin-only under RLS.
    - Respects Nominatim usage: add a User-Agent and throttle requests.
    - Safe to run multiple times; only updates rows with missing lat/lng.
*/

import 'cross-fetch/dist/node-polyfill.js';
import { createClient } from '@supabase/supabase-js';

// Load local .env if present (optional)
import 'dotenv/config';
const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

// Basic sanity checks and health probe to help diagnose misconfiguration
function sanitizeUrl(u: string) {
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.host}`;
  } catch {
    return u;
  }
}

function looksLikeJwt(k: string) {
  return typeof k === 'string' && k.split('.').length === 3;
}

async function checkHealth() {
  const base = sanitizeUrl(SUPABASE_URL);
  console.log(`Using SUPABASE_URL = ${base}`);
  const maskedKey = SERVICE_ROLE ? `${SERVICE_ROLE.slice(0, 6)}... (len=${SERVICE_ROLE.length})` : 'missing';
  console.log(`Service role key looks like JWT: ${looksLikeJwt(SERVICE_ROLE)} (${maskedKey})`);
  try {
    const res = await fetch(`${base}/auth/v1/health`);
    console.log(`Auth health: ${res.status}`);
  } catch (e: any) {
    console.error('Cannot reach Supabase URL (auth health). Check SUPABASE_URL and network/proxy.', e?.message || e);
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

type City = { id: number; name: string; country: string | null; lat: number | null; lng: number | null };

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isBadCountry(c?: string | null) {
  return !c || c.trim() === '' || /^unknown$/i.test(c.trim());
}

async function geocode(city: string, country?: string | null) {
  const query = isBadCountry(country) ? city : `${city}, ${country}`;
  const q = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'wispic-app/geo-backfill (contact: ops@wispic.local)' },
  });
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);
  const json: any[] = await res.json();
  if (!json.length) return null;
  const { lat, lon } = json[0];
  return { lat: parseFloat(lat), lng: parseFloat(lon) };
}

async function run() {
  await checkHealth();
  console.log('Fetching cities with missing lat/lng…');
  const { data, error } = await supabase
    .from('cities')
    .select('id,name,country,lat,lng')
    .or('lat.is.null,lng.is.null')
    .order('name')
    .limit(500);
  if (error) throw error;
  const cities = (data || []) as City[];
  console.log(`Found ${cities.length} cities to backfill.`);

  for (const c of cities) {
    try {
      console.log(`Geocoding ${c.name}, ${c.country ?? '—'}…`);
      let g = await geocode(c.name, c.country);
      // Fallback extra: si sin país no hay resultado y sabemos que trabajamos con España, intenta con España explícito
      if (!g && isBadCountry(c.country)) {
        g = await geocode(c.name, 'España');
      }
      if (!g) {
        console.warn(`No result for ${c.name}, ${c.country}`);
        await sleep(1200); // be nice to OSM
        continue;
      }
      const { error: upErr } = await supabase
        .from('cities')
        .update({ lat: g.lat, lng: g.lng })
        .eq('id', c.id);
      if (upErr) throw upErr;
      console.log(`Updated ${c.name}: ${g.lat}, ${g.lng}`);
      await sleep(1200); // throttle per Nominatim policy (~1 req/sec)
    } catch (e: any) {
      console.error('Failed for city', c, e.message || e);
    }
  }
  console.log('Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
