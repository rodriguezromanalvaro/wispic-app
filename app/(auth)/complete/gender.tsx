import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, Switch, SelectionTile, StickyFooterActions } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function StepGender() {
  const { draft, setDraft } = useCompleteProfile();
  const [showGender, setShowGender] = React.useState<boolean>(draft.show_gender ?? true);
  const router = useRouter();
  const params = useLocalSearchParams();
  const returnTo = String((params as any)?.returnTo || '');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const genders: Array<{ key: 'male' | 'female' | 'other'; label: string }> = [
    { key: 'male', label: t('complete.male', 'Hombre') },
    { key: 'female', label: t('complete.female', 'Mujer') },
    { key: 'other', label: t('complete.other', 'Más allá del binario') },
  ];

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <View style={[styles.progressWrap,{ top: insets.top + 8 }] }>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(4/10)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 4, total: 10 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('complete.genderTitle','¿Con qué género te identificas?')}</H1>
            <P style={styles.subtitle}>{t('complete.genderSubtitle','Queremos mostrarte a las personas adecuadas.')}</P>

            <Card style={styles.card}>
              <View style={{ gap: 10 }}>
                {genders.map((g) => {
                  const active = draft.gender === g.key;
                  return (
                    <SelectionTile
                      key={g.key}
                      active={active}
                      label={g.label}
                      indicator="radio"
                      onPress={() => setDraft((d) => ({ ...d, gender: g.key }))}
                    />
                  );
                })}
              </View>
              <View style={{ marginTop: 12, gap: 8 }}>
                <P style={{ color: theme.colors.textDim, fontSize:12 }}>{t('complete.genderShowQuestion','¿Quieres que se muestre el género en tu perfil?')}</P>
                <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <Switch value={showGender} onValueChange={(v)=> { setShowGender(v); setDraft(d=>({...d, show_gender:v})); }} />
                  <P style={{ fontSize:12, color: theme.colors.textDim }}>{showGender ? t('complete.genderVisible','Mostrar en mi perfil') : t('complete.genderHidden','Ocultar en mi perfil')}</P>
                </View>
              </View>
            </Card>
          </View>
          <StickyFooterActions
            actions={[
              { title: t('common.continue'), onPress: () => {
                if (!draft?.gender) return; // guard extra
                if (returnTo === 'hub') {
                  router.replace('(tabs)/profile' as any);
                } else {
                  router.push('(auth)/complete/seeking' as any);
                }
              }, disabled: !draft?.gender },
              { title: t('common.back'), onPress: () => { if (returnTo === 'hub') router.replace('(tabs)/profile' as any); else router.push('(auth)/complete/birth' as any); }, variant: 'outline' },
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
});
