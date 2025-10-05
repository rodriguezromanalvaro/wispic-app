import { KeyboardAvoidingView, Platform, StyleSheet, View, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Card, H1, P, Button } from '../../../components/ui';
import { theme } from '../../../lib/theme';
import { useCompleteProfile } from '../../../lib/completeProfileContext';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Image, FlatList } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';

export default function StepSummary() {
  const { draft, saveToSupabase } = useCompleteProfile();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [photoCount, setPhotoCount] = useState<number>(0);
  const [photoThumbs, setPhotoThumbs] = useState<string[]>([]);
  const [promptIcons, setPromptIcons] = useState<Record<string,string>>({});
  const [promptLocalized, setPromptLocalized] = useState<Record<string,{ title: string; choiceMap: Record<string,string>; order: number }>>({});

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data, count } = await supabase
        .from('user_photos')
        .select('url, sort_order', { count: 'exact' })
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });
      setPhotoCount(count || (data?.length || 0));
      setPhotoThumbs((data || []).map(d => d.url));
      // fetch icons for prompts present in draft
      if (draft.prompts && draft.prompts.length) {
        const keys = draft.prompts.map(p => p.key);
        const { data: tmpl } = await supabase
          .from('profile_prompt_templates')
          .select('id, key, question, icon, display_order')
          .in('key', keys);
        const iconMap: Record<string,string> = {};
        const idByKey: Record<string, number> = {};
        (tmpl||[]).forEach(r => { if (r.key) { if (r.icon) iconMap[r.key] = r.icon; idByKey[r.key] = r.id; } });
        setPromptIcons(iconMap);
        // Fetch ES + EN locales always
        const ids = Object.values(idByKey);
        if (ids.length) {
          const { data: locs } = await supabase
            .from('profile_prompt_template_locales')
            .select('template_id, locale, title, choices_labels')
            .in('template_id', ids)
            .in('locale', ['es','en']);
          const esMap = new Map<number, any>();
          const enMap = new Map<number, any>();
            (locs||[]).forEach(r => { if (r.locale === 'es') esMap.set(r.template_id, r); if (r.locale === 'en') enMap.set(r.template_id, r); });
          const localized: Record<string,{ title: string; choiceMap: Record<string,string>; order: number }> = {};
          (tmpl||[]).forEach(r => {
            const es = esMap.get(r.id);
            const en = enMap.get(r.id);
            const title = (es?.title && es.title.trim()) || r.question || r.key;
            function parseLabels(val:any){ if(!val) return null; if(typeof val==='object') return val; try{return JSON.parse(val);}catch{return null;} }
            const esChoices = parseLabels(es?.choices_labels) || {};
            const enChoices = parseLabels(en?.choices_labels) || {};
            localized[r.key] = { title, choiceMap: { ...enChoices, ...esChoices }, order: r.display_order ?? 9999 };
          });
          setPromptLocalized(localized);
        }
      }
    })();
  }, [user?.id, draft.prompts]);

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <LinearGradient colors={[theme.colors.primary, '#101828']} style={[styles.gradient, { paddingTop: Math.max(insets.top, 60) }]}>
          <View style={[styles.progressWrap,{ top: insets.top + 8 }] }>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(9/9)*100}%` }]} />
            </View>
            <P style={styles.progressText}>{t('complete.progress', { current: 9, total: 9 })}</P>
          </View>
          <ScrollView
            style={{ flex: 1, width: '100%' }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <H1 style={styles.title}>{t('complete.summaryTitle')}</H1>
            <P style={styles.subtitle}>{t('complete.summarySubtitle')}</P>

            <Card style={styles.card}>
              <P style={{ color: '#E6EAF2' }}>{t('complete.fieldName')}: {draft.name || '—'}</P>
              <P style={{ color: '#E6EAF2' }}>{t('complete.fieldBirth')}: {draft.birthdate || '—'}</P>
              <P style={{ color: '#E6EAF2' }}>
                {t('complete.fieldGender')}: {draft.gender || '—'}
                {! (draft.show_gender ?? true) && draft.gender ? ' 🔒' : ''}
              </P>
              <P style={{ color: '#E6EAF2' }}>
                {t('complete.fieldInterestedIn','Me interesa')}: {(draft.interested_in||[]).map(k=> t(`orientation.${k}`, k)).join(' • ') || '—'}
                {! (draft.show_orientation ?? true) && (draft.interested_in||[]).length ? ' 🔒' : ''}
              </P>
              <P style={{ color: '#E6EAF2' }}>
                {t('complete.fieldSeeking','Busco')}: {(draft.seeking||[]).map(k=> t(`seeking.${k}`, k)).join(' • ') || '—'}
                {! (draft.show_seeking ?? true) && (draft.seeking||[]).length ? ' 🔒' : ''}
              </P>
              <P style={{ color: '#E6EAF2' }}>{t('complete.fieldBio')}: {draft.bio || '—'}</P>
              {draft.prompts && draft.prompts.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {[...draft.prompts]
                    .sort((a,b)=>{
                      const oa = promptLocalized[a.key]?.order ?? 9999;
                      const ob = promptLocalized[b.key]?.order ?? 9999;
                      return oa - ob;
                    })
                    .map(p => {
                    const answers = Array.isArray(p.answers) ? p.answers : [];
                    const loc = promptLocalized[p.key];
                    const title = loc?.title || p.key;
                    const translatedList = answers.map(a => (loc?.choiceMap?.[a]) || a);
                    return (
                      <P key={p.key} style={{ color: '#E6EAF2' }}>
                        {promptIcons[p.key] ? promptIcons[p.key] + ' ' : ''}{title}: {translatedList.length ? translatedList.join(' • ') : '—'}
                      </P>
                    );
                  })}
                  <P style={{ color:'#9DA4AF', fontSize:11, marginTop:4 }}>
                    {draft.prompts.filter(p=>p.answers && p.answers.length>0).length}/{draft.prompts.length} {t('complete.promptsAnswered','respondidas')}
                  </P>
                  <P style={{ color: '#9DA4AF', fontSize: 11, marginTop: 6 }}>
                    {t('complete.promptsTotal', '{{count}} respuestas', { count: draft.prompts.reduce((acc, p) => acc + (p.answers?.length || 0), 0) })}
                  </P>
                </View>
              )}
              <P style={{ color: '#E6EAF2' }}>{t('complete.fieldPhotos')}: {photoCount}</P>
              {photoThumbs.length > 0 && (
                <FlatList
                  data={photoThumbs}
                  keyExtractor={(u, i) => u + i}
                  numColumns={3}
                  scrollEnabled={false}
                  contentContainerStyle={{ marginTop: 8, gap: 6 }}
                  columnWrapperStyle={{ gap: 6 }}
                  renderItem={({ item }) => (
                    <Image source={{ uri: item }} style={{ width: 84, height: 84, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }} />
                  )}
                />
              )}
              {(! (draft.show_gender ?? true) || ! (draft.show_orientation ?? true) || ! (draft.show_seeking ?? true)) && (
                <P style={{ color:'#9DA4AF', fontSize:11, marginTop:6 }}>
                  {t('complete.hiddenNote','Los campos marcados como ocultos no serán visibles en tu perfil público.')}
                </P>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button title={t('common.back')} variant="ghost" onPress={() => router.push('(auth)/complete/photos' as any)} />
                <Button title={t('common.saveContinue')} onPress={async () => { const ok = await saveToSupabase(); if (ok) { Alert.alert(t('complete.savedTitle'), t('complete.savedBody')); router.replace('/(tabs)/profile'); } }} />
              </View>
            </Card>
          </ScrollView>
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
  // Scroll content: flexGrow allows it to fill viewport; justifyContent centers only if content is short
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 16, paddingBottom: 40 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#D0D5DD', fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
});
