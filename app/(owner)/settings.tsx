import { View, Text } from 'react-native';
import { theme } from '../../lib/theme';
import { Screen, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

export default function OwnerSettings() {
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    router.replace('/(auth)/sign-in' as any);
  };
  return (
    <Screen style={{ backgroundColor: theme.colors.bg }}>
      <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>Ajustes</Text>
      <Text style={{ color: theme.colors.subtext, marginTop: 8 }}>Preferencias y cuenta.</Text>
      <View style={{ marginTop: 16, width: '100%', maxWidth: 320 }}>
        <Button title="Cerrar sesión" onPress={logout} variant="outline" gradient={false} />
      </View>
    </Screen>
  );
}
