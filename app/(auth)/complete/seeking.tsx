import { useState } from 'react';

import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from 'components/GlassCard';
import { CenterScaffold } from 'components/Scaffold';
import { YStack as TgYStack } from 'components/tg';
import { Screen, H1, P, Switch, SelectionTile, StickyFooterActions } from 'components/ui';
import { useCompleteProfile } from 'features/profile/model';
import { OnboardingHeader } from 'features/profile/ui/OnboardingHeader';
import { theme } from 'lib/theme';

const OPTIONS: { key: 'dating' | 'friends' | 'everything' | 'notSure'; icon: string }[] = [
  { key: 'dating', icon: '❤️' },
  { key: 'friends', icon: '🤝' },
  { key: 'everything', icon: '✨' },
  { key: 'notSure', icon: '🤔' },
];

export default function StepSeeking() {
  const { draft, setDraft } = useCompleteProfile();
  const router = useRouter();
  const params = useLocalSearchParams();
  const returnTo = String((params as any)?.returnTo || '');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Single selection: store locally as a string; persist as an array with one item for compatibility
  const [selected, setSelected] = useState<string | null>(Array.isArray(draft.seeking) && draft.seeking.length ? draft.seeking[0] : null);
  const [visible, setVisible] = useState<boolean>(draft.show_seeking ?? true);
  const selectOne = (k: string) => setSelected(cur => (cur === k ? null : k));
  const canContinue = !!selected;

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <OnboardingHeader step={5} total={10} />
          <TgYStack f={1} ai="center" jc="center" gap="$2">
            <H1 style={styles.title}>{t('complete.seekingTitle','¿Qué buscas aquí?')}</H1>
            <P style={styles.subtitle}>{t('complete.seekingHint','Esto ayuda a mostrarte mejores coincidencias')}</P>
            <GlassCard padding={16} elevationLevel={1} style={styles.card}>
              <View style={{ gap: 10 }}>
                {OPTIONS.map(o => {
                  const active = selected === o.key;
                  const label = `${o.icon} ${t(`seeking.${o.key}`, t(`seeking.${o.key}`, o.key))}`;
                  return (
                      <SelectionTile
                      key={o.key}
                        active={active}
                        label={label}
                        indicator="radio"
                        leftAccentOnActive
                        onPress={() => selectOne(o.key)}
                    />
                  );
                })}
              </View>
              <P style={styles.hint}>{t('complete.visibilityQuestion','¿Quieres que esto se muestre en tu perfil?')}</P>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:8 }}>
                <Switch value={visible} onValueChange={setVisible} />
                <P style={{ color: theme.colors.textDim, fontSize:12 }}>{visible ? t('complete.visible','Mostrar en mi perfil') : t('complete.hidden','Ocultar en mi perfil')}</P>
              </View>
            </GlassCard>
          </TgYStack>
          <StickyFooterActions
            actions={[
              { title: t('common.continue'), onPress: () => { setDraft(d => ({ ...d, seeking: selected ? [selected] : [], show_seeking: visible })); if (returnTo === 'hub') router.replace('(tabs)/profile' as any); else router.push('(auth)/complete/orientation' as any); }, disabled: !canContinue },
              { title: t('common.back'), onPress: () => { setDraft(d => ({ ...d, seeking: selected ? [selected] : [], show_seeking: visible })); if (returnTo === 'hub') router.replace('(tabs)/profile' as any); else router.push('(auth)/complete/gender' as any); }, variant: 'outline' },
            ]}
          />
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
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 460, padding: theme.spacing(2), borderRadius: 16 },
  hint: { color: theme.colors.textDim, fontSize:12, marginTop:12 }
});
