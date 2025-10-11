import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, TextInput, Button } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function StepName() {
  const { draft, setDraft } = useCompleteProfile();
  const [name, setName] = useState(draft.name);
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const canNext = name.trim().length > 0;

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <View style={[styles.progressWrap,{ top: insets.top + 8 }] }>
              <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(1/9)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 1, total: 9 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('complete.nameTitle')}</H1>
            <P style={styles.subtitle}>{t('complete.nameSubtitle')}</P>

            <Card style={styles.card}>
              <TextInput value={name} onChangeText={setName} placeholder={t('complete.namePlaceholder')} />
              <Button title={t('common.continue')} disabled={!canNext} onPress={() => { setDraft((d) => ({ ...d, name: name.trim() })); router.push('(auth)/complete/birth' as any); }} style={{ marginTop: 8 }} />
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
