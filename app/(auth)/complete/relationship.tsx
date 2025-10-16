import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterScaffold } from '../../../components/Scaffold';
import { Screen, Card, H1, P, Button, SelectionTile, StickyFooterActions, Switch } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

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
          <View style={[styles.progressWrap, { top: insets.top + 8 }]}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(7/10)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 7, total: 10 })}</P>
          </View>
          <View style={styles.center}>
            <H1 style={styles.title}>{t('relationship.title','¿Cuál es tu situación?')}</H1>
            <P style={styles.subtitle}>{t('relationship.subtitle','Nos ayuda a ajustar tus recomendaciones.')}</P>
            <Card style={styles.card}>
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
            </Card>
          </View>
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
  progressWrap: { position: 'absolute', top: 16, left: 20, right: 20, gap: 6 },
  progressBg: { width: '100%', height: 6, backgroundColor: theme.colors.surface, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 999 },
  progressText: { color: theme.colors.textDim, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 460, padding: theme.spacing(2), borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
});
