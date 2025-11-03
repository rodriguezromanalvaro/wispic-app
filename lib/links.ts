import { Platform, Linking } from 'react-native';

// Lightweight reachability check with timeout. We prefer GET over HEAD to avoid proxies blocking HEAD.
async function isReachable(url: string, timeoutMs = 3500): Promise<boolean> {
  // For non-http(s) schemes, assume reachable (mailto:, tel:, etc.).
  if (!/^https?:\/\//i.test(url)) return true;
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal as any,
    });
    clearTimeout(to);
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

function withAlternateHost(url: string): string[] {
  if (!/^https?:\/\//i.test(url)) return [url];
  try {
    const u = new URL(url);
    const variants = [url];
    if (u.hostname === 'wispic.app') {
      const alt = new URL(u.toString());
      alt.hostname = 'www.wispic.app';
      variants.push(alt.toString());
    } else if (u.hostname === 'www.wispic.app') {
      const alt = new URL(u.toString());
      alt.hostname = 'wispic.app';
      variants.push(alt.toString());
    }
    return variants;
  } catch {
    return [url];
  }
}

export async function openExternal(url: string): Promise<void> {
  const candidates = withAlternateHost(url);
  // Try to find a reachable candidate quickly.
  let chosen: string | null = null;
  for (const candidate of candidates) {
    const ok = await isReachable(candidate);
    if (ok) { chosen = candidate; break; }
  }
  // If none reachable (offline or blocked), fall back to the first.
  const target = chosen || candidates[0];
  // On iOS/Android, use RN Linking. On web, just change location.
  if (Platform.OS === 'web') {
    try { (window as any).open(target, '_blank', 'noopener,noreferrer'); } catch {}
    return;
  }
  await Linking.openURL(target);
}

export default openExternal;
