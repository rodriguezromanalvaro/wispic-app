// app/_layout.tsx
import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../lib/useAuth';
import { theme } from '../lib/theme';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useEffect } from 'react';
import { registerPushTokenForUser } from '../lib/push';
import PaywallModal from '../components/PaywallModal';

// 🔹 Sentry (usamos sentry-expo)
import * as Sentry from 'sentry-expo';

// ---- Sentry init (fuera de los componentes, para ejecutar 1 sola vez) ----
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  enableInExpoDevelopment: true, // captura también en dev
  debug: __DEV__,               // logs útiles en desarrollo
  tracesSampleRate: 1.0,        // performance (puedes bajar a 0.2 - 0.5 si quieres)
});

// Tag opcional para diferenciar entornos en Sentry
Sentry.Native.setTag?.('app_env', process.env.APP_ENV ?? 'development');
// ---------------------------------------------------------------------------

const queryClient = new QueryClient();

function WithPushRegistration({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (user) {
        try {
          await registerPushTokenForUser(user.id);
        } catch {
          // Silencioso: puede fallar si el usuario no da permisos
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WithPushRegistration>
          <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
            <StatusBar style="light" />
            <Slot />
            {/* Modal global Premium */}
            <PaywallModal />
          </View>
        </WithPushRegistration>
      </AuthProvider>
    </QueryClientProvider>
  );
}
