import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, Button } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../lib/useAuth';
import { supabase } from '../../../lib/supabase';
import { nearestCities, CityRow } from '../../../lib/location/geo';

export default function StepPostSave() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  async function maybeCaptureLocationOnce() {
    try {
      if (!user) return;
      const ExpoLocation = await import('expo-location');
      const perm = await ExpoLocation.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      // Fetch cities with lat/lng (fallback safe)
      const { data, error } = await supabase.from('cities').select('id,name,lat,lng').order('name');
      if (error || !data || !data.length) return;
      const list = (data as CityRow[]);
      const nearest = nearestCities(list, { lat: pos.coords.latitude, lng: pos.coords.longitude }, 1)[0];
      if (!nearest) return;
      await supabase.from('profiles').update({ city: nearest.name }).eq('id', user.id);
    } catch {
      // ignore
    }
  }

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant="auth" paddedTop={Math.max(insets.top, 60)}>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('postsave.title','¡Tu perfil está listo!')}</H1>
            <P style={styles.subtitle}>{t('postsave.subtitle','Puedes ir a la app o seguir personalizando con texto y preguntas opcionales.')}</P>
            <Card style={styles.card}>
              <View style={{ flexDirection:'row', gap:8 }}>
                <Button title={t('postsave.goApp','Ir a la app')} onPress={async () => { await maybeCaptureLocationOnce(); router.replace('/(tabs)' as any); }} />
                <Button title={t('postsave.keepImproving','Seguir con el perfil')} variant="ghost" onPress={() => router.replace('(auth)/complete/bio' as any)} />
              </View>
            </Card>
          </View>
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
});
