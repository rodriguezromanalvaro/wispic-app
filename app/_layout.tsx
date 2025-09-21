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
    return () => { mounted = false; };
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
            {/* 👇 NUEVO: montamos el modal global aquí */}
            <PaywallModal />
          </View>
        </WithPushRegistration>
      </AuthProvider>
    </QueryClientProvider>
  );
}
