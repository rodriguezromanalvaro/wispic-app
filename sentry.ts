import * as Sentry from 'sentry-expo';

// Initialize Sentry as early as possible
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? undefined,
  enableInExpoDevelopment: true,
  debug: false,
  tracesSampleRate: 0.1,
});

export default Sentry;
