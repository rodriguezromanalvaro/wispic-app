import { View, ScrollView } from 'react-native';

import { router } from 'expo-router';

import { CenterScaffold } from 'components/Scaffold';
import { Screen, Button, P, Card } from 'components/ui';
import { OwnerBackground } from 'features/owner/ui/OwnerBackground';
import OwnerHero from 'features/owner/ui/OwnerHero';
import { supabase } from 'lib/supabase';
import { applyPalette } from 'lib/theme';


export default function OwnerSettings() {
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    applyPalette('magenta');
    router.replace('/(auth)/sign-in' as any);
  };
  return (
    <OwnerBackground>
      <Screen style={{ backgroundColor: 'transparent' }}>
        <CenterScaffold transparentBg variant="minimal">
          <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, gap: 12 }}>
            <OwnerHero title="Ajustes" subtitle="Preferencias y cuenta" />
            <Card variant="glass" gradientBorder>
              <P>Preferencias básicas próximamente.</P>
            </Card>
            <View style={{ marginTop: 4, width: '100%', maxWidth: 320 }}>
              <Button title="Cerrar sesión" onPress={logout} variant="outline" gradient={false} size="lg" style={{ width: '100%' }} />
            </View>
          </ScrollView>
        </CenterScaffold>
      </Screen>
    </OwnerBackground>
  );
}
