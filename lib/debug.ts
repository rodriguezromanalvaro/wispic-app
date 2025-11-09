// Lightweight debug logger – now silent by default.
// To re-enable targeted debug traces, set EXPO_PUBLIC_AVATAR_DEBUG=1 at runtime.

const AVATAR_DEBUG: boolean = (process.env?.EXPO_PUBLIC_AVATAR_DEBUG === '1');

export function debugLog(_tag: string, _payload?: any) {
  if (!AVATAR_DEBUG) return; // no-op when disabled
  try {
    const tag = _tag;
    const payload = _payload;
    if (payload === undefined) {
      // eslint-disable-next-line no-console
      console.log(`[debug:${tag}]`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[debug:${tag}]`, payload);
    }
  } catch {}
}

export function debugError(_tag: string, _error?: any) {
  if (!AVATAR_DEBUG) return; // no-op when disabled
  try {
    const tag = _tag;
    const error = _error;
    // eslint-disable-next-line no-console
    console.log(`[debug:${tag}:error]`, error?.message || error || '(no message)');
  } catch {}
}
