// app/_layout.tsx
import 'react-native-get-random-values';
import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../lib/useAuth';
import { theme } from '../lib/theme';
import { ThemeProvider, useThemeMode } from '../lib/theme-context';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import Constants from 'expo-constants';
import { registerPushTokenForUser } from '../lib/push';
import PaywallModal from '../components/PaywallModal';
import '../lib/i18n';
import { ToastProvider } from '../lib/toast';
import { TamaguiProvider } from '@tamagui/core';
import tamaguiConfig from '../tamagui.config';

const queryClient = new QueryClient();

function WithPushRegistration({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    let _mounted = true;
    (async () => {
      if (user) {
        try {
          await registerPushTokenForUser(user.id);
        } catch {
          // Silencioso: puede fallar si el usuario no da permisos
        }
      }
    })();
    return () => { _mounted = false; };
  }, [user?.id]);

  return <>{children}</>;
}

function InnerApp() {
  const { mode, theme: dynTheme } = useThemeMode();
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
        const { initSentry } = await import('../sentry');
        await initSentry();
      } catch {}
    })();
  }, []);

  // Debug: log if Google Places key is detected (boolean only, no key value)
  useEffect(() => {
    try {
      const hasPlacesKey = !!(Constants.expoConfig as any)?.extra?.placesApiKey;
      console.log(`[places] key detected: ${hasPlacesKey}`);
    } catch {}
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider initialMode={theme.mode}>
          <WithPushRegistration>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <TamaguiProvider config={tamaguiConfig} defaultTheme={theme.mode}>
                <ToastProvider>
                  <InnerApp />
                </ToastProvider>
              </TamaguiProvider>
            </GestureHandlerRootView>
          </WithPushRegistration>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
