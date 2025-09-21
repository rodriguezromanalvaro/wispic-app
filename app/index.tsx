import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';

export default function IndexGate() {
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setTo('/(auth)/sign-in');
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!prof?.display_name) {
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
