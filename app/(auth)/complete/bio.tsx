import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, TextInput, StickyFooterActions } from '../../../components/ui';
import { OnboardingHeader } from '../../../components/OnboardingHeader';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SaveCongratsOverlay } from '../../../components/SaveCongratsOverlay';

export default function StepBio() {
  const { draft, setDraft, saveToSupabase } = useCompleteProfile();
  const [bio, setBio] = useState(draft.bio);
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [done, setDone] = useState(false);
  const params = useLocalSearchParams();
  const returnTo = String((params as any)?.returnTo || '');
  const isPost = String(params?.post || '') === '1';
  const MAX = 160;
  const remaining = Math.max(0, MAX - (bio?.length || 0));

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <OnboardingHeader step={isPost ? 12 : 10} total={isPost ? 12 : 10} />
          <View style={styles.center}>
            <View style={{ height: 64 }} />
            <H1 style={styles.title}>{t('complete.bioTitleFriendly','Tu toque personal')}</H1>
            <P style={styles.subtitle}>{t('complete.bioSubtitleFriendly','Añade una frase que te caracterice y te haga único/a. Breve y con personalidad.')}</P>

            <Card style={styles.card}>
              <TextInput value={bio} onChangeText={(txt)=> setBio(txt.slice(0, MAX))} multiline placeholder={t('complete.bioPlaceholderFriendly','Ej.: Fan del café de filtro, paseos largos y cine en VO.')} style={{ minHeight: 120, textAlignVertical: 'top' }} />
              <P style={{ color: theme.colors.textDim, fontSize: 12, textAlign: 'right', marginTop: 6 }}>{remaining}</P>
            </Card>
          </View>
          <StickyFooterActions
            actions={[
              { title: t('common.finish','Finalizar'), onPress: async () => { setDraft((d) => ({ ...d, bio })); const ok = await saveToSupabase(); if (ok) setDone(true); } },
              { title: t('common.back'), onPress: () => { setDraft((d) => ({ ...d, bio })); if (returnTo === 'hub') router.replace('(tabs)/profile' as any); else router.push({ pathname: '(auth)/complete/prompts', params: { post: '1' } } as any); }, variant: 'outline' },
            ]}
          />
          <SaveCongratsOverlay
            visible={done}
            confetti={false}
            title={t('thanks.title','¡Gracias!')}
            body={t('thanks.body','Has terminado tu perfil. Ya puedes ir a la app y empezar a disfrutar.')}
            primaryText={returnTo === 'hub' ? t('profile.hub.open','Abrir') : t('thanks.goApp','Ir a la app')}
            onPrimary={() => {
              if (returnTo === 'hub') router.replace('(tabs)/profile' as any);
              else router.replace('(tabs)/events' as any);
            }}
            onRequestClose={() => setDone(false)}
          />
  </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24 },
  // header migrated to OnboardingHeader
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
});
