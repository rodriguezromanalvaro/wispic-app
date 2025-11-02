// Writes a sanitized google-services.json from EAS env var ANDROID_GOOGLE_SERVICES_JSON
// Supported input formats (in this order):
// 1) File path (EAS "file" environment variable) [preferred]
// 2) Base64-encoded JSON
// 3) Plain JSON string
// The output is always strict JSON re-serialized with JSON.stringify to avoid malformed content.
// If the input cannot be parsed as JSON, we fail fast (exit 1) to avoid wasting Gradle time.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function isProbablyFilePath(val) {
  try {
    return typeof val === 'string' && fs.existsSync(val) && fs.statSync(val).isFile();
  } catch {
    return false;
  }
}

function maybeDecodeToJsonObject(input) {
  // 1) If input points to a file, read it
  if (isProbablyFilePath(input)) {
    const fileStr = fs.readFileSync(input, 'utf8');
    return { obj: JSON.parse(stripBom(fileStr)), mode: 'file' };
  }

  // 2) Try base64
  try {
    const dec = Buffer.from(input, 'base64').toString('utf8');
    return { obj: JSON.parse(stripBom(dec)), mode: 'base64' };
  } catch {}

  // 3) Plain JSON string
  return { obj: JSON.parse(stripBom(input)), mode: 'plain' };
}

function stripBom(str) {
  if (str.charCodeAt(0) === 0xFEFF) {
    return str.slice(1);
  }
  return str;
}

(async () => {
  // Always print a starting banner so it's obvious in EAS logs whether this script executed.
  console.log('[write-google-services] Start');
  // If a committed file already exists at android/app, prefer it and exit successfully.
  const committedPath = path.join(process.cwd(), 'android', 'app', 'google-services.json');
  if (fs.existsSync(committedPath)) {
    try {
      const raw = fs.readFileSync(committedPath, 'utf8');
      JSON.parse(stripBom(raw));
      const sha256 = crypto.createHash('sha256').update(stripBom(raw)).digest('hex').slice(0, 12);
      const size = Buffer.byteLength(raw, 'utf8');
      console.log(`[write-google-services] Found committed android/app/google-services.json; skipping generation (size=${size}B, sha256_prefix=${sha256}).`);
      process.exit(0);
    } catch (e) {
      console.error('[write-google-services] android/app/google-services.json exists but is invalid JSON:', e?.message || e);
      process.exit(1);
    }
  }

  const envVal = process.env.ANDROID_GOOGLE_SERVICES_JSON;
  const fallbackDevPath = path.join(process.cwd(), 'google-services.dev.json');
  if (!envVal) {
    // Fallback: if a dev copy is present in the repo, use it.
    if (fs.existsSync(fallbackDevPath)) {
      try {
        const raw = fs.readFileSync(fallbackDevPath, 'utf8');
        const obj = JSON.parse(stripBom(raw));
        const jsonStr = JSON.stringify(obj, null, 2) + '\n';
        const outRoot = path.join(process.cwd(), 'google-services.json');
        fs.writeFileSync(outRoot, jsonStr, { encoding: 'utf8' });

        const outAndroid = path.join(process.cwd(), 'android', 'app', 'google-services.json');
        try {
          fs.mkdirSync(path.dirname(outAndroid), { recursive: true });
          fs.writeFileSync(outAndroid, jsonStr, { encoding: 'utf8' });
        } catch {}

        const sha256 = crypto.createHash('sha256').update(jsonStr).digest('hex').slice(0, 12);
        const size = Buffer.byteLength(jsonStr, 'utf8');
        console.log(`[write-google-services] Wrote google-services.json from fallback file google-services.dev.json (size=${size}B, sha256_prefix=${sha256}).`);
        process.exit(0);
      } catch (e) {
        console.error('[write-google-services] Fallback google-services.dev.json exists but is invalid JSON:', e?.message || e);
        process.exit(1);
      }
    }

    const inCi = !!(process.env.EAS_BUILD || process.env.CI);
    const msg = '[write-google-services] No ANDROID_GOOGLE_SERVICES_JSON provided and no google-services.dev.json fallback found';
    if (inCi) {
      console.error(`${msg}; failing build because we are running in CI/EAS and no committed file found.`);
      console.error('Fix: (A) commit google-services.dev.json and/or android/app/google-services.json, or (B) add ANDROID_GOOGLE_SERVICES_JSON (file/base64/json).');
      process.exit(1);
    } else {
      console.log(`${msg}; skipping locally.`);
      process.exit(0);
    }
  }

  // Decode to an object and then re-serialize to ensure strict JSON
  try {
    const { obj, mode } = maybeDecodeToJsonObject(envVal);
    const jsonStr = JSON.stringify(obj, null, 2) + '\n';
    const outRoot = path.join(process.cwd(), 'google-services.json');
    fs.writeFileSync(outRoot, jsonStr, { encoding: 'utf8' });

    // Also copy into android/app/google-services.json for bare/bimodal builds
    const outAndroid = path.join(process.cwd(), 'android', 'app', 'google-services.json');
    try {
      fs.mkdirSync(path.dirname(outAndroid), { recursive: true });
      fs.writeFileSync(outAndroid, jsonStr, { encoding: 'utf8' });
    } catch {}

    const sha256 = crypto.createHash('sha256').update(jsonStr).digest('hex').slice(0, 12);
    const size = Buffer.byteLength(jsonStr, 'utf8');
    console.log(`[write-google-services] Wrote sanitized google-services.json (mode=${mode}, size=${size}B, sha256_prefix=${sha256}) @ ${outRoot} and android/app/google-services.json`);
    process.exit(0);
  } catch (e) {
    console.error('[write-google-services] ERROR: ANDROID_GOOGLE_SERVICES_JSON is not valid JSON or file could not be read:', e?.message || e);
    process.exit(1);
  }
})();
