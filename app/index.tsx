import { useEffect, useMemo, useState } from 'react';

import { ActivityIndicator, View } from 'react-native';

import { Redirect } from 'expo-router';

import { getOwnerState } from 'lib/hooks/useOwner';
import { supabase } from 'lib/supabase';
import { theme, applyPalette } from 'lib/theme';
import { useAuth } from 'lib/useAuth';

export default function IndexGate() {
  const { session, ready } = useAuth();
  const [to, setTo] = useState<
    '/(auth)/sign-in' | '/(auth)/complete-profile' | '/(tabs)/events' | '/(owner-onboarding)' | '/(owner)/home' | null
  >(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      if (!session?.user?.id) {
        applyPalette('magenta');
        setTo('/(auth)/sign-in');
        return;
      }

      // Rol de dueño: usar RPC primero; fallback al hook si falla
      try {
        const { data: os } = await supabase.rpc('owner_state');
        const row = Array.isArray(os) ? (os[0] as any) : null;
        if (row?.is_owner) {
          applyPalette('owner');
          setTo(row.needs_onboarding ? '/(owner-onboarding)' : '/(owner)/home');
          return;
        }
      } catch {}

      const owner = await getOwnerState(session.user);
      if (owner.isOwner) {
        applyPalette('owner');
        setTo(owner.needsOnboarding ? '/(owner-onboarding)' : '/(owner)/home');
        return;
      }

      // Si marcamos el usuario como "owner" en metadata durante el sign-up,
      if ((session.user as any)?.user_metadata?.owner === true) {
        applyPalette('owner');
        setTo('/(owner-onboarding)');
        return;
      }

      // Verificar perfil con pequeño retry para dar tiempo al trigger de creación
      let prof: any = null;
      for (let i = 0; i < 3; i++) {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, birthdate')
          .eq('id', session.user.id)
          .maybeSingle();
        prof = data;
        if (prof) break;
        await new Promise(r => setTimeout(r, 250));
      }

      if (!prof) {
        // Si sigue sin existir, no cerremos sesión aún; deja al usuario en complete-profile para crearlo vía app si hace falta
        applyPalette('magenta');
        setTo('/(auth)/complete-profile');
        return;
      }

      if (!prof.display_name || !prof.birthdate) {
        applyPalette('magenta');
        setTo('/(auth)/complete-profile');
        return;
      }

      applyPalette('magenta');
      setTo('/(tabs)/events');
    })();
  }, [ready, session?.user?.id]);

  if (!to) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return <Redirect href={to as any} />;
}
