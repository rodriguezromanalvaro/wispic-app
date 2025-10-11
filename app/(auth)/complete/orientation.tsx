import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, Button, Switch } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

// Multi-selección de orientación: a quién te interesa conocer
// Se permite multi para abarcar bisexual/pan/etc.
const ORIENT_OPTIONS: { key: string; labelKey: string; icon: string }[] = [
  { key: 'men', labelKey: 'orientation.men', icon: '👨' },
  { key: 'women', labelKey: 'orientation.women', icon: '👩' },
  { key: 'nonBinary', labelKey: 'orientation.nonBinary', icon: '⚧️' },
  { key: 'everyone', labelKey: 'orientation.everyone', icon: '🌈' },
];

export default function StepOrientation() {
  const { draft, setDraft } = useCompleteProfile();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>(draft.interested_in || []);
  const [visible, setVisible] = useState<boolean>(draft.show_orientation ?? true);

  const toggle = (k: string) => setSelected(cur => cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k]);

  const canContinue = selected.length > 0;

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <View style={[styles.progressWrap,{ top: insets.top + 8 }] }>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(3/9)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 3, total: 9 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('complete.orientationTitle','¿Quién te interesa?')}</H1>
            <P style={styles.subtitle}>{t('complete.orientationSubtitle','Selecciona todas las opciones que apliquen')}</P>
            <Card style={styles.card}>
              <View style={styles.optionsWrap}>
                {ORIENT_OPTIONS.map(o => {
                  const active = selected.includes(o.key);
                  return (
                    <Button
                      key={o.key}
                      title={`${o.icon} ${t(o.labelKey, t(o.labelKey, o.key))}`}
                      variant={active ? 'primary' : 'ghost'}
                      onPress={() => toggle(o.key)}
                      style={active ? styles.optionActive : undefined}
                    />
                  );
                })}
              </View>
              <P style={styles.hint}>{t('complete.orientationHint','Nos ayuda a filtrar y sugerir matches relevantes')}</P>
              <View style={{ flexDirection:'row', alignItems:'center', marginTop:8, gap:8 }}>
                <Switch value={visible} onValueChange={setVisible} />
                <P style={{ color:'#CBD5E1', fontSize:12 }}>{visible ? t('complete.orientationVisible','Mostrar en mi perfil') : t('complete.orientationHidden','Ocultar en mi perfil')}</P>
              </View>
              {selected.length === 0 && (
                <P style={[styles.hint,{ color:'#FDE68A' }]}>{t('complete.orientationSelectOne','Selecciona al menos una opción')}</P>
              )}
              <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                <Button title={t('common.back')} variant="ghost" onPress={() => router.push('(auth)/complete/birth' as any)} />
                <Button title={t('common.continue')} disabled={!canContinue} onPress={() => { setDraft(d => ({ ...d, interested_in: selected, show_orientation: visible })); router.push('(auth)/complete/seeking' as any); }} />
              </View>
            </Card>
          </View>
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
