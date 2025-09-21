import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AuthLayout() {
  const router = useRouter();
  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/'); // vuelve al index que redirige a sign-in
  };

  return (
    <Stack
      screenOptions={{
        headerRight: () => (
          <Pressable onPress={signOut} style={{ paddingRight: 16 }}>
            <Text>Salir</Text>
          </Pressable>
        ),
      }}
    />
  );
}
