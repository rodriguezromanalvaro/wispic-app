import { useCallback } from 'react';

import { KeyboardAvoidingView, Platform, StyleSheet, Image, BackHandler } from 'react-native';

import { useRouter, useFocusEffect } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CenterScaffold } from 'components/Scaffold';
import { YStack as TgYStack } from 'components/tg';
import { Screen, H1, P, Button } from 'components/ui';
import { OnboardingHeader } from 'features/profile/ui/OnboardingHeader';
import { theme } from 'lib/theme';

export default function StepWelcome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  // Android back button on step 1: only forward allowed -> block back
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const onBackPress = () => {
        // Consume and do nothing to keep users moving forward
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [router])
  );

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant="auth" paddedTop={Math.max(insets.top, 60)}>
          <OnboardingHeader step={1} total={10} />
          <TgYStack f={1} ai="center" jc="center" gap="$2">
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
            {/* Cancel removed: only forward navigation allowed */}
          </TgYStack>
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // progress handled via OnboardingHeader
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  logo: { width: 56, height: 56 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
});
