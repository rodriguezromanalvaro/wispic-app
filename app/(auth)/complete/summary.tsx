import { useEffect, useState } from 'react';

import { KeyboardAvoidingView, Platform, StyleSheet, View, ScrollView } from 'react-native';
import { Image, FlatList } from 'react-native';

import { useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from 'components/GlassCard';
import { CenterScaffold } from 'components/Scaffold';
import { Screen, H1, P, Button, StickyFooterActions } from 'components/ui';
import { useCompleteProfile } from 'features/profile/model';
import { getGenderLabel, getOrientationOptions } from 'features/profile/model';
import { OnboardingHeader } from 'features/profile/ui/OnboardingHeader';
import { SaveCongratsOverlay } from 'features/profile/ui/SaveCongratsOverlay';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { useAuth } from 'lib/useAuth';

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
  const [saved, setSaved] = useState(false);

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
        <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <OnboardingHeader step={10} total={10} />
          <ScrollView
            style={{ flex: 1, width: '100%' }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <H1 style={styles.title}>{t('complete.summaryTitle')}</H1>
            <P style={styles.subtitle}>{t('complete.summarySubtitle')}</P>

            <GlassCard padding={16} elevationLevel={1} style={styles.card}>
              <View style={styles.rows}>
                {/* Name */}
                <View style={styles.row}>
                  <View style={styles.rowHeader}>
                    <P style={styles.rowText}>{t('complete.fieldName')}: <P style={styles.rowValue}>{draft.name || '—'}</P></P>
                    <Button title={t('common.edit','Edit')} variant="ghost" onPress={() => router.push('(auth)/complete/name' as any)} style={styles.editBtn} />
                  </View>
                </View>
                {/* Birthdate */}
                <View style={styles.row}>
                  <View style={styles.rowHeader}>
                    <P style={styles.rowText}>{t('complete.fieldBirth')}: <P style={styles.rowValue}>{draft.birthdate || '—'}</P></P>
                    <Button title={t('common.edit','Edit')} variant="ghost" onPress={() => router.push('(auth)/complete/birth' as any)} style={styles.editBtn} />
                  </View>
                </View>
                {/* Gender */}
                <View style={styles.row}>
                  <View style={styles.rowHeader}>
                    {(() => {
                      const g = draft.gender as any;
                      const genderText = g ? getGenderLabel(g, t) : '—';
                      return (
                        <P style={styles.rowText}>
                          {t('complete.fieldGender')}: <P style={styles.rowValue}>{genderText}{(! (draft.show_gender ?? true) && draft.gender) ? ' 🔒' : ''}</P>
                        </P>
                      );
                    })()}
                    <Button title={t('common.edit','Edit')} variant="ghost" onPress={() => router.push('(auth)/complete/gender' as any)} style={styles.editBtn} />
                  </View>
                </View>
                {/* Seeking */}
                <View style={styles.row}>
                  <View style={styles.rowHeader}>
                    <P style={styles.rowText}>
                      {t('complete.fieldSeeking','Busco')}: <P style={styles.rowValue}>{(draft.seeking||[]).map(k=> t(`seeking.${k}`, k)).join(' • ') || '—'}{(! (draft.show_seeking ?? true) && (draft.seeking||[]).length) ? ' 🔒' : ''}</P>
                    </P>
                    <Button title={t('common.edit','Edit')} variant="ghost" onPress={() => router.push('(auth)/complete/seeking' as any)} style={styles.editBtn} />
                  </View>
                </View>
                {/* Orientation */}
                <View style={styles.row}>
                  <View style={styles.rowHeader}>
                    <P style={styles.rowText}>
                      {t('complete.fieldInterestedIn','Me interesa')}: <P style={styles.rowValue}>{(() => {
                        const tf = (k: string, def?: string) => t(k as any, def as any);
                        const map = new Map<string,string>((getOrientationOptions(tf) as any[]).map(o => [o.code, o.label]));
                        const list = (draft.interested_in||[]).map(k=> map.get(k) || k);
                        return list.length ? list.join(' • ') : '—';
                      })()}{(! (draft.show_orientation ?? true) && (draft.interested_in||[]).length) ? ' 🔒' : ''}</P>
                    </P>
                    <Button title={t('common.edit','Edit')} variant="ghost" onPress={() => router.push('(auth)/complete/orientation' as any)} style={styles.editBtn} />
                  </View>
                </View>
                {/* Relationship */}
                <View style={styles.row}>
                  <View style={styles.rowHeader}>
                    <P style={styles.rowText}>
                      {t('complete.fieldRelationship','Situación')}: <P style={styles.rowValue}>{draft.relationship_status ? t(`relationship.${draft.relationship_status}`) : '—'}{(! (draft as any).show_relationship && draft.relationship_status) ? ' 🔒' : ''}</P>
                    </P>
                    <Button title={t('common.edit','Edit')} variant="ghost" onPress={() => router.push('(auth)/complete/relationship' as any)} style={styles.editBtn} />
                  </View>
                </View>
                {/* Bio (optional) */}
                {!!(draft.bio && draft.bio.trim().length) && (
                  <View style={styles.row}>
                    <View style={styles.rowHeader}>
                      <P style={styles.rowText}>{t('complete.fieldBio')}: <P style={styles.rowValue}>{draft.bio}</P></P>
                      <Button title={t('common.edit','Edit')} variant="ghost" onPress={() => router.push('(auth)/complete/bio' as any)} style={styles.editBtn} />
                    </View>
                  </View>
                )}

                {draft.prompts && draft.prompts.length > 0 && (
                  <View style={styles.rowNoBorder}>
                    <View style={styles.rowHeader}>
                      <P style={styles.rowText}>{t('complete.fieldPrompts','Respuestas')}</P>
                      <Button title={t('common.edit','Edit')} variant="ghost" onPress={() => router.push('(auth)/complete/prompts' as any)} style={styles.editBtn} />
                    </View>
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
                        <P key={p.key} style={styles.rowText}>
                          {promptIcons[p.key] ? promptIcons[p.key] + ' ' : ''}{title}: <P style={styles.rowValue}>{translatedList.length ? translatedList.join(' • ') : '—'}</P>
                        </P>
                      );
                    })}
                    <P style={styles.metaText}>
                      {draft.prompts.filter(p=>p.answers && p.answers.length>0).length}/{draft.prompts.length} {t('complete.promptsAnswered','respondidas')}
                    </P>
                    <P style={styles.metaText}>
                      {t('complete.promptsTotal', '{{count}} respuestas', { count: draft.prompts.reduce((acc, p) => acc + (p.answers?.length || 0), 0) })}
                    </P>
                  </View>
                )}

                <View style={styles.rowNoBorder}>
                  <View style={styles.rowHeader}>
                    <P style={styles.rowText}>{t('complete.fieldPhotos')}: <P style={styles.rowValue}>{photoCount}</P></P>
                    <Button title={t('common.edit','Edit')} variant="ghost" onPress={() => router.push('(auth)/complete/photos' as any)} style={styles.editBtn} />
                  </View>
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
                </View>

                {(! (draft.show_gender ?? true) || ! (draft.show_orientation ?? true) || ! (draft.show_seeking ?? true) || !((draft as any).show_relationship ?? true)) && (
                  <P style={styles.metaText}>
                    {t('complete.hiddenNote','Los campos marcados como ocultos no serán visibles en tu perfil público.')}
                  </P>
                )}
              </View>

            </GlassCard>
          </ScrollView>
          <StickyFooterActions
            actions={[
              { title: t('common.saveContinue'), onPress: async () => { const ok = await saveToSupabase(); if (ok) { setSaved(true); } } },
              { title: t('common.back'), onPress: () => router.push('(auth)/complete/photos' as any), variant: 'outline' },
            ]}
          />
          <SaveCongratsOverlay
            visible={saved}
            title={t('congrats.title','¡Enhorabuena!')}
            body={t('congrats.body','Tu perfil está listo para brillar. Puedes ir ya a la app, o si completas un par de detalles más, tus matches serán aún mejores.')}            
            primaryText={t('congrats.goApp','Ir a la app')}
            secondaryText={t('congrats.keepImproving','Mejorar mi perfil (2 min)')}
            onPrimary={() => router.replace('(tabs)/events' as any)}
            onSecondary={() => { setSaved(false); router.push({ pathname: '(auth)/complete/prompts', params: { post: '1' } } as any); }}
            onRequestClose={() => setSaved(false)}
          />
        </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24 },
  // progress handled via OnboardingHeader
  // Scroll content: flexGrow allows it to fill viewport; justifyContent centers only if content is short
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 16, paddingBottom: 40 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center', marginTop: 18 },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 420, padding: theme.spacing(2), borderRadius: 16 },
  rows: { gap: 12 },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowNoBorder: { paddingVertical: 8 },
  rowText: { color: theme.colors.text, lineHeight: 20 },
  rowValue: { color: theme.colors.text, fontWeight: '700' },
  metaText: { color: theme.colors.textDim, fontSize: 12, marginTop: 4 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  editBtn: { paddingVertical: 6, paddingHorizontal: 10 }
});
