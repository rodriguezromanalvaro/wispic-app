import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, Switch, SelectionTile, StickyFooterActions } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

// Multi-selección de orientación: a quién te interesa conocer (sin iconos)
const ORIENT_OPTIONS: { key: string; labelKey: string }[] = [
  { key: 'men', labelKey: 'orientation.men' },
  { key: 'women', labelKey: 'orientation.women' },
  { key: 'nonBinary', labelKey: 'orientation.nonBinary' },
  { key: 'everyone', labelKey: 'orientation.everyone' },
];

export default function StepOrientation() {
  const { draft, setDraft } = useCompleteProfile();
  const router = useRouter();
  const params = useLocalSearchParams();
  const returnTo = String((params as any)?.returnTo || '');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string>(Array.isArray(draft.interested_in) ? (draft.interested_in[0] || '') : '');
  const [visible, setVisible] = useState<boolean>(draft.show_orientation ?? true);

  const selectOne = (k: string) => setSelected(k);

  const canContinue = !!selected;

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <View style={[styles.progressWrap,{ top: insets.top + 8 }] }>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(6/10)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 6, total: 10 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('complete.orientationTitle','¿A quién estás buscando?')}</H1>
            <P style={styles.subtitle}>{t('complete.orientationHint','Nos ayuda a sugerir mejores matches')}</P>
            <Card style={styles.card}>
              <View style={{ gap: 10 }}>
                {ORIENT_OPTIONS.map(o => {
                  const active = selected === o.key;
                  return (
                    <SelectionTile
                      key={o.key}
                      active={active}
                      label={t(o.labelKey, t(o.labelKey, o.key))}
                      indicator="radio"
                      onPress={() => selectOne(o.key)}
                    />
                  );
                })}
              </View>
              <P style={styles.hint}>{t('complete.visibilityQuestion','¿Quieres que esto se muestre en tu perfil?')}</P>
              <View style={{ flexDirection:'row', alignItems:'center', marginTop:8, gap:8 }}>
                <Switch value={visible} onValueChange={setVisible} />
                <P style={{ color: theme.colors.textDim, fontSize:12 }}>{visible ? t('complete.visible','Mostrar en mi perfil') : t('complete.hidden','Ocultar en mi perfil')}</P>
              </View>
            </Card>
          </View>
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
  progressWrap: { position: 'absolute', top: 16, left: 20, right: 20, gap: 6 },
  progressBg: { width: '100%', height: 6, backgroundColor: theme.colors.surface, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 999 },
  progressText: { color: theme.colors.textDim, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 460, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  optionsWrap: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  optionActive: {},
  hint: { color: theme.colors.textDim, fontSize:12, marginTop:12 }
});
