import { Stack, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AuthLayout() {
  const router = useRouter();
  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/'); // vuelve al index que redirige a sign-in
  };

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
