// Minimal auth debug helpers that never print secrets
// Only active in development builds (no-ops in production)

const TOKEN_KEYS = [
  'code',
  'access_token',
  'refresh_token',
  'provider_token',
  'token',
  'auth_token',
];

export function sanitizeUrl(url?: string | null): string {
  if (!url) return '';
  let out = url;
  for (const k of TOKEN_KEYS) {
    const re = new RegExp(`(${k})=([^&#]+)`, 'gi');
    out = out.replace(re, `$1=***`);
  }
  return out;
}

// Disable all auth logs (no-ops). We keep the functions to avoid touching callers.
export function authLog(..._args: any[]) { /* no-op */ }

export function authLogUrl(_label: string, _url?: string | null) { /* no-op */ }

export async function waitForSession(maxMs = 2000, stepMs = 150): Promise<boolean> {
  try {
    const { supabase } = await import('./supabase');
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) {
        authLog('waitForSession -> OK', data.session.user.id);
        return true;
      }
      await new Promise(r => setTimeout(r, stepMs));
    }
  } catch (e) {
    authLog('waitForSession ERROR', (e as any)?.message || String(e));
  }
  authLog('waitForSession -> TIMEOUT');
  return false;
}
