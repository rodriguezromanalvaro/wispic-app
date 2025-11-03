import { useState, useMemo, useEffect, useRef } from 'react';

import { KeyboardAvoidingView, Platform, StyleSheet, View, SectionList, Dimensions } from 'react-native';

import { useRouter, useLocalSearchParams } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from 'components/GlassCard';
import { PromptCard } from 'components/PromptCard';
import { CenterScaffold } from 'components/Scaffold';
import { Screen, H1, P, Button, StickyFooterActions } from 'components/ui';
import { useCompleteProfile } from 'features/profile/model';
import { OnboardingHeader } from 'features/profile/ui/OnboardingHeader';
import { ProfilePreviewPane } from 'features/profile/ui/ProfilePreviewPane';
import { AVAILABLE_PROMPTS } from 'lib/prompts';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { useAuth } from 'lib/useAuth';

export default function StepPrompts() {
  const insets = useSafeAreaInsets();
  const { draft, setDraft } = useCompleteProfile();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const returnTo = String((params as any)?.returnTo || '');
  const { t, i18n } = useTranslation();
  const isPostCompletion = String(params?.post || '') === '1';
  // Estado para templates dinámicos
  type Template = { id: number; key: string; type: string; choices: string[]; max_choices: number; question?: string | null; base?: string; icon?: string; categories?: { key:string; icon?: string; color?: string }[] };
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  // Removed preview modal/button for small screens per request
  const trackingQueue = useRef<any[]>([]);
  // Use ReturnType<typeof setTimeout> for React Native (setTimeout returns number, not NodeJS.Timeout)
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWide = Dimensions.get('window').width > 920;
  const MAX_TOTAL_CHOICES = 10; // límite global inspirado en la referencia
  // const canSelectMore = selectedGlobalCount < MAX_TOTAL_CHOICES; // unused
  // Número de preguntas (templates) con al menos una respuesta
  const answeredQuestionsCount = useMemo(() => {
    if (!templates?.length) return 0;
    const keys = new Set(templates.map(t => t.key));
    let n = 0;
    for (const [k, arr] of Object.entries(answers)) {
      if (keys.has(k) && Array.isArray(arr) && arr.length > 0) n++;
    }
    return n;
  }, [answers, templates]);

  // Eliminado botón de refrescar manual; se mantiene carga automática por idioma

  // Cargar templates desde backend (fallback a AVAILABLE_PROMPTS)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profile_prompt_templates')
          .select('id, key, type, choices, max_choices, display_order, question, icon, prompt_template_categories(prompt_categories(key,icon,color))')
          .eq('active', true)
          .order('display_order', { ascending: true })
          .order('id', { ascending: true });
  let list: Template[] = [];
        if (!error && data) {
          // Fetch localization overrides in bulk for current language
          // Normalizamos a código corto (en, es, etc.) para coincidir con locales guardados
          const rawLocale = (t as any).language || (t as any).i18n?.language || 'en';
          const deviceLocale = String(rawLocale).split('-')[0];
          const ids = data.map(r => r.id);
          // Siempre traemos ES y EN (y el locale del dispositivo si es distinto) para garantizar preferencia española.
          let currentLocaleMap = new Map<number, any>(); // dispositivo (puede ser en)
          let esLocaleMap = new Map<number, any>();
          let enLocaleMap = new Map<number, any>();
          if (ids.length) {
            const wantedSet = new Set<string>(['es','en', deviceLocale]);
            const wantedLocales = Array.from(wantedSet.values());
            const { data: locRows } = await supabase
              .from('profile_prompt_template_locales')
              .select('template_id, locale, title, placeholder, choices_labels')
              .in('locale', wantedLocales)
              .in('template_id', ids);
            (locRows||[]).forEach(r => {
              if (r.locale === deviceLocale) currentLocaleMap.set(r.template_id, r);
              if (r.locale === 'es') esLocaleMap.set(r.template_id, r);
              if (r.locale === 'en') enLocaleMap.set(r.template_id, r);
            });
          }
          // Debug logs eliminados
          list = data.map(r => {
            let type = r.type || 'choice';
            const arr = Array.isArray(r.choices) ? r.choices : [];
            if ((!arr || arr.length === 0) && type === 'choice') {
              // reconvertimos a text automáticamente si no hay choices
              type = 'text';
            }
            // Heurística cliente: si el key o question contiene truth/verdad y max_choices < 3, subir a 3
            let maxChoices = r.max_choices || 1;
            const qStr = (r.key || '') + ' ' + (r.question || '');
            if (/truth|verdad/i.test(qStr) && maxChoices < 3) {
              maxChoices = 3;
            }
            const esRow = esLocaleMap.get(r.id);
            const deviceRow = currentLocaleMap.get(r.id);
            const enRow = enLocaleMap.get(r.id);
            // Preferimos SIEMPRE español si existe; luego locale dispositivo (si distinto) y por último nada (base inglés en render).
            const rawTitle = esRow?.title && esRow.title.trim() !== ''
              ? esRow.title.trim()
              : (deviceRow?.title && deviceRow.title.trim() !== '' ? deviceRow.title.trim() : null);
            // Parse choices_labels (may come as text or json)
            function parseLabels(val: any): Record<string,string> | null {
              if (!val) return null;
              if (typeof val === 'object') return val;
              try { return JSON.parse(val); } catch { return null; }
            }
            const esLabels = parseLabels(esRow?.choices_labels);
            const deviceLabels = parseLabels(deviceRow?.choices_labels);
            const enLabels = parseLabels(enRow?.choices_labels);
            // Merge: en -> device -> es (es sobrescribe a todos al final)
            const mergedLabels = (enLabels || deviceLabels || esLabels)
              ? { ...(enLabels||{}), ...(deviceLabels||{}), ...(esLabels||{}) }
              : null;
            // Filtro anti-basura: si las choices parecen ser tokens triviales de la pregunta (<=6 y todas aparecen en question)
            let cleanedChoices = arr;
            if (type === 'choice' && arr.length && r.question) {
              const qWords = r.question.toLowerCase().split(/[^a-z0-9áéíóúüñ]+/).filter((w: string) => w.length>2);
              const qSet = new Set(qWords);
              const nonTrivial = arr.filter((c: any) => !qSet.has(String(c).toLowerCase()));
              // Si resultan pocas (o ninguna), degradar a text
              if (nonTrivial.length < 2) {
                type = 'text';
              } else {
                cleanedChoices = nonTrivial;
              }
            }
            const cats = (r as any).prompt_template_categories?.map((pc:any)=>({ key: pc.prompt_categories?.key, icon: pc.prompt_categories?.icon, color: pc.prompt_categories?.color })).filter((c:any)=>c.key);
            return {
              id: r.id,
              key: r.key || `k_${r.id}`,
              type,
              choices: cleanedChoices,
              max_choices: maxChoices,
              // question ahora SOLO contiene el título localizado válido (si no, null) para evitar fallback inglés involuntario
              question: rawTitle,
              // base almacena la pregunta original (inglés) para fallback controlado en render
              base: r.question || r.key,
              icon: r.icon || undefined,
              categories: cats || [],
              choicesLabels: mergedLabels
            };
          });
        } else {
          // fallback a AVAILABLE_PROMPTS en formato choice
          list = AVAILABLE_PROMPTS.map((p: typeof AVAILABLE_PROMPTS[number], idx: number) => ({ id: 1000 + idx, key: p.key, type: p.type, choices: p.choices || [], max_choices: 1, icon: undefined }));
        }
        if (active) {
          setTemplates(list);
          // Debug logs eliminados
          // Inicializar answers a lo que ya exista en draft
          const map: Record<string, string[]> = {};
            draft.prompts.forEach((p: { key: string; answers: string[] }) => { map[p.key] = p.answers || []; });
          setAnswers(map);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [draft.prompts, i18n.language]);

  // Batch tracking helper
  function enqueueTracking(events: any[]) {
    trackingQueue.current.push(...events);
    if (!flushTimer.current) {
      flushTimer.current = setTimeout(async () => {
        const batch = trackingQueue.current.splice(0, trackingQueue.current.length);
        flushTimer.current = null;
        if (!batch.length) return;
        try { await supabase.from('prompt_interactions').insert(batch); } catch {}
      }, 600);
    }
  }

  // Track view once templates loaded (batched)
  useEffect(() => {
    if (!user?.id || !templates.length) return;
    enqueueTracking(templates.map(t => ({ user_id: user.id, prompt_template_id: t.id, action: 'view' })));
  }, [templates, user?.id]);

  const toggleSkipAll = () => {
  const hasAny = Object.values(answers).some(arr => (arr || []).length > 0);
    if (hasAny) {
      // vaciar
  const empty: Record<string,string[]> = {};
  templates.forEach(p => { empty[p.key] = []; });
      setAnswers(empty);
  if (user?.id) enqueueTracking([{ user_id: user.id, prompt_template_id: templates[0]?.id, action: 'skip_all' }]);
    } else {
      // no hace nada, se deja vacío
    }
  };

  const saveAndContinue = () => {
    const selectedEntries = Object.entries(answers)
      .filter(([key, arr]) => Array.isArray(arr) && arr.length > 0 && templates.find(t => t.key === key));
    const filtered = selectedEntries.map(([key, arr]) => ({ key, answers: arr }));
  setDraft((d: any) => ({ ...d, prompts: filtered }));
    if (returnTo === 'hub') {
      // Guardar en draft y volver al hub
      router.replace('(tabs)/profile' as any);
    } else if (isPostCompletion) {
      // Segunda parte: después de respuestas, pasamos a Bio
      router.push({ pathname: '(auth)/complete/bio', params: { post: '1' } } as any);
    } else {
      // En flujo normal no debería usarse esta pantalla; por compat, redirigimos a Fotos
      router.push('(auth)/complete/photos' as any);
    }
  };

  // Construir secciones por primera categoría (o 'other')
  const sections = useMemo(() => {
    const groups = new Map<string, { title: string; icon?: string; color?: string; data: Template[]; order: number }>();
    templates.forEach((t, idx) => {
      const cat = t.categories && t.categories[0] ? t.categories[0] : { key: 'other', icon: '✨', color: '#64748B', order: 9999 } as any;
      const key = cat.key;
      if (!groups.has(key)) {
        // Derive order from first template appearance index to keep stable if backend didn't include explicit ordering
        groups.set(key, { title: key, icon: cat.icon, color: cat.color, data: [], order: idx });
      }
      groups.get(key)!.data.push(t);
    });
    return Array.from(groups.values()).sort((a,b)=> a.order - b.order);
  }, [templates]);

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
  <CenterScaffold variant='auth' paddedTop={Math.max(insets.top, 60)}>
          <OnboardingHeader step={isPostCompletion ? 11 : 9} total={isPostCompletion ? 12 : 10} />
          <View style={styles.center}>
            {/* Espacio fijo para no tocar barra ni texto del header */}
            <View style={{ height: 96 }} />
            <H1 style={styles.title}>{t('complete.promptsTitleFriendly','Cuéntanos un poco sobre ti')}</H1>
            <P style={styles.subtitle}>{t('complete.promptsSubtitleFriendly','Elige cosas que te describan y con las que conectes. Tómalo con calma, es para que te conozcan mejor.')}</P>
            <GlassCard padding={16} elevationLevel={1} style={[styles.card, { marginBottom: 24 }]}>
              <View style={styles.topMetaRow}>
                <View style={styles.bigCounterPill}>
                  <P style={styles.bigCounterText}>{answeredQuestionsCount}/{MAX_TOTAL_CHOICES} {t('complete.promptsAnswered','respondidas')}</P>
                </View>
                <Button title={t('common.clearSelection', 'Vaciar selección')} variant="outline" onPress={toggleSkipAll} disabled={loading} />
              </View>
              {answeredQuestionsCount < 2 && (
                <P style={{ color: theme.colors.danger || '#F97066', fontSize: 12, marginTop: 4, fontWeight: '700' }}>
                  {t('complete.promptsMinTwo','Mínimo 2 para continuar')}
                </P>
              )}
              <SectionList
                sections={sections.map(s => ({ title: s.title, icon: s.icon, color: s.color, data: s.data }))}
                keyExtractor={(item) => item.key}
                style={{ maxHeight: 420 }}
                contentContainerStyle={{ paddingBottom: 24 }}
                renderSectionHeader={() => null}
                renderItem={({ item: pr }) => {
                  const val = answers[pr.key] ?? [];
                  const tKey = `complete.prompt.${pr.key}`;
                  // Prioridad: 1) título DB localizado (pr.question) 2) i18n clave 3) base original
                  // We intentionally avoid i18n resource fallback to prevent mixing languages; rely solely on DB.
                  const title = pr.question || pr.base || pr.key;
                  // Bloqueo global: máximo 10 preguntas respondidas. Se permite seguir añadiendo en
                  // una pregunta ya respondida, pero no iniciar una nueva si ya hay 10.
                  const blockNewForThisCard = answeredQuestionsCount >= MAX_TOTAL_CHOICES && val.length === 0;
                  return (
                    <PromptCard
                      title={title}
                      icon={pr.icon}
                      choices={pr.choices}
                      selected={val}
                      maxChoices={pr.max_choices || 1}
                      disableNewSelection={blockNewForThisCard}
                      translateChoice={(choiceKey) => (pr as any).choicesLabels && (pr as any).choicesLabels[choiceKey] ? (pr as any).choicesLabels[choiceKey] : t(`${tKey}.answers.${choiceKey}`, choiceKey)}
                      onToggle={(choiceKey) => setAnswers(a => {
                        const current = a[pr.key] || [];
                        const active = current.includes(choiceKey);
                        const maxC = pr.max_choices || 1;
                        if (active) {
                          const updated = current.filter(c => c !== choiceKey);
                          if (user?.id) enqueueTracking([{ user_id: user.id, prompt_template_id: pr.id, action: 'deselect', choice_key: choiceKey }]);
                          return { ...a, [pr.key]: updated };
                        }
                        if (!active && current.length >= maxC) return a;
                        // Nuevo límite global: máximo 10 preguntas respondidas (no selecciones)
                        const currentlyAnswered = Object.values(a).reduce((n, arr) => n + ((arr && (arr as any).length > 0) ? 1 : 0), 0);
                        const isStartingNewQuestion = current.length === 0;
                        if (isStartingNewQuestion && currentlyAnswered >= MAX_TOTAL_CHOICES) return a;
                        if (user?.id) enqueueTracking([{ user_id: user.id, prompt_template_id: pr.id, action: 'select', choice_key: choiceKey }]);
                        return { ...a, [pr.key]: [...current, choiceKey] };
                      })}
                    />
                  );
                }}
              />
            </GlassCard>
            <View style={{ height: 32 }} />
            {isWide && (
              <View style={styles.previewPaneWrapper}>
                <ProfilePreviewPane draft={{ ...draft, prompts: Object.entries(answers).map(([key, arr]) => ({ key, answers: arr })) }} />
              </View>
            )}
          </View>
          <StickyFooterActions
            actions={[
              { title: isPostCompletion ? t('common.continue','Continuar') : `${t('common.continue')} ${answeredQuestionsCount}/${MAX_TOTAL_CHOICES}`, onPress: saveAndContinue, disabled: answeredQuestionsCount < 2 },
              ...(isPostCompletion ? [] : [{ title: t('common.back'), onPress: () => { if (returnTo === 'hub') router.replace('(tabs)/profile' as any); else router.push('(auth)/complete/bio' as any); }, variant: 'outline' } as const])
            ]}
          />
  </CenterScaffold>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 24 },
  // progress header migrated to OnboardingHeader
  center: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 16 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: theme.colors.subtext, fontSize: 16, textAlign: 'center', marginHorizontal: 12, marginBottom: 8 },
  card: { width: '100%', maxWidth: 520, padding: theme.spacing(2), borderRadius: 16 },
  // legacy inline prompt styles removed after integrating PromptCard
  sectionHeader: { paddingTop: 8, paddingBottom: 4 },
  sectionHeaderText: { color: theme.colors.text, fontWeight:'700', fontSize:14, letterSpacing:0.3 },
  previewPaneWrapper: { position:'absolute', top: 100, right: 20, width: 320 },
  modalWrap: { display:'none' },
  topMetaRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 8 },
  counterPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.mode==='dark' ? 'rgba(255,255,255,0.06)' : '#F1F5F9', borderWidth: 1, borderColor: theme.colors.border },
  counterText: { color: theme.colors.textDim, fontSize: 12 },
  bigCounterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.mode==='dark' ? 'rgba(255,255,255,0.08)' : '#EEF2FF', borderWidth: 1, borderColor: (theme.mode==='dark' ? 'rgba(255,255,255,0.14)' : '#DDE3F0') },
  bigCounterText: { color: theme.colors.text, fontWeight:'700', fontSize: 14 }
});
