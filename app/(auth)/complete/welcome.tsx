import { KeyboardAvoidingView, Platform, StyleSheet, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, H1, P, Button } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function StepWelcome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant="auth" paddedTop={Math.max(insets.top, 60)}>
          <View style={[styles.progressWrap, { top: insets.top + 8 }] }>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(1/10)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 1, total: 10 })}</P>
          </View>
          <View style={styles.center}>
            <Image source={require('../../../assets/adaptive-icon-foreground.png')} style={styles.logo} resizeMode="contain" />
            <H1 style={styles.title}>{t('welcome.title','¡Te damos la bienvenida a Wispic!')}</H1>
            <P style={styles.subtitle}>{t('welcome.subtitle','Vamos a configurar tu perfil en unos pasos rápidos.')}</P>
            <P style={{ color: theme.colors.textDim, textAlign:'center', marginHorizontal: 12 }}>
              {t('welcome.body','Te pediremos algunos datos básicos y una foto para empezar.')}
            </P>
            <Button
              title={t('welcome.cta','¡Vamos!')}
              onPress={() => router.push('(auth)/complete/name' as any)}
              size="lg"
              style={{ marginTop: 16, minWidth: 260, alignSelf: 'stretch', marginHorizontal: 20 }}
            />
          </View>
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressWrap: { position: 'absolute', top: 16, left: 20, right: 20, gap: 6 },
  progressBg: { width: '100%', height: 6, backgroundColor: theme.colors.surface, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 999 },
  progressText: { color: theme.colors.textDim, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  logo: { width: 56, height: 56 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
});
