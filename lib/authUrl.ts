export function parseHashParams(url: string): Record<string, string> {
  try {
    const hashIndex = url.indexOf('#');
    const frag = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
    const q = new URLSearchParams(frag);
    const out: Record<string, string> = {};
    q.forEach((v, k) => { out[k] = v; });
    return out;
  } catch {
    return {};
  }
}

export function extractTokens(url?: string | null): { access_token?: string; refresh_token?: string } {
  if (!url) return {};
  const p = parseHashParams(url);
  const access_token = p['access_token'];
  const refresh_token = p['refresh_token'];
  return { access_token, refresh_token };
}
