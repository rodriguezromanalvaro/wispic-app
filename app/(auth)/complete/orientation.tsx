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
import { getOrientationOptions } from 'features/profile/model';
import { OnboardingHeader } from 'features/profile/ui/OnboardingHeader';
import { theme } from 'lib/theme';

// Usa la lista centralizada para mantener códigos y etiquetas consistentes con Configurar perfil

export default function StepOrientation() {
  const { draft, setDraft } = useCompleteProfile();
  const router = useRouter();
  const params = useLocalSearchParams();
  const returnTo = String((params as any)?.returnTo || '');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string>(Array.isArray(draft.interested_in) ? (draft.interested_in[0] || '') : '');
  const [visible, setVisible] = useState<boolean>(draft.show_orientation ?? true);
  const tf = (k: string, def?: string) => t(k as any, def as any);
  const options = getOrientationOptions(tf);

  const selectOne = (k: string) => setSelected(k);

  const canContinue = !!selected;

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <OnboardingHeader step={6} total={10} />
          <TgYStack f={1} ai="center" jc="center" gap="$2">
            <H1 style={styles.title}>{t('complete.orientationTitle','¿A quién estás buscando?')}</H1>
            <P style={styles.subtitle}>{t('complete.orientationHint','Nos ayuda a sugerir mejores matches')}</P>
            <GlassCard padding={16} elevationLevel={1} style={styles.card}>
              <View style={{ gap: 10 }}>
                {options.map((o) => {
                  const code = (o as any).code as string;
                  const active = selected === code;
                  return (
                    <SelectionTile
                      key={code}
                      active={active}
                      label={(o as any).label}
                      indicator="radio"
                      onPress={() => selectOne(code)}
                    />
                  );
                })}
              </View>
              <P style={styles.hint}>{t('complete.visibilityQuestion','¿Quieres que esto se muestre en tu perfil?')}</P>
              <View style={{ flexDirection:'row', alignItems:'center', marginTop:8, gap:8 }}>
                <Switch value={visible} onValueChange={setVisible} />
                <P style={{ color: theme.colors.textDim, fontSize:12 }}>{visible ? t('complete.visible','Mostrar en mi perfil') : t('complete.hidden','Ocultar en mi perfil')}</P>
              </View>
            </GlassCard>
          </TgYStack>
          <StickyFooterActions
            actions={[
              { title: t('common.continue'), onPress: () => { setDraft(d => ({ ...d, interested_in: selected ? [selected] : [], show_orientation: visible })); if (returnTo === 'hub') router.replace('(tabs)/profile' as any); else router.push('(auth)/complete/relationship' as any); }, disabled: !canContinue },
              { title: t('common.back'), onPress: () => { setDraft(d => ({ ...d, interested_in: selected ? [selected] : [], show_orientation: visible })); if (returnTo === 'hub') router.replace('(tabs)/profile' as any); else router.push('(auth)/complete/seeking' as any); }, variant: 'outline' },
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
  card: { width: '100%', maxWidth: 460, padding: theme.spacing(2), borderRadius: 16 },
  optionsWrap: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  optionActive: {},
  hint: { color: theme.colors.textDim, fontSize:12, marginTop:12 }
});
