import { useState, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Card, H1, P, Button, Switch } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

const OPTIONS: { key: string; icon: string }[] = [
  { key: 'dating', icon: '❤️' },
  { key: 'friends', icon: '🤝' },
  { key: 'networking', icon: '💼' },
  { key: 'activity', icon: '⚽' },
  { key: 'languageExchange', icon: '🗣️' },
  { key: 'travelBuddy', icon: '✈️' },
];

export default function StepSeeking() {
  const { draft, setDraft } = useCompleteProfile();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>(draft.seeking || []);
  const [visible, setVisible] = useState<boolean>(draft.show_seeking ?? true);
  const toggle = (k: string) => setSelected(cur => cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k]);
  const canContinue = selected.length > 0;

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <LinearGradient colors={[theme.colors.primary, '#101828']} style={[styles.gradient, { paddingTop: Math.max(insets.top, 60) }]}>
          <View style={[styles.progressWrap,{ top: insets.top + 8 }] }>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(4/9)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 4, total: 9 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('complete.seekingTitle','¿Qué buscas aquí?')}</H1>
            <P style={styles.subtitle}>{t('complete.seekingSubtitle','Selecciona todas las que apliquen (multiopción)')}</P>
            <Card style={styles.card}>
              <View style={styles.optionsWrap}>
                {OPTIONS.map(o => {
                  const active = selected.includes(o.key);
                  return (
                    <Button
                      key={o.key}
                      title={`${o.icon} ${t(`seeking.${o.key}`, t(`seeking.${o.key}`, o.key))}`}
                      variant={active ? 'primary' : 'ghost'}
                      onPress={() => toggle(o.key)}
                      style={active ? styles.optionActive : undefined}
                    />
                  );
                })}
              </View>
              <P style={styles.hint}>{t('complete.seekingHint','Esto ayuda a mostrarte mejores coincidencias')} · {selected.length} {t('complete.selected','seleccionadas')}</P>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:8 }}>
                <Switch value={visible} onValueChange={setVisible} />
                <P style={{ color:'#CBD5E1', fontSize:12 }}>{visible ? t('complete.seekingVisible','Mostrar en mi perfil') : t('complete.seekingHidden','Ocultar en mi perfil')}</P>
              </View>
              <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                <Button title={t('common.back')} variant="ghost" onPress={() => router.push('(auth)/complete/orientation' as any)} />
                <Button title={t('common.continue')} disabled={!canContinue} onPress={() => { setDraft(d => ({ ...d, seeking: selected, show_seeking: visible })); router.push('(auth)/complete/gender' as any); }} />
              </View>
            </Card>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24 },
  progressWrap: { position: 'absolute', top: 16, left: 20, right: 20, gap: 6 },
  progressBg: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 999 },
  progressText: { color: '#E6EAF2', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#D0D5DD', fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 460, padding: theme.spacing(2), borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  optionsWrap: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  optionActive: {},
  hint: { color:'#94A3B8', fontSize:12, marginTop:12 }
});
