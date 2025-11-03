import React from 'react';

import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from 'components/GlassCard';
import { CenterScaffold } from 'components/Scaffold';
import { YStack as TgYStack } from 'components/tg';
import { Screen, H1, P, Switch, SelectionTile, StickyFooterActions } from 'components/ui';
import { useCompleteProfile } from 'features/profile/model';
import { getGenderOptions } from 'features/profile/model';
import { OnboardingHeader } from 'features/profile/ui/OnboardingHeader';
import { theme } from 'lib/theme';

export default function StepGender() {
  const { draft, setDraft } = useCompleteProfile();
  const [showGender, setShowGender] = React.useState<boolean>(draft.show_gender ?? true);
  const router = useRouter();
  const params = useLocalSearchParams();
  const returnTo = String((params as any)?.returnTo || '');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Use centralized options to keep codes consistent with Configure Profile and matching
  const tf = (k: string, def?: string) => t(k as any, def as any);
  const genders = getGenderOptions(tf);

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <OnboardingHeader step={4} total={10} />
          <TgYStack f={1} ai="center" jc="center" gap="$2">
            <H1 style={styles.title}>{t('complete.genderTitle','¿Con qué género te identificas?')}</H1>
            <P style={styles.subtitle}>{t('complete.genderSubtitle','Queremos mostrarte a las personas adecuadas.')}</P>

            <GlassCard padding={16} elevationLevel={1} style={styles.card}>
              <View style={{ gap: 10 }}>
                {genders.map((g) => {
                  const active = draft.gender === (g as any).code;
                  return (
                    <SelectionTile
                      key={(g as any).code}
                      active={active}
                      label={(g as any).label}
                      indicator="radio"
                      onPress={() => setDraft((d) => ({ ...d, gender: (g as any).code }))}
                    />
                  );
                })}
              </View>
              <View style={{ marginTop: 12, gap: 8 }}>
                <P style={{ color: theme.colors.textDim, fontSize:12 }}>{t('complete.genderShowQuestion','¿Quieres que se muestre el género en tu perfil?')}</P>
                <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <Switch value={showGender} onValueChange={(v)=> { setShowGender(v); setDraft(d=>({...d, show_gender:v})); }} />
                  <P style={{ fontSize:12, color: theme.colors.textDim }}>{showGender ? t('complete.genderVisible','Mostrar en mi perfil') : t('complete.genderHidden','Ocultar en mi perfil')}</P>
                </View>
              </View>
            </GlassCard>
          </TgYStack>
          <StickyFooterActions
            actions={[
              { title: t('common.continue'), onPress: () => {
                if (!draft?.gender) return; // guard extra
                if (returnTo === 'hub') {
                  router.replace('(tabs)/profile' as any);
                } else {
                  router.push('(auth)/complete/seeking' as any);
                }
              }, disabled: !draft?.gender },
              { title: t('common.back'), onPress: () => { if (returnTo === 'hub') router.replace('(tabs)/profile' as any); else router.push('(auth)/complete/birth' as any); }, variant: 'outline' },
            ]}
          />
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24 },
  // progress handled via OnboardingHeader
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16 },
});
