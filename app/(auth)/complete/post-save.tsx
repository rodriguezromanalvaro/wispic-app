import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from 'components/GlassCard';
import { CenterScaffold } from 'components/Scaffold';
import { YStack as TgYStack } from 'components/tg';
import { Screen, H1, P, Button } from 'components/ui';
import { nearestCities, CityRow } from 'lib/location/geo';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { useAuth } from 'lib/useAuth';

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
    // Save coordinates for global proximity (server-side)
    try { await supabase.rpc('set_profile_location', { p_user: user.id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_label: null, p_place_id: null, p_country_code: null }); } catch {}
      // Fetch cities with lat/lng (fallback safe)
      // Prefer server-side resolution to ensure city_id is set reliably
      try {
        const { data: ok, error: rpcErr } = await supabase.rpc('set_profile_city_by_coords', {
          p_user: user.id,
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
        });
        if (!rpcErr && ok === true) return; // success; no further client logic needed
      } catch {}
      const { data, error } = await supabase.from('cities').select('id,name,lat,lng').order('name');
      const lat = pos.coords.latitude; const lng = pos.coords.longitude;
      let updated = false;
      if (!error && Array.isArray(data) && data.length > 0) {
        const list = (data as CityRow[]);
        const nearest = nearestCities(list, { lat, lng }, 1)[0];
        if (nearest) {
          await supabase.from('profiles').update({ city: nearest.name, city_id: nearest.id }).eq('id', user.id);
          updated = true;
        }
      }
      if (!updated) {
        // Fallback: reverse geocode and try to resolve a city_id by name similarity and proximity
        try {
          const rev = await ExpoLocation.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          const first = Array.isArray(rev) ? rev[0] : undefined;
          const cityName = (first?.city || first?.subregion || first?.region || first?.district || '').trim();
          if (cityName) {
            const countryCode = (first as any)?.isoCountryCode || (first as any)?.countryCode || null;
            try { await supabase.rpc('set_profile_location', { p_user: user.id, p_lat: lat, p_lng: lng, p_label: cityName, p_place_id: null, p_country_code: countryCode }); } catch {}
            let picked: CityRow | null = null;
            const patterns = [cityName, `${cityName}%`, `%${cityName}%`];
            for (const pat of patterns) {
              const { data: byName } = await supabase
                .from('cities')
                .select('id,name,lat,lng')
                .ilike('name', pat)
                .limit(20);
              if (byName && byName.length) {
                const list = byName as CityRow[];
                const nearest = nearestCities(list, { lat, lng }, 1)[0];
                picked = nearest || list[0];
                break;
              }
            }
            if (picked) {
              await supabase.from('profiles').update({ city: picked.name, city_id: picked.id }).eq('id', user.id);
            } else {
              await supabase.from('profiles').update({ city: cityName }).eq('id', user.id);
            }
          }
        } catch {}
      }
    } catch {
      // ignore
    }
  }

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant="auth" paddedTop={Math.max(insets.top, 60)}>
          <TgYStack f={1} ai="center" jc="center" gap="$2">
            <H1 style={styles.title}>{t('postsave.title','¡Tu perfil está listo!')}</H1>
            <P style={styles.subtitle}>{t('postsave.subtitle','Puedes ir a la app o seguir personalizando con texto y preguntas opcionales.')}</P>
            <GlassCard padding={16} elevationLevel={1} style={styles.card}>
              <View style={{ flexDirection:'row', gap:8 }}>
                <Button title={t('postsave.goApp','Ir a la app')} onPress={async () => { await maybeCaptureLocationOnce(); router.replace('/(tabs)' as any); }} />
                <Button title={t('postsave.keepImproving','Seguir con el perfil')} variant="ghost" onPress={() => router.replace('(auth)/complete/bio' as any)} />
              </View>
            </GlassCard>
          </TgYStack>
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16 },
});
