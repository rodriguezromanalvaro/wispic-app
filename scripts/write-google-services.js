// Writes google-services.json from EAS env var ANDROID_GOOGLE_SERVICES_JSON
// Supported formats:
// - File path (EAS "file" environment variable)
// - Base64-encoded JSON
// - Plain JSON string
// Usage: node scripts/write-google-services.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function isProbablyFilePath(val) {
  try {
    return typeof val === 'string' && fs.existsSync(val) && fs.statSync(val).isFile();
  } catch {
    return false;
  }
}

function maybeDecodeToJsonString(input) {
  // 1) If input points to a file, read it
  if (isProbablyFilePath(input)) {
    const fileStr = fs.readFileSync(input, 'utf8');
    return { jsonStr: fileStr, mode: 'file' };
  }

  // 2) Try base64
  try {
    const dec = Buffer.from(input, 'base64').toString('utf8');
    JSON.parse(dec);
    return { jsonStr: dec, mode: 'base64' };
  } catch {}

  // 3) Assume plain JSON string
  return { jsonStr: input, mode: 'plain' };
}

(async () => {
  const envVal = process.env.ANDROID_GOOGLE_SERVICES_JSON;
  if (!envVal) {
    console.log('[write-google-services] No ANDROID_GOOGLE_SERVICES_JSON provided; skipping.');
    process.exit(0);
  }

  const { jsonStr, mode } = maybeDecodeToJsonString(envVal);
  try {
    JSON.parse(jsonStr);
  } catch (e) {
    console.error('[write-google-services] Provided value is not valid (file/plain/base64 JSON)');
    process.exit(1);
  }

  const out = path.join(process.cwd(), 'google-services.json');
  fs.writeFileSync(out, jsonStr);

  // Safe diagnostics (no secrets):
  const sha256 = crypto.createHash('sha256').update(jsonStr).digest('hex').slice(0, 12);
  const size = Buffer.byteLength(jsonStr, 'utf8');
  console.log(
    `[write-google-services] Wrote google-services.json (mode=${mode}, size=${size}B, sha256_prefix=${sha256}) @ ${out}`
  );
})();
