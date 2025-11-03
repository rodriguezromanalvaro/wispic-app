import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from 'components/GlassCard';
import { CenterScaffold } from 'components/Scaffold';
import { YStack as TgYStack } from 'components/tg';
import { Screen, H1, P, SelectionTile, StickyFooterActions, Switch } from 'components/ui';
import { useCompleteProfile } from 'features/profile/model';
import { OnboardingHeader } from 'features/profile/ui/OnboardingHeader';
import { theme } from 'lib/theme';

const OPTIONS: { key: 'single'|'inRelationship'|'open'|'itsComplicated'|'preferNot'; label: string }[] = [
  { key: 'single', label: 'Soltero/a' },
  { key: 'inRelationship', label: 'En una relación' },
  { key: 'open', label: 'Relación abierta' },
  { key: 'itsComplicated', label: 'Es complicado' },
  { key: 'preferNot', label: 'Prefiero no decirlo' },
];

export default function StepRelationship() {
  const insets = useSafeAreaInsets();
  const { draft, setDraft } = useCompleteProfile();
  const router = useRouter();
  const params = useLocalSearchParams();
  const returnTo = String((params as any)?.returnTo || '');
  const { t } = useTranslation();

  const selected = (draft as any).relationship_status as string | undefined;
  const visible = (draft as any).show_relationship ?? true;

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <CenterScaffold variant="auth" paddedTop={Math.max(insets.top, 60)}>
          <OnboardingHeader step={7} total={10} />
          <TgYStack f={1} ai="center" jc="center" gap="$2">
            <H1 style={styles.title}>{t('relationship.title','¿Cuál es tu situación?')}</H1>
            <P style={styles.subtitle}>{t('relationship.subtitle','Nos ayuda a ajustar tus recomendaciones.')}</P>
            <GlassCard padding={16} elevationLevel={1} style={styles.card}>
              <View style={{ gap: 10 }}>
                {OPTIONS.map(o => {
                  const active = selected === o.key;
                  return (
                      <SelectionTile
                      key={o.key}
                        active={active}
                        label={t(`relationship.${o.key}`, o.label)}
                        indicator="radio"
                        onPress={() => setDraft(d => ({ ...d, relationship_status: o.key as any }))}
                    />
                  );
                })}
              </View>
              <P style={{ color: theme.colors.textDim, fontSize:12, marginTop:12 }}>{t('complete.visibilityQuestion','¿Quieres que esto se muestre en tu perfil?')}</P>
              <View style={{ flexDirection:'row', alignItems:'center', marginTop:8, gap:8 }}>
                <Switch value={!!visible} onValueChange={(v)=> setDraft(d => ({ ...d, show_relationship: v }))} />
                <P style={{ color: theme.colors.textDim, fontSize:12 }}>{visible ? t('complete.visible','Mostrar en mi perfil') : t('complete.hidden','Ocultar en mi perfil')}</P>
              </View>
            </GlassCard>
          </TgYStack>
          <StickyFooterActions
            actions={[
              { title: t('common.continue'), onPress: () => { if (returnTo === 'hub') router.replace('(tabs)/profile' as any); else router.push('(auth)/complete/permissions' as any); }, disabled: !selected },
              { title: t('common.back'), onPress: () => { if (returnTo === 'hub') router.replace('(tabs)/profile' as any); else router.push('(auth)/complete/orientation' as any); }, variant: 'outline' },
            ]}
          />
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // progress handled via OnboardingHeader
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 460, padding: theme.spacing(2), borderRadius: 16 },
});
