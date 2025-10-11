import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, Button, Switch } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function StepGender() {
  const { draft, setDraft } = useCompleteProfile();
  const [showGender, setShowGender] = React.useState<boolean>(draft.show_gender ?? true);
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const genders: Array<{ key: 'male' | 'female' | 'other'; label: string }> = [
    { key: 'male', label: t('complete.male') },
    { key: 'female', label: t('complete.female') },
    { key: 'other', label: t('complete.other') },
  ];

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <View style={[styles.progressWrap,{ top: insets.top + 8 }] }>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(5/9)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 5, total: 9 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('complete.genderTitle')}</H1>
            <P style={styles.subtitle}>{t('complete.genderSubtitle')}</P>

            <Card style={styles.card}>
              <P style={{ color: theme.colors.textDim, fontSize:12, marginBottom:4 }}>{t('complete.genderVisibilityHint','Puedes ocultar tu género si prefieres.')}</P>
              <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:12 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                  <Switch value={showGender} onValueChange={(v)=> { setShowGender(v); setDraft(d=>({...d, show_gender:v})); }} />
                  <P style={{ fontSize:12, color: theme.colors.textDim }}>{showGender ? t('complete.genderVisible','Género visible') : t('complete.genderHidden','Género oculto')}</P>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {genders.map((g) => {
                  const active = draft.gender === g.key;
                  return (
                    <Button key={g.key} title={g.label} variant={active ? 'primary' : 'ghost'} onPress={() => setDraft((d) => ({ ...d, gender: g.key }))} />
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button title={t('common.back')} variant="ghost" onPress={() => router.push('(auth)/complete/seeking' as any)} />
                <Button title={t('common.continue')} onPress={() => router.push('(auth)/complete/bio' as any)} />
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
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
});
