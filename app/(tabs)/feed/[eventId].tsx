import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Dimensions, Image, ActivityIndicator, Alert, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../lib/useAuth';
import { supabase } from '../../../lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS, cancelAnimation } from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { Screen } from '../../../components/ui';
// TopBar eliminado: usamos header global dinámico
import { theme } from '../../../lib/theme';
import { ensureMatchConsistency } from '../../../lib/match';
import { remainingSuperlikes, incSuperlike } from '../../../lib/superlikes';
import * as Haptics from 'expo-haptics';
import { SwipeButtons } from '../../../components/swipe/SwipeButtons';

interface ProfileRow { id: string; display_name: string | null; calculated_age?: number | null; gender?: string | null; interests?: string[] | null; avatar_url?: string | null; interested_in?: string[] | null; seeking?: string[] | null }
type CardProfile = {
  id: string;
  name: string;
  age: number | null;
  interests: string[]; // legacy (no longer displayed, will be removed later)
  avatar: string | null;
  gender: string | null;
  interested_in: string[];
  seeking: string[];
  photos: { id: number; url: string; sort_order: number }[];
  prompts?: { id: number; prompt_id: number; question?: string; response: any; key?: string; choices_labels?: Record<string,string>|null }[]; // added for chips
};

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
// Separadores para evitar que la imagen toque el header y la botonera tape el texto
// Ajustes de layout tras eliminar el TopBar local:
// Dejamos más espacio superior para que la carta baje y haya aire sobre los prompts,
// y subimos la capa de info (nombre + prompt) para que no se solape con la botonera.
const HEADER_SPACER = 8; // carta más pegada al header
const ACTION_BAR_SPACER = 150; // reserva para la botonera inferior
const RAW_CARD_HEIGHT = height * 0.72;
const EXTRA_TOP_OFFSET = 0; // eliminamos offset extra superior
const CARD_TOP_PADDING = HEADER_SPACER + 10 + EXTRA_TOP_OFFSET; // paddingTop del contenedor
const CARD_BOTTOM_PADDING = ACTION_BAR_SPACER; // paddingBottom del contenedor
const AVAILABLE_HEIGHT = height - CARD_TOP_PADDING - CARD_BOTTOM_PADDING;
let CARD_HEIGHT = Math.min(RAW_CARD_HEIGHT, AVAILABLE_HEIGHT - 8);
if (CARD_HEIGHT < 320) CARD_HEIGHT = Math.min(AVAILABLE_HEIGHT - 4, 320);
// Overlay adjunto a la carta: distancia desde el borde inferior interno de la carta
const INFO_OVERLAY_RAISE = 110;
const SWIPE_THRESHOLD_X = 110; // horizontal like / pass
const SWIPE_THRESHOLD_Y = 120; // vertical (up) superlike
const AUTO_ADVANCE = true; // feature flag para auto avance de fotos
const AUTO_ADVANCE_INTERVAL_MS = 4000; // 4s por foto
// Heurística "bordes + promoción" para distinguir swipe de foto vs swipe de carta:
//  - En la franja lateral (edge) inicial se interpretan arrastres horizontales como cambio de foto.
//  - Si el usuario continúa y supera una distancia de promoción, el gesto cambia (promoted) a swipe de carta.
//  - Fuera de los bordes siempre es swipe de carta (salvo vertical para superlike).
const EDGE_ZONE_RATIO = 0.28; // % del ancho reservado a navegación de fotos a cada lado
const PHOTO_SWIPE_DISTANCE = 60; // distancia incremental para pasar cada foto
const PROMOTE_DISTANCE = SWIPE_THRESHOLD_X * 0.52; // cuando se supera se convierte en swipe de carta
// UX Enhancements constants
const SUPERLIKE_ACTIVATION_Y = 40; // distancia vertical inicial para activar efectos
const SUPERLIKE_PARTICLES = 10;
const PARALLAX_FACTOR = -0.08; // multiplica translateX
const TUTORIAL_KEY = 'swipeTutorialDone:v1';
const TUTORIAL_ACTIONS_AUTO_DISMISS = 3;

// Segmento de progreso de foto (stories style con fill width)
const PhotoProgressSegment = React.memo(function PhotoProgressSegment({
  idx,
  activeIndex,
  progress,
  onPress
}: { idx: number; activeIndex: number; progress: any; onPress?: () => void }) {
  const [w, setW] = useState(0);
  const barStyle = useAnimatedStyle(() => {
    let fill = 0;
    if (idx < activeIndex) fill = 1;
    else if (idx === activeIndex) fill = progress.value;
    return { width: w * fill, opacity: idx <= activeIndex ? 1 : 0.45 };
  });
  return (
    <Pressable
      style={{ flex:1, height:6, borderRadius:3, backgroundColor:'#ffffff33', overflow:'hidden' }}
      onLayout={e => setW(e.nativeEvent.layout.width)}
      onPress={onPress}
      android_ripple={undefined}
      hitSlop={{ top:10, bottom:14 }}
    >
      <Animated.View pointerEvents='none' style={[{ position:'absolute', top:0, left:0, bottom:0, backgroundColor:'#fff' }, barStyle]} />
    </Pressable>
  );
});

export default function EventSwipeScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const eid = Number(eventId);
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();

  // Superlikes (máximo 3)
  const { data: remaining = 0, refetch: refetchRemaining } = useQuery({
    enabled: !!user,
    queryKey: ['superlikes-remaining-simple', user?.id],
    queryFn: async () => remainingSuperlikes(user!.id, 3)
  });

  interface SwipeQueryResult { profiles: CardProfile[]; boostSet: Set<string>; myInterests: string[] }
  const { data, isLoading, refetch } = useQuery<SwipeQueryResult>({
    enabled: !!user,
    queryKey: ['event-swipe-profiles', eid, user?.id],
  queryFn: async (): Promise<SwipeQueryResult> => {
      if (Number.isNaN(eid)) {
        console.warn('[event-swipe] eid es NaN');
        return { profiles: [], boostSet: new Set<string>(), myInterests: [] } as SwipeQueryResult;
      }

      // 1. Asistentes (excluyéndome)
      const { data: att, error: attErr } = await supabase
        .from('event_attendance')
        .select('user_id')
        .eq('event_id', eid)
        .eq('status', 'going');
      if (attErr) console.warn('[event-swipe] attendance error', attErr.message);
      const ids = (att || []).map(a => a.user_id).filter(id => id !== user!.id);
  if (!ids.length) return { profiles: [] as CardProfile[], boostSet: new Set<string>(), myInterests: [] } as SwipeQueryResult;

      // Normalización helpers
      const normalizeLabel = (raw?: string | null): string | null => {
        if (!raw) return null;
        const s = raw.toLowerCase().trim();
        if (['male','man','men','m','hombre','hombres','masculino','masculinos'].includes(s)) return 'male';
        if (['female','woman','women','f','mujer','mujeres','femenino','femeninos','femenina','femeninas'].includes(s)) return 'female';
        if ([ 'other','others','otro','otra','otros','otras','no binario','no-binario','nobinario','nonbinary','non-binary','non binary','nb','x','otro género','otro genero','otrx' ].includes(s)) return 'other';
        if (['everyone','all','cualquiera','todos','todas','any'].includes(s)) return '*';
        return s;
      };
      const normalizeArr = (arr?: string[] | null): string[] => {
        if (!Array.isArray(arr)) return [];
        return Array.from(new Set(arr.map(a => normalizeLabel(a)).filter(Boolean) as string[]));
      };

      // 2. Perfiles (primer intento .in)
      const { data: profsIn, error: profsInErr } = await supabase
        .from('profiles')
        .select('id, display_name, calculated_age, gender, avatar_url, interested_in, seeking')
        .in('id', ids);
      if (profsInErr) console.warn('[event-swipe] profiles .in error', profsInErr.message, { ids });
      let profilesSource: ProfileRow[] = profsIn || [];
      if (!profsInErr && profilesSource.length === 0 && ids.length > 0) {
        // Fallback individual
        const fallback: ProfileRow[] = [];
        for (const id of ids) {
          const { data: one, error: oneErr } = await supabase
            .from('profiles')
            .select('id, display_name, calculated_age, gender, avatar_url, interested_in, seeking')
            .eq('id', id)
            .maybeSingle();
          if (oneErr) {
            console.warn('[event-swipe] single profile error', id, oneErr.message);
          } else if (one) fallback.push(one as ProfileRow);
        }
        if (fallback.length) {
          profilesSource = fallback;
        }
      }

  // 2b. Intereses: cargar desde tabla puente profile_interests (mantenido para lógica de coincidencias, aunque ya no se muestran)
      let interestsMap = new Map<string, string[]>();
      // 2c. Fotos: cargar todas las fotos de los perfiles para carousel
      let photosMap = new Map<string, { id: number; url: string; sort_order: number }[]>();
      if (profilesSource.length) {
        const { data: photosRows, error: photosErr } = await supabase
          .from('user_photos')
          .select('id, user_id, url, sort_order')
          .in('user_id', profilesSource.map(p => p.id));
        if (photosErr) console.warn('[event-swipe] photos error', photosErr.message);
        (photosRows || []).forEach((r: any) => {
          if (!r.user_id) return;
          const arr = photosMap.get(r.user_id) || [];
          arr.push({ id: r.id, url: r.url, sort_order: r.sort_order ?? 0 });
          photosMap.set(r.user_id, arr);
        });
        photosMap.forEach((arr, k) => photosMap.set(k, arr.sort((a,b)=> (a.sort_order??0)-(b.sort_order??0))));
      }
      // 2d. Prompts (respuestas a plantillas) para cada perfil
  let promptsMap = new Map<string, { id: number; prompt_id: number; question?: string; response: any; key?: string; choices_labels?: Record<string,string>|null }[]>();
      if (profilesSource.length) {
        const { data: promptsRows, error: promErr } = await supabase
          .from('profile_prompts')
          .select('id, prompt_id, answer, profile_id, profile_prompt_templates(question, key, profile_prompt_template_locales(locale,title,choices_labels))')
          .in('profile_id', profilesSource.map(p => p.id));
        if (promErr) console.warn('[event-swipe] prompts error', promErr.message);
        function parseArrayLike(val: any): any {
          if (Array.isArray(val)) return val;
          if (typeof val === 'string') {
            const s = val.trim();
            if (s.startsWith('[') && s.endsWith(']')) { try { const parsed = JSON.parse(s); if (Array.isArray(parsed)) return parsed; } catch {} }
            if (s.startsWith('{') && s.endsWith('}')) {
              const inner = s.slice(1, -1);
              if (!inner) return [];
              const parts = inner.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g,''));
              return parts.filter(p => p.length > 0);
            }
          }
          return val;
        }
        (promptsRows || []).forEach((r: any) => {
          const arr = promptsMap.get(r.profile_id) || [];
          let resp = r.answer ?? '';
          resp = parseArrayLike(resp);
          // Preferimos título localizado (es) si existe
          let localizedQ: string | undefined = undefined;
          let choicesLabels: Record<string,string>|null = null;
          const locales = r.profile_prompt_templates?.profile_prompt_template_locales;
          if (Array.isArray(locales)) {
            const es = locales.find((l: any) => l?.locale === 'es');
            if (es?.title) localizedQ = es.title;
            if (es?.choices_labels && typeof es.choices_labels === 'object') choicesLabels = es.choices_labels;
            if (!localizedQ) {
              const en = locales.find((l:any)=> l?.locale==='en' && l.title);
              if (en?.title) localizedQ = en.title;
              if (!choicesLabels && en?.choices_labels && typeof en.choices_labels === 'object') choicesLabels = en.choices_labels;
            }
          }
          arr.push({ id: r.id, prompt_id: r.prompt_id, question: localizedQ || r.profile_prompt_templates?.question, response: resp, key: r.profile_prompt_templates?.key, choices_labels: choicesLabels });
          promptsMap.set(r.profile_id, arr);
        });
        // Ordenar por prompt_id (estable); se podría usar display_order si estuviera disponible
        promptsMap.forEach((arr, k) => promptsMap.set(k, arr.sort((a,b)=> a.prompt_id - b.prompt_id)));
      }
      const { data: interestRows, error: intErr } = await supabase
        .from('profile_interests')
        .select('profile_id, interests(name)')
        .in('profile_id', ids);
      if (intErr) console.warn('[event-swipe] interests error', intErr.message);
      (interestRows || []).forEach((r: any) => {
        const name = r.interests?.name;
        if (typeof name === 'string' && name.length > 0) {
          const arr = interestsMap.get(r.profile_id) || [];
          arr.push(name);
          interestsMap.set(r.profile_id, arr);
        }
      });
      // dedup
      interestsMap.forEach((arr, k) => interestsMap.set(k, Array.from(new Set(arr))));

      // Mis intereses (para destacar coincidencias) — consulta separada
      let myInterests: string[] = [];
      try {
        const { data: myRows, error: myErr } = await supabase
          .from('profile_interests')
          .select('interests(name)')
          .eq('profile_id', user!.id);
        if (myErr) console.warn('[event-swipe] myInterests error', myErr.message);
        (myRows || []).forEach((r: any) => { const n = r.interests?.name; if (typeof n === 'string' && n.length) myInterests.push(n); });
        myInterests = Array.from(new Set(myInterests));
      } catch (e:any) {
        console.warn('[event-swipe] myInterests fetch exception', e?.message);
      }

      const profiles: CardProfile[] = (profilesSource || []).map((p: ProfileRow) => ({
        id: p.id,
        name: p.display_name ?? 'Usuario',
        age: typeof p.calculated_age === 'number' ? p.calculated_age : null,
        interests: (interestsMap.get(p.id) || []).slice(0, 6), // legacy
        avatar: p.avatar_url || null,
        gender: normalizeLabel(p.gender) || null,
        interested_in: normalizeArr(p.interested_in),
        seeking: normalizeArr(p.seeking),
        photos: photosMap.get(p.id) || [],
        prompts: promptsMap.get(p.id) || []
      }));
      // 3. Decisiones previas (likes / passes / superlikes) GLOBALMENTE (cualquier evento)
      //     Antes se filtraba por context_event_id = eid, lo que hacía que si ya habías decidido sobre alguien en otro
      //     evento volviera a aparecer aquí => discrepancia con el contador del feed que trata decisiones como globales.
      //     Ahora: sólo buscamos likes donde el liked esté en los ids asistentes actuales (optimiza vs traer todos).
      const { data: likesRaw, error: likesErr } = await supabase
        .from('likes')
        .select('liked')
        .eq('liker', user!.id)
        .in('liked', ids);
      if (likesErr) console.warn('[event-swipe] likes error', likesErr.message);
      const decided = new Set<string>();
      (likesRaw || []).forEach(r => decided.add(r.liked));

      // 4. Boosters (quién me ha superlikeado)
      const { data: boosters, error: boostersErr } = await supabase
        .from('likes')
        .select('liker')
        .eq('liked', user!.id)
        .eq('type', 'superlike')
        .eq('context_event_id', eid);
      if (boostersErr) console.warn('[event-swipe] boosters error', boostersErr.message);
      const boostSet = new Set<string>((boosters || []).map(b => b.liker));

      // 5. Mi perfil (para aplicar filtro mutuo)
      const { data: meProfileRaw, error: meErr } = await supabase
        .from('profiles')
        .select('gender, interested_in, seeking')
        .eq('id', user!.id)
        .maybeSingle();
      if (meErr) console.warn('[event-swipe] me profile error', meErr.message);
      const gMe = normalizeLabel(meProfileRaw?.gender as string | null);
      const myInterestedIn: string[] = normalizeArr(meProfileRaw?.interested_in as any);
      const mySeeking: string[] = normalizeArr(meProfileRaw?.seeking as any); // actualmente no se usa para género

      const wants = (list: string[], other: string | null): boolean => {
        if (!other) return true;
        if (!list.length) return true;
        if (list.includes('*')) return true;
        return list.includes(other);
      };
      const hasMutual = (p: CardProfile): boolean => {
        const gOther = p.gender;
        if (!gMe || !gOther) return true; // permisivo si falta dato
        const iWant = wants(myInterestedIn, gOther);
        const otherWants = wants(p.interested_in, gMe);
        return iWant && otherWants;
      };

      // 6. Filtrar pendientes por no decididos + mutuo
      const RELAX_MUTUAL = false; // poner true si queremos volver a mostrar todos cuando mutuo=0
      let pending = profiles.filter(p => !decided.has(p.id) && hasMutual(p));
      if (RELAX_MUTUAL && profiles.length > 0 && pending.length === 0) {
        console.warn('[event-swipe] mutual produced 0; RELAX_MUTUAL enabled => showing non-decided all');
        pending = profiles.filter(p => !decided.has(p.id));
      }
      if (!RELAX_MUTUAL && profiles.length > 0 && pending.length === 0) {
        console.info('[event-swipe] mutual produced 0; not relaxing (consistent with outer pending=0)');
      }

      // 7. Orden determinista (sin shuffle) para evitar "flash" entre datos cacheados y refetch.
      //    Prioriza boosters primero y dentro de cada grupo ordena por display name (case-insensitive) y luego id.
      const boostersList = pending.filter(p => boostSet.has(p.id));
      const others = pending.filter(p => !boostSet.has(p.id));
      const collator = new Intl.Collator('es', { sensitivity:'base' });
      const sorter = (a: CardProfile, b: CardProfile) => {
        const na = a.name || '';
        const nb = b.name || '';
        const primary = collator.compare(na, nb);
        if (primary !== 0) return primary;
        return a.id.localeCompare(b.id);
      };
      boostersList.sort(sorter);
      others.sort(sorter);
      const ordered = [...boostersList, ...others];
      return { profiles: ordered, boostSet, myInterests } as SwipeQueryResult;
    }
  });

  const swipeData: SwipeQueryResult | undefined = data as SwipeQueryResult | undefined;
  const deck = swipeData?.profiles || [];
  const myInterestsSet = useMemo(() => new Set((swipeData?.myInterests) || []), [swipeData?.myInterests]);

  // Cola estable independiente del reorden del query para evitar flicker.
  const [uiDeck, setUiDeck] = useState<CardProfile[]>([]);
  const decidedRef = useRef<Set<string>>(new Set());
  // Sincronizar llegada del deck del servidor: inicializar o añadir nuevas.
  useEffect(() => {
    if (!deck) return;
    setUiDeck(prev => {
      if (!prev.length) {
        return deck.filter(p => !decidedRef.current.has(p.id));
      }
      const existing = new Set(prev.map(p => p.id));
      const additions = deck.filter(p => !existing.has(p.id) && !decidedRef.current.has(p.id));
      if (!additions.length) return prev; // no cambios
      return [...prev, ...additions];
    });
  }, [deck.map(p=>p.id).join('|')]);

  // Fallback: si uiDeck vacío pero server trae perfiles y ninguno está decidido (caso mismatch), rehidratar
  useEffect(() => {
    if (!uiDeck.length && deck.length) {
      const candidates = deck.filter(p => !decidedRef.current.has(p.id));
      if (candidates.length) setUiDeck(candidates);
    }
  }, [uiDeck.length, deck.length]);

  const current = uiDeck[0];
  const next = uiDeck[1];
  // índice de foto dentro de la carta actual
  const [photoIndex, setPhotoIndex] = useState(0);
  useEffect(()=>{ setPhotoIndex(0); }, [current?.id]);
  // Ref para saber si el usuario está arrastrando la carta (pausa auto-advance)
  const isDraggingRef = useRef(false);
  // Gestos: modo actual ('undecided' | 'photo' | 'card')
  const gestureModeRef = useRef<'undecided' | 'photo' | 'card'>('undecided');
  const startXRef = useRef<number | null>(null); // posición inicial dentro de la carta
  const lastPhotoCommitRef = useRef(0); // translationX donde se hizo el último cambio de foto
  const actionsCountRef = useRef(0);
  // Auto-advance (stories) con avance seguro a siguiente foto
  const photoAutoProgress = useSharedValue(0); // 0..1 fill
  const pauseRef = useRef(false);
  const startTsRef = useRef(0);
  const totalDurationRef = useRef(AUTO_ADVANCE_INTERVAL_MS);
  const remainingRef = useRef(AUTO_ADVANCE_INTERVAL_MS);

  const launchProgress = useCallback(() => {
    cancelAnimation(photoAutoProgress);
    if (!AUTO_ADVANCE) { photoAutoProgress.value = 1; return; }
    if (!current || !current.photos || current.photos.length <= 1) { photoAutoProgress.value = 1; return; }
    const last = photoIndex >= current.photos.length - 1;
    if (last) { photoAutoProgress.value = 1; return; }
    pauseRef.current = false;
    photoAutoProgress.value = 0;
    totalDurationRef.current = AUTO_ADVANCE_INTERVAL_MS;
    remainingRef.current = AUTO_ADVANCE_INTERVAL_MS;
    startTsRef.current = Date.now();
    const baseIndex = photoIndex; // capturamos índice actual
    photoAutoProgress.value = withTiming(1, { duration: remainingRef.current }, (finished) => {
      if (finished) runOnJS(setPhotoIndex)(baseIndex + 1);
    });
  }, [current?.id, current?.photos?.length, photoIndex]);

  useEffect(() => { launchProgress(); }, [current?.id, photoIndex, current?.photos?.length]);

  const pausePhotoProgress = useCallback(() => {
    if (pauseRef.current) return;
    if (!AUTO_ADVANCE) return;
    if (!current || !current.photos || current.photos.length <= 1) return;
    const last = photoIndex >= current.photos.length - 1;
    if (last) return;
    pauseRef.current = true;
    const elapsed = Date.now() - startTsRef.current;
    const progress = photoAutoProgress.value; // valor actual
    cancelAnimation(photoAutoProgress);
    remainingRef.current = Math.max(16, (1 - progress) * totalDurationRef.current);
  }, [current?.photos?.length, photoIndex]);

  const resumePhotoProgress = useCallback(() => {
    if (!pauseRef.current) return;
    if (!AUTO_ADVANCE) return;
    const last = photoIndex >= (current?.photos?.length || 0) - 1;
    if (last) { photoAutoProgress.value = 1; return; }
    pauseRef.current = false;
    startTsRef.current = Date.now();
    const baseIndex = photoIndex;
    photoAutoProgress.value = withTiming(1, { duration: remainingRef.current }, (finished) => {
      if (finished) runOnJS(setPhotoIndex)(baseIndex + 1);
    });
  }, [current?.photos?.length, photoIndex]);

  // Prefetch del siguiente avatar
  useEffect(() => {
    // Prefetch avatar next
    if (next?.avatar) Image.prefetch(next.avatar).catch(()=>{});
    // Prefetch fotos de siguiente perfil
    (next?.photos || []).slice(0,3).forEach((p: { url: string }) => { if (p.url) Image.prefetch(p.url).catch(()=>{}); });
  }, [next?.avatar, next?.photos]);

  // Animación / gesto
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const superProgress = useSharedValue(0); // 0..1 durante arrastre vertical

  const resetCard = () => {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    superProgress.value = 0;
  };
  const advance = () => {
    setUiDeck(prev => prev.slice(1));
  };

  // Overlay match
  const [match, setMatch] = useState<{ targetId: string; matchId: string | number } | null>(null);

  // Evitar doble tap/gesture spam
  const busyRef = useRef(false);

  const performAction = useCallback(async (targetId: string, type: 'like' | 'pass' | 'superlike') => {
    if (!user) return;
    if (busyRef.current) return; // throttle
    busyRef.current = true;
    if (type === 'superlike' && remaining <= 0) {
      Alert.alert('Límite alcanzado', 'Has usado tus 3 superlikes de hoy.');
      resetCard();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{});
      busyRef.current = false;
      return;
    }
    // Marcar decidida localmente y quitar de uiDeck de inmediato (sin flicker)
    decidedRef.current.add(targetId);
    advance();
    // Reset anim vars para la nueva primera carta
    translateX.value = 0; translateY.value = 0; superProgress.value = 0;
    // Optimistic: decrementar contador de pendientes del evento en cache feed
    try {
      qc.setQueryData<any[]>(['my-feed-events-with-pending', user.id], (old) => {
        if (!Array.isArray(old)) return old;
        return old.map(ev => ev.id === eid ? { ...ev, pending: Math.max(0, (ev.pending || 0) - 1) } : ev);
      });
    } catch {}
    try {
      // Haptics según tipo
      if (type === 'pass') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
      else if (type === 'like') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
      else if (type === 'superlike') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(()=>{});

    const payload = { liker: user.id, liked: targetId, type, created_at: new Date().toISOString(), context_event_id: eid };
    await supabase.from('likes').upsert(payload, { onConflict: 'liker,liked,context_event_id' });
    if (type === 'superlike') { await incSuperlike(user.id); refetchRemaining(); }
    if (type === 'like' || type === 'superlike') {
      const { matched, matchId } = await ensureMatchConsistency(user.id, targetId);
      if (matched && matchId != null) setMatch({ targetId, matchId });
    }
    qc.invalidateQueries({ queryKey: ['event-swipe-profiles', eid, user?.id] });
    } finally {
      actionsCountRef.current += 1;
      if (tutorialVisibleRef.current && actionsCountRef.current >= TUTORIAL_ACTIONS_AUTO_DISMISS) {
        runOnJS(dismissTutorial)();
      }
      setTimeout(()=>{ busyRef.current = false; }, 120); // pequeña ventana para evitar spam
    }
  }, [user, remaining, eid]);

  // Realtime: si cambia asistencia del evento, refrescar deck
  useEffect(() => {
    if (!eid) return;
    const ch = supabase
      .channel(`event-attendance-${eid}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'event_attendance', filter:`event_id=eq.${eid}` }, () => refetch())
      .on('postgres_changes', { event:'DELETE', schema:'public', table:'event_attendance', filter:`event_id=eq.${eid}` }, () => refetch());
    return () => { supabase.removeChannel(ch); };
  }, [eid, refetch]);

  // Refresco periódico liviano (por si hay nuevos asistentes / superlikes sin interacción)
  useEffect(() => {
    const id = setInterval(() => { refetch(); refetchRemaining(); }, 45000);
    return () => clearInterval(id);
  }, [refetch, refetchRemaining]);

  const cardStyle = useAnimatedStyle(() => {
    const rawAngle = translateX.value / 18;
    const clamped = Math.max(-12, Math.min(12, rawAngle)); // limitar rotación para evitar que sobresalga por arriba
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${clamped}deg` }
      ]
    };
  });
  const likeOpacityStyle = useAnimatedStyle(() => ({ opacity: translateX.value > 0 ? Math.min(1, translateX.value / SWIPE_THRESHOLD_X) : 0 }));
  const nopeOpacityStyle = useAnimatedStyle(() => ({ opacity: translateX.value < 0 ? Math.min(1, -translateX.value / SWIPE_THRESHOLD_X) : 0 }));
  const superOpacityStyle = useAnimatedStyle(() => ({ opacity: translateY.value < 0 ? Math.min(1, -translateY.value / SWIPE_THRESHOLD_Y) : 0 }));
  const parallaxStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value * PARALLAX_FACTOR }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: superProgress.value,
    transform: [ { scale: 0.8 + superProgress.value * 0.6 } ]
  }));

  // Partículas superlike
  const particles = useMemo(() => Array.from({ length: SUPERLIKE_PARTICLES }).map((_, i) => ({
    id: i,
    offsetX: (Math.random() * 140) - 70,
    delay: Math.random() * 0.25,
    height: 140 + Math.random()*60,
    size: 8 + Math.random()*10
  })), []);
  // useAnimatedStyle is a React Hook; calling it inside map trips rules-of-hooks.
  // In this case the particle count is constant and stable during renders.
  // We intentionally suppress the lint error to avoid a larger refactor before build.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const particleStyles = particles.map(p => useAnimatedStyle(() => {
    const prog = superProgress.value;
    const local = Math.max(0, prog - p.delay) / (1 - p.delay || 1);
    const clamped = Math.min(1, Math.max(0, local));
    return {
      opacity: clamped > 0.05 ? (1 - clamped) : 0,
      transform: [
        { translateY: -clamped * p.height },
        { translateX: p.offsetX * (1 - clamped) },
        { scale: 0.6 + clamped * 0.8 }
      ]
    };
  }));

  // (Eliminado efecto anterior de progress; ahora gestionado por startProgressAnimation)

  const onGestureEvent = ({ nativeEvent }: any) => { translateX.value = nativeEvent.translationX; translateY.value = nativeEvent.translationY; };
  const onEnd = ({ nativeEvent }: any) => {
    const { translationX, translationY } = nativeEvent;
    // Fin de gesto
    isDraggingRef.current = false;
    const mode = gestureModeRef.current;
    // Superlike vertical siempre evaluado (independiente del modo)
    if (translationY < -SWIPE_THRESHOLD_Y && current) {
      translateY.value = withTiming(-height, { duration:250 }, () => runOnJS(performAction)(current.id, 'superlike'));
      gestureModeRef.current = 'undecided';
      startXRef.current = null;
      lastPhotoCommitRef.current = 0;
      return;
    }
    if (mode === 'card') {
      if (translationX > SWIPE_THRESHOLD_X && current) { translateX.value = withTiming(width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'like')); } 
      else if (translationX < -SWIPE_THRESHOLD_X && current) { translateX.value = withTiming(-width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'pass')); } 
      else { resetCard(); }
    } else {
      // modo 'photo' no promovido: simplemente reset
      resetCard();
    }
    gestureModeRef.current = 'undecided';
    startXRef.current = null;
    lastPhotoCommitRef.current = 0;
  };
  // Hook gestures start: usar PanGestureHandler 'onGestureEvent' para detectar inicio (cuando supere pequeño umbral)
  const handleGestureEvent = useCallback((evt: any) => {
    const { translationX, translationY, x } = evt.nativeEvent;
    if (!isDraggingRef.current && (Math.abs(translationX) > 6 || Math.abs(translationY) > 6)) {
      isDraggingRef.current = true;
    }
    const photosLen = current?.photos?.length || 0;
    // Registrar start X
    if (startXRef.current == null && typeof x === 'number') startXRef.current = x;
    const mode = gestureModeRef.current;
    const horizontalDominant = Math.abs(translationX) > Math.abs(translationY);
    // Decidir modo si aún no
    if (mode === 'undecided') {
      if (horizontalDominant && photosLen > 1 && startXRef.current != null) {
        const EDGE_ZONE_PX = CARD_WIDTH * EDGE_ZONE_RATIO;
        const inEdge = startXRef.current < EDGE_ZONE_PX || startXRef.current > (CARD_WIDTH - EDGE_ZONE_PX);
        gestureModeRef.current = inEdge ? 'photo' : 'card';
        if (gestureModeRef.current === 'photo') {
          lastPhotoCommitRef.current = 0; // baseline
        }
      } else {
        gestureModeRef.current = 'card';
      }
    }
    // PHOTO MODE logic
    if (gestureModeRef.current === 'photo') {
      // Promoción a swipe de carta si excede distancia total (ignora cambios de foto intermedios)
      if (Math.abs(translationX) >= PROMOTE_DISTANCE) {
        gestureModeRef.current = 'card';
        translateX.value = translationX; // adoptamos desplazamiento acumulado
        translateY.value = translationY;
        return;
      }
      // Cambios incrementales de foto
      const delta = translationX - lastPhotoCommitRef.current;
      if (delta > PHOTO_SWIPE_DISTANCE) {
        // arrastre a la derecha => foto anterior
        setPhotoIndex(idx => {
          const nextIdx = idx - 1;
            return nextIdx < 0 ? 0 : nextIdx;
        });
        lastPhotoCommitRef.current = translationX;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
      } else if (delta < -PHOTO_SWIPE_DISTANCE) {
        // arrastre a la izquierda => siguiente
        setPhotoIndex(idx => {
          const nextIdx = idx + 1;
          return nextIdx >= photosLen ? photosLen - 1 : nextIdx;
        });
        lastPhotoCommitRef.current = translationX;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
      }
      // No movemos la carta mientras estemos en modo foto
      translateX.value = 0; translateY.value = 0;
      return;
    }
    // CARD MODE
    translateX.value = translationX; translateY.value = translationY;
    // Superlike progress update
    superProgress.value = translationY < -SUPERLIKE_ACTIVATION_Y ? Math.min(1, Math.abs(translationY) / SWIPE_THRESHOLD_Y) : 0;
  }, [current?.photos?.length]);

  // Traducciones rápidas EN->ES para preguntas y respuestas (fallback si backend trae inglés)
  const PROMPT_Q_MAP: Record<string,string> = {
    'Describe your personality':'Describe tu personalidad',
    'What is your perfect plan?':'¿Cuál es tu plan perfecto?',
    'Two truths and one lie':'Dos verdades y una mentira',
    "The most spontaneous thing you've done":'Lo más espontáneo que has hecho'
  };
  const PROMPT_A_MAP: Record<string,string> = {
    creative:'Creativa', adventurous:'Aventurera', analytical:'Analítica', empathetic:'Empática', funny:'Divertida', ambitious:'Ambiciosa',
    coffeeChat:'Charla con café', museumVisit:'Visitar un museo', hikingNature:'Senderismo', cookingTogether:'Cocinar juntos', liveMusic:'Música en vivo', movieMarathon:'Maratón de pelis',
    traveled10:'Viajé a 10 países', playsInstrument:'Toco un instrumento', climbedVolcano:'Subí un volcán', polyglot:'Soy políglota', ranMarathon:'Corrí una maratón', neverOnPlane:'Nunca volé en avión',
    lastMinuteTrip:'Viaje improvisado', boughtConcert:'Entradas de concierto última hora', changedCareer:'Cambio de carrera repentino', movedCity:'Mudanza inesperada', dancedRain:'Bailé bajo la lluvia', randomRoadtrip:'Roadtrip aleatorio'
  };
  const PROMPT_KEY_Q_MAP: Record<string,string> = {
    myPersonality:'Describe tu personalidad',
    myPerfectPlan:'¿Cuál es tu plan perfecto?',
    twoTruthsOneLie:'Dos verdades y una mentira',
    theMostSpontaneous:'Lo más espontáneo que has hecho'
  };
  const tPromptQ = (q?: string, key?: string) => (key && PROMPT_KEY_Q_MAP[key]) || (q && PROMPT_Q_MAP[q]) || q || '';
  const tAnswer = (val: any, customMap?: Record<string,string>|null) => {
    const mapLookup = (v: any) => (customMap && customMap[v]) || PROMPT_A_MAP[v] || String(v);
    if (Array.isArray(val)) return val.map(mapLookup).join(', ');
    return mapLookup(String(val));
  };

  // --- Prompt único sin repetición ---
  // Regla nueva: si hay más fotos que prompts, las fotos sobrantes NO muestran prompt (sin wrap). Si hay más prompts
  // que fotos sólo se muestran tantos como fotos. Para variar el orden entre usuarios usamos un shuffle determinista.
  const hashId = (id: string) => { let h = 0; for (let i=0;i<id.length;i++) { h = (h * 131 + id.charCodeAt(i)) >>> 0; } return h; };
  const promptOrder = useMemo(() => {
    if (!current?.prompts) return [] as any[];
    const valid = current.prompts.filter(p => {
      if (!p) return false; const r = p.response; if (Array.isArray(r)) return r.length>0; if (typeof r === 'string') return r.trim().length>0; return r != null && String(r).trim().length>0; });
    if (valid.length <= 1) return valid;
    // Seeded Fisher-Yates
    const seedBase = hashId(current.id) || 1;
    let seed = seedBase;
    const nextRand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
    const arr = [...valid];
    for (let i = arr.length -1; i>0; i--) {
      const r = Math.floor(nextRand() * (i+1));
      [arr[i], arr[r]] = [arr[r], arr[i]];
    }
    return arr;
  }, [current?.id, current?.prompts]);
  const currentPrompt = (photoIndex < promptOrder.length) ? promptOrder[photoIndex] : null;
  const renderSinglePrompt = () => {
    if (!currentPrompt) return null;
    const respRaw = currentPrompt.response;
    const isArray = Array.isArray(respRaw);
  const answerText = !isArray ? tAnswer(String(respRaw).trim(), (currentPrompt as any).choices_labels) : '';
    return (
      <View style={{ marginTop:8, alignSelf:'flex-start', maxWidth:'92%' }}>
        {currentPrompt.question && (
          <Text style={{ color:'#fff', fontSize:12, fontWeight:'700', opacity:0.9, marginBottom:4 }} numberOfLines={2}>
            {tPromptQ(currentPrompt.question, (currentPrompt as any).key)}
          </Text>
        )}
        {isArray ? (
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
            {respRaw.slice(0,6).map((opt: any, i: number) => (
              <View key={i} style={{ backgroundColor:'rgba(0,0,0,0.45)', paddingHorizontal:10, paddingVertical:5, borderRadius:14 }}>
                <Text style={{ color:'#fff', fontSize:11.5, fontWeight:'600' }} numberOfLines={1}>{tAnswer(opt, (currentPrompt as any).choices_labels)}</Text>
              </View>
            ))}
            {respRaw.length > 6 && (
              <View style={{ backgroundColor:'rgba(0,0,0,0.45)', paddingHorizontal:10, paddingVertical:5, borderRadius:14 }}>
                <Text style={{ color:'#fff', fontSize:11.5, fontWeight:'600' }}>+{respRaw.length-6}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={{ color:'#fff', fontSize:14, fontWeight:'600' }} numberOfLines={3}>{answerText}</Text>
        )}
      </View>
    );
  };

  // Booster tooltip (primera vez en la sesión)
  const boosterTipShownRef = useRef(false);
  const [showBoosterTip, setShowBoosterTip] = useState(false);
  useEffect(() => {
  if (current && swipeData?.boostSet?.has(current.id) && !boosterTipShownRef.current) {
      boosterTipShownRef.current = true;
      setShowBoosterTip(true);
      const t = setTimeout(()=> setShowBoosterTip(false), 3200);
      return () => clearTimeout(t);
    } else if (!current) {
      setShowBoosterTip(false);
    }
  }, [current?.id, (data as any)?.boostSet]);

  // Tutorial primeras acciones
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const tutorialVisibleRef = useRef(false);
  const dismissTutorial = useCallback(() => {
    setTutorialVisible(false); tutorialVisibleRef.current = false;
  }, []);
  useEffect(() => {
    // Mostramos tutorial sólo una vez por sesión (in-memory)
    if (!tutorialVisibleRef.current) {
      setTutorialVisible(true); tutorialVisibleRef.current = true;
    }
  }, []);

  // Info fija (eliminado modo expandible para no interferir con taps laterales)

  // Eliminado: info expandida (gender / seeking / interested_in / photos count) para simplificar la tarjeta.
  const renderExpandedInfo = () => null;

  const EmptyState = () => (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:32 }}>
      <View style={{ width:140, height:140, marginBottom:12, opacity:0.9 }}>
        <Image source={require('../../../assets/unmatched.png')} style={{ width:'100%', height:'100%', tintColor: theme.colors.primary, opacity:0.85 }} resizeMode='contain' />
      </View>
      <Text style={{ color: theme.colors.text, fontSize:20, fontWeight:'800', marginBottom:8 }}>No hay más personas</Text>
      <Text style={{ color: theme.colors.subtext, textAlign:'center', marginBottom:24 }}>Cuando haya más asistentes compatibles aparecerán aquí. Mientras tanto puedes explorar otros eventos.</Text>
      <View style={{ flexDirection:'row', gap:14, flexWrap:'wrap', justifyContent:'center' }}>
        <Pressable onPress={() => refetch()} style={({pressed})=>({ paddingHorizontal:22, paddingVertical:13, borderRadius:30, backgroundColor: pressed? theme.colors.primary: theme.colors.card, borderWidth:1, borderColor: theme.colors.primary })}>
          <Text style={{ color: theme.colors.primary, fontWeight:'700' }}>Recargar</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={({pressed})=>({ paddingHorizontal:22, paddingVertical:13, borderRadius:30, backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border })}>
          <Text style={{ color: theme.colors.text, fontWeight:'700' }}>Volver</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/')} style={({pressed})=>({ paddingHorizontal:22, paddingVertical:13, borderRadius:30, backgroundColor: theme.colors.primary, borderWidth:1, borderColor: theme.colors.primary })}>
          <Text style={{ color: theme.colors.primaryText || '#fff', fontWeight:'700' }}>Explorar eventos</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen style={{ padding:0 }}>
      {isLoading && (
        <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}
      {!isLoading && !current && <EmptyState />}
      {!isLoading && current && (
        <View style={{ flex:1, alignItems:'center', paddingTop: CARD_TOP_PADDING, paddingBottom: ACTION_BAR_SPACER }}>
          {next && (
            <View pointerEvents='none' style={{ position:'absolute', top: CARD_TOP_PADDING, width:CARD_WIDTH, height:CARD_HEIGHT, borderRadius:24, overflow:'hidden', backgroundColor: theme.colors.card, opacity:0.4 }} />
          )}
          <PanGestureHandler onGestureEvent={handleGestureEvent} onEnded={onEnd}>
            <Animated.View style={[{ width:CARD_WIDTH, height:CARD_HEIGHT, borderRadius:24, overflow:'hidden', backgroundColor: theme.colors.card }, cardStyle]}>
              {/* Carousel de fotos */}
              <View style={{ flex:1 }}>
                {current.photos && current.photos.length > 0 ? (
                  <Animated.Image
                    key={current.photos[photoIndex]?.id || 'main'}
                    source={{ uri: current.photos[photoIndex]?.url || current.avatar || '' }}
                    style={[{ flex:1 }, parallaxStyle]}
                    resizeMode='cover'
                  />
                ) : current.avatar ? (
                  <Image source={{ uri: current.avatar }} style={{ flex:1 }} resizeMode='cover' />
                ) : (
                  <View style={{ flex:1, backgroundColor: theme.colors.border, alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ color: theme.colors.subtext }}>Sin foto</Text>
                  </View>
                )}
                {/* Controles para cambiar foto (toques laterales) */}
                {current.photos && current.photos.length > 1 && (
                  <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0 }}>
                    <Pressable
                      onPress={() => setPhotoIndex(i => i <= 0 ? 0 : i - 1)}
                      style={{ position:'absolute', top:0, bottom:0, left:0, width:'30%' }}
                      android_ripple={{ color:'#00000022' }}
                    />
                    <Pressable
                      onPress={() => setPhotoIndex(i => i >= current.photos.length -1 ? i : i + 1)}
                      style={{ position:'absolute', top:0, bottom:0, right:0, width:'30%' }}
                      android_ripple={{ color:'#00000022' }}
                    />
                    {/* Indicadores estilo stories (full width) */}
                    <View style={{ position:'absolute', top:8, left:8, right:8, flexDirection:'row', gap:4 }}>
                      {current.photos.map((p: { id: number }, idx: number) => (
                        <PhotoProgressSegment
                          key={p.id}
                          idx={idx}
                          activeIndex={photoIndex}
                          progress={photoAutoProgress}
                          onPress={() => {
                            if (idx === photoIndex) return;
                            cancelAnimation(photoAutoProgress);
                            setPhotoIndex(idx);
                          }}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
              {/* Pausa al mantener pulsado (zona central, desplazada para no cubrir la barra de progreso) */}
              {current.photos && current.photos.length > 1 && (
                <View
                  style={{ position:'absolute', top:40, bottom:0, left:'32%', right:'32%' }}
                  onStartShouldSetResponder={() => true}
                  onResponderGrant={pausePhotoProgress}
                  onResponderRelease={resumePhotoProgress}
                  pointerEvents='box-only'
                />
              )}
              {/* Superlike efectos */}
              <Animated.View pointerEvents='none' style={[{ position:'absolute', top:0, left:0, right:0, bottom:0, justifyContent:'center', alignItems:'center' }, haloStyle]}>
                <View style={{ width:220, height:220, borderRadius:110, backgroundColor: theme.colors.primary, opacity:0.15 }} />
                <View style={{ position:'absolute', width:160, height:160, borderRadius:80, backgroundColor: theme.colors.primary, opacity:0.18 }} />
                {particleStyles.map((st, i) => (
                  <Animated.View key={i} style={[{ position:'absolute', bottom:'40%', width: particles[i].size, height: particles[i].size, borderRadius:999, backgroundColor: theme.colors.primary }, st]} />
                ))}
              </Animated.View>
              {/* Labels */}
              <Animated.View pointerEvents='none' style={[{ position:'absolute', top:30, left:20, paddingHorizontal:16, paddingVertical:8, borderWidth:4, borderColor: theme.colors.success || '#3ba65b', borderRadius:8, transform:[{ rotate:'-15deg' }] }, likeOpacityStyle]}>
                <Text style={{ color: theme.colors.success || '#3ba65b', fontSize:28, fontWeight:'800' }}>LIKE</Text>
              </Animated.View>
              <Animated.View pointerEvents='none' style={[{ position:'absolute', top:30, right:20, paddingHorizontal:16, paddingVertical:8, borderWidth:4, borderColor: '#d9534f', borderRadius:8, transform:[{ rotate:'15deg' }] }, nopeOpacityStyle]}>
                <Text style={{ color: '#d9534f', fontSize:28, fontWeight:'800' }}>NOPE</Text>
              </Animated.View>
              <Animated.View pointerEvents='none' style={[{ position:'absolute', top:80, alignSelf:'center', paddingHorizontal:18, paddingVertical:10, borderWidth:4, borderColor: theme.colors.primary, borderRadius:999, backgroundColor:'rgba(0,0,0,0.25)' }, superOpacityStyle]}>
                <Text style={{ color: theme.colors.primary, fontSize:24, fontWeight:'800' }}>SUPER</Text>
              </Animated.View>
              {/* Overlay de info dentro de la carta (se mueve con la animación) */}
              <View pointerEvents='none' style={{ position:'absolute', left:0, right:0, bottom:INFO_OVERLAY_RAISE, paddingHorizontal:18, paddingBottom:18, paddingTop:12 }}>
                <Text style={{ color:'#fff', fontSize:22, fontWeight:'800', textShadowColor:'rgba(0,0,0,0.55)', textShadowOffset:{ width:0, height:1 }, textShadowRadius:4 }} numberOfLines={1}>
                  {current.name}{current.age?`, ${current.age}`:''}
                </Text>
                <View style={{ marginTop:6, maxWidth:'92%' }}>
                  {renderSinglePrompt()}
                </View>
              </View>
            </Animated.View>
          </PanGestureHandler>
      {showBoosterTip && current && (
            <View style={{ position:'absolute', top: CARD_TOP_PADDING - 32, alignSelf:'center', backgroundColor: theme.colors.primary, paddingHorizontal:14, paddingVertical:8, borderRadius:20, shadowColor:'#000', shadowOpacity:0.3, shadowRadius:6 }}>
              <Text style={{ color: theme.colors.primaryText || '#fff', fontSize:12, fontWeight:'700' }}>Te dio SUPERLIKE ⭐</Text>
            </View>
          )}
        </View>
      )}
      {/* Botonera inferior accesible */}
      {current && !isLoading && (
        <View pointerEvents='box-none' style={{ position:'absolute', left:0, right:0, bottom:0 }}>
          <SwipeButtons
            onPass={() => current && performAction(current.id, 'pass')}
            onLike={() => current && performAction(current.id, 'like')}
            onSuperLike={() => current && performAction(current.id, 'superlike')}
            remaining={remaining}
          />
        </View>
      )}
      {match && (
        <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.65)', justifyContent:'center', alignItems:'center', padding:32 }}>
          <View style={{ backgroundColor: theme.colors.card, padding:24, borderRadius:24, width:'80%', maxWidth:400, alignItems:'center', gap:12 }}>
            <Text style={{ color: theme.colors.text, fontSize:26, fontWeight:'800' }}>¡Match!</Text>
            <Text style={{ color: theme.colors.subtext, textAlign:'center' }}>Se han gustado mutuamente. ¿Abrir el chat ahora?</Text>
            <View style={{ flexDirection:'row', gap:12, marginTop:8 }}>
              <Pressable onPress={() => { setMatch(null); }} style={({pressed})=>({ paddingVertical:12, paddingHorizontal:20, borderRadius:30, backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border })}>
                <Text style={{ color: theme.colors.text, fontWeight:'700' }}>Seguir</Text>
              </Pressable>
              <Pressable onPress={() => { const { matchId } = match; setMatch(null); router.push(`/(tabs)/chat/${matchId}`); }} style={({pressed})=>({ paddingVertical:12, paddingHorizontal:20, borderRadius:30, backgroundColor: theme.colors.primary, borderWidth:1, borderColor: theme.colors.primary })}>
                <Text style={{ color: theme.colors.primaryText || '#fff', fontWeight:'700' }}>Ir al chat</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      {tutorialVisible && (
        <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.65)' }}>
          <View style={{ flex:1 }}>
            <View style={{ position:'absolute', top: CARD_TOP_PADDING + 40, left:20, right:20, backgroundColor:'#111c', padding:16, borderRadius:16 }}>
              <Text style={{ color:'#fff', fontSize:16, fontWeight:'700', marginBottom:6 }}>Cómo funciona</Text>
              <Text style={{ color:'#fff', fontSize:13, marginBottom:4 }}>→ Arrastra a la derecha para LIKE</Text>
              <Text style={{ color:'#fff', fontSize:13, marginBottom:4 }}>← Arrastra a la izquierda para descartar</Text>
              <Text style={{ color:'#fff', fontSize:13, marginBottom:4 }}>↑ Arrastra hacia arriba para SUPERLIKE</Text>
              <Text style={{ color:'#fff', fontSize:13, marginBottom:8 }}>Toca los lados para cambiar foto</Text>
              <Pressable onPress={dismissTutorial} style={({pressed})=>({ alignSelf:'flex-end', paddingHorizontal:18, paddingVertical:10, borderRadius:24, backgroundColor: pressed? theme.colors.primary : theme.colors.primary, shadowColor:'#000', shadowOpacity:0.3, shadowRadius:6 })}>
                <Text style={{ color: theme.colors.primaryText || '#fff', fontWeight:'700' }}>Entendido</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </Screen>
  );
}
