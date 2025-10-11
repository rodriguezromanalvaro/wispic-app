import fs from 'fs';
import path from 'path';

type JSONObject = { [key: string]: any };

function readJSON(file: string): JSONObject {
  const full = path.resolve(file);
  const txt = fs.readFileSync(full, 'utf8');
  return JSON.parse(txt);
}

function flatten(obj: JSONObject, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flatten(v as JSONObject, p));
    } else {
      keys.push(p);
    }
  }
  return keys;
}

function main() {
  const en = readJSON('i18n/en.json');
  const es = readJSON('i18n/es.json');

  const enKeys = new Set(flatten(en));
  const esKeys = new Set(flatten(es));

  const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));
  const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));

  if (missingInEs.length || missingInEn.length) {
    if (missingInEs.length) {
      console.error(`Missing in es.json (count=${missingInEs.length}):`);
      console.error(missingInEs.sort().join('\n'));
    }
    if (missingInEn.length) {
      console.error(`Missing in en.json (count=${missingInEn.length}):`);
      console.error(missingInEn.sort().join('\n'));
    }
    process.exit(1);
  }

  console.log('i18n key parity check: OK');
}

main();
