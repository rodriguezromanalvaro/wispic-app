import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Card, H1, P, TextInput, Button } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function StepBio() {
  const { draft, setDraft } = useCompleteProfile();
  const [bio, setBio] = useState(draft.bio);
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <LinearGradient colors={[theme.colors.primary, '#101828']} style={[styles.gradient, { paddingTop: Math.max(insets.top, 60) }]}>
          <View style={[styles.progressWrap,{ top: insets.top + 8 }] }>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(6/9)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 6, total: 9 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('complete.bioTitle')}</H1>
            <P style={styles.subtitle}>{t('complete.bioSubtitle')}</P>

            <Card style={styles.card}>
              <TextInput value={bio} onChangeText={setBio} multiline placeholder={t('complete.bioPlaceholder')} style={{ minHeight: 100, textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button title={t('common.back')} variant="ghost" onPress={() => { setDraft((d) => ({ ...d, bio })); router.push('(auth)/complete/gender' as any); }} />
                <Button title={t('common.continue')} onPress={() => { setDraft((d) => ({ ...d, bio })); router.push('(auth)/complete/prompts' as any); }} />
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
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
});
