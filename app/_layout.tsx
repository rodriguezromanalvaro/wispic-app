// app/_layout.tsx
import 'react-native-get-random-values';
import { useEffect, useMemo } from 'react';

import { View } from 'react-native';

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TamaguiProvider } from 'tamagui';

import { useOwnerOnboarding } from 'features/owner/onboarding/state';
import PaywallModal from 'features/premium/ui/PaywallModal';
import 'lib/i18n';
import { registerPushTokenForUser } from 'lib/push';
import tamaguiConfig from 'lib/tamagui';
import { theme } from 'lib/theme';
import { ThemeProvider, useThemeMode } from 'lib/theme-context';
import { ToastProvider } from 'lib/toast';
import { AuthProvider, useAuth } from 'lib/useAuth';

const queryClient = new QueryClient();

function WithPushRegistration({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const resetOwnerOnboarding = useOwnerOnboarding((s) => s.reset);

  useEffect(() => {
    (async () => {
      if (user) {
        try {
          await registerPushTokenForUser(user.id);
        } catch {
          // Silencioso: puede fallar si el usuario no da permisos
        }
      }
    })();
    return () => { /* no-op */ };
  }, [user?.id]);

  // Clear owner onboarding state whenever the authenticated user changes (prevents cross-account leakage)
  useEffect(() => {
    resetOwnerOnboarding();
    return () => { /* no-op */ };
  }, [user?.id]);

  return <>{children}</>;
}

function InnerApp() {
  const { mode, theme: dynTheme } = useThemeMode();
  const id = useMemo(() => `InnerApp-${Math.random().toString(36).slice(2,8)}`,[/*once*/]);
  // Eliminados logs de mount/unmount InnerApp
  return (
    <View style={{ flex: 1, backgroundColor: dynTheme.colors.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Slot />
      <PaywallModal />
    </View>
  );
}

export default function RootLayout() {
  // Initialize Sentry after mount to avoid early module evaluation issues in dev
  useEffect(() => {
    (async () => {
      try {
  const { initSentry } = await import('sentry');
        await initSentry();
      } catch {}
    })();
  }, []);

  // Eliminado log de detección de Google Places key
  return (
    <TamaguiProvider config={tamaguiConfig as any} defaultTheme={theme.mode}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider initialMode={theme.mode}>
            <WithPushRegistration>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <ToastProvider>
                  <InnerApp />
                </ToastProvider>
              </GestureHandlerRootView>
            </WithPushRegistration>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </TamaguiProvider>
  );
}
