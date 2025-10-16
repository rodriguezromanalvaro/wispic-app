import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { getOwnerState } from '../lib/hooks/useOwner';

export default function IndexGate() {
  const [to, setTo] = useState<
    '/(auth)/sign-in' | '/(auth)/complete-profile' | '/(tabs)/events' | '/(owner-onboarding)' | '/(owner)/home' | null
  >(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setTo('/(auth)/sign-in');
        return;
      }

      // Rol de dueño: usar RPC primero; fallback al hook si falla
      try {
        const { data: os } = await supabase.rpc('owner_state');
        const row = Array.isArray(os) ? os[0] as any : null;
        if (row?.is_owner) {
          setTo(row.needs_onboarding ? '/(owner-onboarding)' : '/(owner)/home');
          return;
        }
      } catch {}

      const owner = await getOwnerState(session.user);
      if (owner.isOwner) {
        setTo(owner.needsOnboarding ? '/(owner-onboarding)' : '/(owner)/home');
        return;
      }

      // Verificar si el perfil existe (solo para usuarios finales)
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, display_name, birthdate')
        .eq('id', session.user.id)
        .maybeSingle();
        
      // Si el perfil no existe en absoluto, cerrar sesión y volver a sign-in
      if (!prof) {
        await supabase.auth.signOut();
        setTo('/(auth)/sign-in');
        return;
      }

      // Si existe pero faltan datos obligatorios, ir a completar el perfil (solo usuarios finales)
      if (!prof.display_name || !prof.birthdate) {
        setTo('/(auth)/complete-profile');
        return;
      }

      // Usuario final (por defecto)
      setTo('/(tabs)/events');
    })();
  }, []);

  if (!to) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return <Redirect href={to as any} />;
}
