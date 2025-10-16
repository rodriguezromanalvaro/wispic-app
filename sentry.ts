export async function initSentry() {
  try {
    // Avoid initializing Sentry in dev to prevent noisy logs and metro quirks
    if (typeof __DEV__ !== 'undefined' && __DEV__) return;
    const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? undefined;
    if (!dsn) return;
    const Sentry = await import('sentry-expo');
    Sentry.init({
      dsn,
      enableInExpoDevelopment: false,
      debug: false,
      tracesSampleRate: 0.1,
    });
  } catch (e) {
    // Silently ignore init errors in dev
  }
}

export default {} as any;
