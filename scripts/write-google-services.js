// Writes google-services.json from EAS env var ANDROID_GOOGLE_SERVICES_JSON (base64 or plain JSON)
// Usage: node scripts/write-google-services.js
const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function maybeDecode(input) {
  try {
    // Try base64
    const dec = Buffer.from(input, 'base64').toString('utf8');
    JSON.parse(dec);
    return dec;
  } catch {
    return input; // assume plain JSON
  }
}

(async () => {
  const envVal = process.env.ANDROID_GOOGLE_SERVICES_JSON;
  if (!envVal) {
    console.log('[write-google-services] No ANDROID_GOOGLE_SERVICES_JSON provided; skipping.');
    process.exit(0);
  }
  const jsonStr = maybeDecode(envVal);
  try {
    JSON.parse(jsonStr);
  } catch (e) {
    console.error('[write-google-services] Provided value is not valid JSON/base64 JSON');
    process.exit(1);
  }
  const out = path.join(process.cwd(), 'google-services.json');
  fs.writeFileSync(out, jsonStr);
  console.log('[write-google-services] Wrote google-services.json');
})();
