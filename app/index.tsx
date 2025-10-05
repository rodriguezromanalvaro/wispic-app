import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';

export default function IndexGate() {
  const [to, setTo] = useState<'/(auth)/sign-in' | '/(auth)/complete-profile' | '/(tabs)/events' | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setTo('/(auth)/sign-in');
        return;
      }

      // Verificar si el perfil existe
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

      // Si existe pero faltan datos obligatorios, ir a completar el perfil
      if (!prof.display_name || !prof.birthdate) {
        setTo('/(auth)/complete-profile');
      } else {
        setTo('/(tabs)/events');
      }
    })();
  }, []);

  if (!to) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return <Redirect href={to} />;
}
