import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, TextInput, StickyFooterActions } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Svg, Circle, Rect } from 'react-native-svg';

export default function StepName() {
  const { draft, setDraft } = useCompleteProfile();
  const initialName = (!draft.name || draft.name === 'Nuevo Usuario') ? '' : draft.name;
  const [name, setName] = useState(initialName);
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const canNext = name.trim().length > 0;
  const fade = useRef(new Animated.Value(0)).current;
  const slide = fade.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <View style={[styles.progressWrap,{ top: insets.top + 8 }] }>
              <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(2/10)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 2, total: 10 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('complete.nameTitle')}</H1>
            <P style={styles.subtitle}>{t('complete.nameSubtitle')}</P>
            <Animated.View style={[styles.warningBox, { opacity: fade, transform: [{ translateY: slide }] }] }>
              <View style={styles.warningRow}>
                <View style={styles.warningIconWrap}>
                  <Svg width={18} height={18} viewBox="0 0 24 24">
                    <Circle cx={12} cy={12} r={10} stroke="#F59E0B" strokeWidth={2} fill="rgba(245,158,11,0.12)" />
                    <Rect x={11.25} y={7} width={1.5} height={7} rx={0.75} fill="#B45309" />
                    <Circle cx={12} cy={16.5} r={1} fill="#B45309" />
                  </Svg>
                </View>
                <P style={styles.warningText}>
                  {t('complete.nameNoteStrong', '¡Cuidado! Este será tu nombre público y no podrás modificarlo más adelante.')}
                </P>
              </View>
            </Animated.View>

            <Card style={styles.card}>
              <TextInput value={name} onChangeText={setName} placeholder={t('complete.namePlaceholder')} />
            </Card>
          </View>
          <StickyFooterActions
            actions={[
              { title: t('common.continue','Continuar'), onPress: () => { setDraft((d) => ({ ...d, name: name.trim() })); router.push('(auth)/complete/birth' as any); }, disabled: !canNext },
              { title: t('common.back','Volver'), onPress: () => router.push('(auth)/complete/welcome' as any), variant: 'outline' },
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
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  warningBox: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#F59E0B', borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginHorizontal: 12, alignSelf: 'stretch' },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warningIconWrap: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  warningText: { color: '#B45309', fontSize: 13, flex: 1, flexShrink: 1, textAlign: 'left' },
});
