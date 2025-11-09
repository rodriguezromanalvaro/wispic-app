import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';

import { View, Text, Dimensions, Image, ActivityIndicator, Alert, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS, cancelAnimation } from 'react-native-reanimated';

import EmptyState from 'components/EmptyState';
import { YStack } from 'components/tg';
import { Screen } from 'components/ui';
import { SwipeButtons } from 'features/profile/ui/swipe/SwipeButtons';
import { SWIPE } from 'features/swipe/constants';

// lib imports alphabetized
import { truncateByGraphemes } from 'lib/graphemes';
import { i18n } from 'lib/i18n';
import { ensureMatchConsistency } from 'lib/match';
import { ensurePresence, useOnlineIds } from 'lib/presence';
import { getLocaleChain, pickFirstNonEmptyTitle, mergeChoiceLabels } from 'lib/promptLocale';
import { remainingSuperlikes, incSuperlike } from 'lib/superlikes';
import { supabase } from 'lib/supabase';
import { theme } from 'lib/theme';
import { formatDistanceKm } from 'lib/ui/formatDistance';
import { prefixIcon } from 'lib/ui/prefixIcon';
import { useAuth } from 'lib/useAuth';

interface ProfileRow { id: string; display_name: string | null; bio?: string | null; calculated_age?: number | null; gender?: string | null; interests?: string[] | null; avatar_url?: string | null; interested_in?: string[] | null; seeking?: string[] | null }
type CardProfile = {
  id: string;
  name: string;
  age: number | null;
  bio?: string | null;
  interests: string[];
  avatar: string | null;
  gender: string | null;
  interested_in: string[];
  seeking: string[];
  photos: { id: number; url: string; sort_order: number }[];
  prompts?: { id: number; prompt_id: number; question?: string; response: any; key?: string; choices_labels?: Record<string,string>|null; icon?: string | null }[];
  distanceKm?: number | null;
};

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width;
const HEADER_SPACER = 8;
const ACTION_BAR_SPACER = 150;
const RAW_CARD_HEIGHT = height * 0.72;
const EXTRA_TOP_OFFSET = 0;
const CARD_TOP_PADDING = HEADER_SPACER + 10 + EXTRA_TOP_OFFSET;
const CARD_BOTTOM_PADDING = ACTION_BAR_SPACER;
const AVAILABLE_HEIGHT = height - CARD_TOP_PADDING - CARD_BOTTOM_PADDING;
let CARD_HEIGHT = AVAILABLE_HEIGHT;
const INFO_OVERLAY_RAISE = SWIPE.INFO_OVERLAY_RAISE;
const SWIPE_THRESHOLD_X = SWIPE.SWIPE_THRESHOLD_X;
const SWIPE_THRESHOLD_Y = SWIPE.SWIPE_THRESHOLD_Y;
const AUTO_ADVANCE = SWIPE.AUTO_ADVANCE;
const AUTO_ADVANCE_INTERVAL_MS = SWIPE.AUTO_ADVANCE_INTERVAL_MS;
const EDGE_ZONE_RATIO = SWIPE.CARD_EDGE_ZONE_RATIO;
const PHOTO_SWIPE_DISTANCE = SWIPE.PHOTO_SWIPE_DISTANCE;
const PROMOTE_DISTANCE = SWIPE.SWIPE_THRESHOLD_X * 0.52;
const SUPERLIKE_ACTIVATION_Y = SWIPE.SUPERLIKE_ACTIVATION_Y;
const SUPERLIKE_PARTICLES = SWIPE.SUPERLIKE_PARTICLES;
const PARALLAX_FACTOR = SWIPE.PARALLAX_FACTOR;
const TUTORIAL_ACTIONS_AUTO_DISMISS = 3;
// Minimal outer inset so the card doesn't touch screen edges
const OUTER_INSET = 6;

// Small helper to build rgba from hex (for subtle primary background in common chips)
const colorWithAlpha = (hex: string, alpha: number) => {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (h.length >= 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(0,0,0,${alpha})`;
};

const PhotoProgressSegment = memo(function PhotoProgressSegment({
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

  // Start realtime presence for current user (once per mount)
  useEffect(() => { if (user?.id) ensurePresence(user.id) }, [user?.id]);

  const { data: remaining = 0, refetch: refetchRemaining } = useQuery({
    enabled: !!user,
    queryKey: ['superlikes-remaining-simple', user?.id],
    queryFn: async () => remainingSuperlikes(user!.id, 3)
  });

  const PAGE_SIZE = 50;
  interface SwipePage { profiles: CardProfile[]; boostSet: Set<string>; myInterests: string[]; usedRpc: boolean }
  const { data, isLoading, fetchNextPage, hasNextPage, refetch } = useInfiniteQuery<SwipePage>({
    enabled: !!user,
    queryKey: ['event-swipe-profiles', eid, user?.id],
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages, lastOffset) => {
      return lastPage?.profiles?.length === PAGE_SIZE ? (Number(lastOffset) + PAGE_SIZE) : undefined;
    },
    queryFn: async ({ pageParam }): Promise<SwipePage> => {
      if (Number.isNaN(eid)) {
        console.warn('[event-swipe] eid es NaN');
  return { profiles: [], boostSet: new Set<string>(), myInterests: [], usedRpc: false } as SwipePage;
      }
      const offset = typeof pageParam === 'number' ? pageParam : 0;

      // Prefer server-side filtered candidates via RPC (mutual age + mutual interests + exclusions)
      const { data: rpcRows, error: rpcErr } = await supabase
  // Usamos versión enriquecida con fotos; si falla se hará fallback más abajo
  .rpc('event_candidates_cards_with_photos', { p_user_id: user!.id, p_event_id: eid, p_limit: PAGE_SIZE, p_offset: offset });
  if (rpcErr) console.warn('[event-swipe] rpc event_candidates_cards error', rpcErr.message);

      // Build profilesSource from RPC if available; else fallback to previous IDs-from-attendance path
      let profilesSource: ProfileRow[] = [];
      let usedRpc = false;
      if (Array.isArray(rpcRows) && rpcRows.length > 0) {
        usedRpc = true;
        profilesSource = (rpcRows as any[]).map((r: any) => ({
          id: r.candidate_id,
          display_name: r.display_name ?? 'Usuario',
          calculated_age: typeof r.calculated_age === 'number' ? r.calculated_age : null,
          gender: null, // no lo pedimos en RPC para ahorrar, se mantiene null
          interests: null, // se llenará con profile_interests más abajo
          avatar_url: r.avatar_url || null, // usar avatar_url de la RPC cuando esté disponible
          interested_in: null, // no lo necesitamos aquí; mutualidad ya la aplicó el servidor
          seeking: Array.isArray(r.seeking) ? r.seeking : null,
        }));
      } else {
        // Fallback: obtener IDs desde asistencia y luego perfilar
        const { data: att, error: attErr } = await supabase
          .from('event_attendance')
          .select('user_id')
          .eq('event_id', eid)
          .eq('status', 'going');
        if (attErr) console.warn('[event-swipe] attendance error', attErr.message);
        const ids = (att || []).map(a => a.user_id).filter(id => id !== user!.id);
  if (!ids.length) return { profiles: [] as CardProfile[], boostSet: new Set<string>(), myInterests: [], usedRpc: false } as SwipePage;
        const { data: profsIn, error: profsInErr } = await supabase
          .from('profiles')
          .select('id, display_name, calculated_age, gender, avatar_url, interested_in, seeking')
          .in('id', ids);
        if (profsInErr) console.warn('[event-swipe] profiles .in error', profsInErr.message, { ids });
        profilesSource = (profsIn || []) as ProfileRow[];
      }
  if (!profilesSource.length) return { profiles: [] as CardProfile[], boostSet: new Set<string>(), myInterests: [], usedRpc } as SwipePage;

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

      // Si perfilesSource aún está vacío (caso raro), intentamos aún el fallback por ID individual
      if (profilesSource.length === 0) {
        const fallback: ProfileRow[] = [];
        // En este punto no tenemos 'ids' directo; lo inferimos de otras cargas si existieran
        const candidateIds: string[] = [];
        try {
          const { data: rawAtt } = await supabase
            .from('event_attendance')
            .select('user_id')
            .eq('event_id', eid)
            .eq('status', 'going');
          (rawAtt || []).forEach((a: any) => { if (a?.user_id && a.user_id !== user!.id) candidateIds.push(a.user_id); });
        } catch {}
        for (const id of candidateIds) {
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

      let interestsMap = new Map<string, string[]>();
      let photosMap = new Map<string, { id: number; url: string; sort_order: number }[]>();
      if (profilesSource.length && usedRpc && Array.isArray(rpcRows)) {
        // Fotos embebidas en event_candidates_cards_with_photos → sin bulk
        (rpcRows as any[]).forEach((r: any) => {
          const pid = r?.candidate_id;
          const arr = Array.isArray(r?.photos) ? r.photos : [];
          photosMap.set(pid, arr.map((x: any) => ({ id: Number(x.id), url: String(x.url), sort_order: Number(x.sort_order ?? 0) })));
        });
      }
      // Prompts via SECURITY DEFINER RPC (localized choices labels). Include icon when available.
      let promptsMap = new Map<string, { id: number; prompt_id: number; question?: string; response: any; key?: string; choices_labels?: Record<string,string>|null; icon?: string|null }[]>();
      if (profilesSource.length) {
        try {
          const idsAll = profilesSource.map(p => p.id);
          const { data: promptRows } = await supabase
            .rpc('profile_prompts_bulk', { p_ids: idsAll, p_locale: i18n.language || 'es' });
          (promptRows || []).forEach((r: any) => {
            if (!r?.profile_id) return;
            const arr = promptsMap.get(r.profile_id) || [];
            // Incluir icon y question cuando el RPC los provea
            arr.push({ id: r.prompt_id, prompt_id: r.prompt_id, key: r.key, question: r.question || null, response: r.answer, choices_labels: r.choices_labels || null, icon: r.icon || null });
            promptsMap.set(r.profile_id, arr);
          });
          promptsMap.forEach((arr, k) => promptsMap.set(k, arr.sort((a,b)=> a.prompt_id - b.prompt_id)));
        } catch (e:any) {
          console.warn('[event-swipe] prompts rpc error', e?.message);
        }
      }
      // Interests via SECURITY DEFINER RPC (bypass RLS safely)
      if (profilesSource.length) {
        try {
          const idsAll = profilesSource.map(p => p.id);
          const { data: interestRows } = await supabase
            .rpc('profile_interests_bulk', { p_ids: idsAll });
          (interestRows || []).forEach((r: any) => {
            if (!r) return;
            const arr = Array.isArray(r.interests) ? r.interests : [];
            interestsMap.set(r.profile_id, arr);
          });
        } catch (e:any) {
          console.warn('[event-swipe] interests rpc error', e?.message);
        }
      }
      // Bios via SECURITY DEFINER RPC
      let biosMap = new Map<string, string | null>();
      if (profilesSource.length) {
        try {
          const idsAll = profilesSource.map(p => p.id);
          const { data: biosRows } = await supabase
            .rpc('profile_bios_bulk', { p_ids: idsAll });
          (biosRows || []).forEach((r: any) => { if (r?.profile_id) biosMap.set(r.profile_id, r.bio ?? null); });
        } catch (e:any) {
          console.warn('[event-swipe] bios rpc error', e?.message);
        }
      }

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

      // Distancias: si usamos la RPC event_candidates_cards, ya viene distance_km; solo hacemos bulk si fallback
      let distMap = new Map<string, number | null>();
      if (!usedRpc) {
        try {
          if (profilesSource.length) {
            const idsAll = profilesSource.map(p => p.id);
            const { data: distRows } = await supabase
              .rpc('profile_distance_bulk', { p_viewer: user!.id, p_ids: idsAll });
            (distRows || []).forEach((r: any) => { if (r?.profile_id) distMap.set(r.profile_id, (typeof r.distance_km === 'number' ? r.distance_km : null)); });
          }
        } catch (e:any) {
          console.warn('[event-swipe] distance rpc error', e?.message);
        }
      }

      const profiles: CardProfile[] = (profilesSource || []).map((p: ProfileRow) => ({
        id: p.id,
        name: p.display_name ?? 'Usuario',
        age: typeof p.calculated_age === 'number' ? p.calculated_age : null,
        bio: (biosMap.get(p.id) ?? p.bio ?? null),
  interests: (interestsMap.get(p.id) || []),
        avatar: p.avatar_url || null,
        gender: normalizeLabel(p.gender) || null,
        interested_in: normalizeArr(p.interested_in),
        seeking: normalizeArr(p.seeking),
        photos: photosMap.get(p.id) || [],
        prompts: promptsMap.get(p.id) || [],
        distanceKm: distMap.get(p.id) ?? (Array.isArray(rpcRows) ? (rpcRows as any[]).find((r: any) => r.candidate_id === p.id)?.distance_km ?? null : null)
      }));
      // Si la RPC fue usada, el servidor ya excluye likes/matches → no hace falta consultar ni filtrar decididos aquí.
      const decided = new Set<string>();
      if (!usedRpc) {
        const { data: likesRaw, error: likesErr } = await supabase
          .from('likes')
          .select('liked')
          .eq('liker', user!.id)
          .in('liked', profilesSource.map(p => p.id));
        if (likesErr) console.warn('[event-swipe] likes error', likesErr.message);
        (likesRaw || []).forEach(r => decided.add(r.liked));
      }

      const { data: boosters, error: boostersErr } = await supabase
        .from('likes')
        .select('liker')
        .eq('liked', user!.id)
        .eq('type', 'superlike')
        .eq('context_event_id', eid);
      if (boostersErr) console.warn('[event-swipe] boosters error', boostersErr.message);
      const boostSet = new Set<string>((boosters || []).map(b => b.liker));

      const { data: meProfileRaw, error: meErr } = await supabase
        .from('profiles')
        .select('gender, interested_in, seeking, min_age, max_age')
        .eq('id', user!.id)
        .maybeSingle();
      if (meErr) console.warn('[event-swipe] me profile error', meErr.message);
      const gMe = normalizeLabel(meProfileRaw?.gender as string | null);
      let myInterestedIn: string[] = normalizeArr(meProfileRaw?.interested_in as any);

      // Expand legacy orientation codes to target genders for compatibility
      const expandInterested = (list: string[], selfGender: string | null): string[] => {
        if (!list || list.length === 0) return [];
        if (list.includes('*')) return ['*'];
        const out = new Set<string>();
        const add = (x?: string | null) => { if (!x) return; if (x === 'nonbinary') out.add('other'); else out.add(x); };
        for (const raw of list) {
          const v = (raw || '').toLowerCase();
          if (v === '*' || v === 'everyone' || v === 'all' || v === 'cualquiera' || v === 'todos' || v === 'todas' || v === 'any') { out.add('*'); continue; }
          if (v === 'male' || v === 'hombre' || v === 'hombres' || v === 'm') { out.add('male'); continue; }
          if (v === 'female' || v === 'mujer' || v === 'mujeres' || v === 'f') { out.add('female'); continue; }
          if (v === 'other' || v === 'nonbinary' || v === 'no binario' || v === 'nb') { out.add('other'); continue; }
          // Legacy orientation to target mapping
          if (v === 'bi' || v === 'bisexual') { out.add('male'); out.add('female'); continue; }
          if (v === 'straight' || v === 'hetero' || v === 'heterosexual') {
            if (selfGender === 'male') add('female');
            else if (selfGender === 'female') add('male');
            else out.add('*');
            continue;
          }
          if (v === 'gay') {
            if (selfGender === 'male') add('male');
            else if (selfGender === 'female') add('female');
            else out.add('*');
            continue;
          }
          if (v === 'lesbian' || v === 'lesbiana') { add('female'); continue; }
        }
        return Array.from(out);
      };
  const myTargets = expandInterested(myInterestedIn, gMe);
  const myMinAge = Math.max(18, Math.min(99, (meProfileRaw as any)?.min_age ?? 18));
  const myMaxAge = Math.max(myMinAge, Math.min(99, (meProfileRaw as any)?.max_age ?? 99));

      const wants = (list: string[], other: string | null): boolean => {
        if (!other) return true;
        if (!list.length) return true;
        if (list.includes('*')) return true;
        return list.includes(other);
      };
      const hasMutual = (p: CardProfile): boolean => {
        const gOther = p.gender;
        if (!gMe || !gOther) return true;
        const otherTargets = expandInterested(p.interested_in || [], gOther);
        const iWant = wants(myTargets, gOther);
        const otherWants = wants(otherTargets, gMe);
        return iWant && otherWants;
      };

      const RELAX_MUTUAL = false;
      const inAge = (p: CardProfile): boolean => {
        const a = typeof p.age === 'number' ? p.age : null;
        if (a == null) return true;
        return a >= myMinAge && a <= myMaxAge;
      };
      // Si usamos RPC, el servidor ya aplicó mutualidad de intereses y edad
      let pending = usedRpc
        ? profiles.filter(p => !decided.has(p.id))
        : profiles.filter(p => !decided.has(p.id) && hasMutual(p) && inAge(p));
      if (RELAX_MUTUAL && profiles.length > 0 && pending.length === 0) {
        console.warn('[event-swipe] mutual produced 0; RELAX_MUTUAL enabled => showing non-decided all');
        pending = profiles.filter(p => !decided.has(p.id));
      }
      if (!RELAX_MUTUAL && profiles.length > 0 && pending.length === 0) {
        console.info('[event-swipe] mutual produced 0; not relaxing (consistent with outer pending=0)');
      }

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
  return { profiles: ordered, boostSet, myInterests, usedRpc } as SwipePage;
    }
  });
  const pages = data?.pages || [];
  const deck = pages.flatMap(p => p.profiles) || [];
  const viewerInterests = useMemo(() => {
    return pages.length ? (pages[0]?.myInterests || []) : [];
  }, [pages]);
  const boostSetGlobal = useMemo(() => {
    const s = new Set<string>();
    for (const pg of pages) { if (pg?.boostSet) { pg.boostSet.forEach(id => s.add(id)); } }
    return s;
  }, [pages]);

  const [uiDeck, setUiDeck] = useState<CardProfile[]>([]);
  const decidedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!deck) { setUiDeck([]); return; }
    decidedRef.current.clear();
    setUiDeck(deck);
  }, [deck.map(p=>p.id).join('|')]);

  // Auto-refill similar a Classic
  useEffect(() => {
    if (!hasNextPage) return;
    if (uiDeck.length <= 5) { try { fetchNextPage(); } catch {} }
  }, [uiDeck.length, hasNextPage, fetchNextPage]);

  useEffect(() => {
    if (!uiDeck.length && deck.length) {
      const candidates = deck.filter(p => !decidedRef.current.has(p.id));
      if (candidates.length) setUiDeck(candidates);
    }
  }, [uiDeck.length, deck.length]);

  const current = uiDeck[0];
  const next = uiDeck[1];
  const onlineSet = useOnlineIds(current?.id ? [current.id] : []);
  const onlineLabel = (i18n.language || '').toLowerCase().startsWith('es') ? 'En línea' : 'Online';
  const [photoIndex, setPhotoIndex] = useState(0);
  useEffect(()=>{ setPhotoIndex(0); }, [current?.id]);
  // Simplified image swap: single image keyed by photo id + hidden loader to avoid previous-photo flash
  const currentUri = useMemo(() => (current?.photos?.[photoIndex]?.url || current?.avatar || null), [current?.id, photoIndex]);
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => { setImgLoaded(false); }, [current?.id, photoIndex]);
  const isDraggingRef = useRef(false);
  const gestureModeRef = useRef<'undecided' | 'photo' | 'card'>('undecided');
  const startXRef = useRef<number | null>(null);
  const lastPhotoCommitRef = useRef(0);
  const actionsCountRef = useRef(0);
  const photoAutoProgress = useSharedValue(0);
  const pauseRef = useRef(false);
  const startTsRef = useRef(0);
  const totalDurationRef = useRef<number>(AUTO_ADVANCE_INTERVAL_MS);
  const remainingRef = useRef<number>(AUTO_ADVANCE_INTERVAL_MS);
  const lastEndTsRef = useRef(0);

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
    const baseIndex = photoIndex;
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
    const progress = photoAutoProgress.value;
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

  useEffect(() => {
    if (next?.avatar) Image.prefetch(next.avatar).catch(()=>{});
    (next?.photos || []).slice(0,3).forEach((p: { url: string }) => { if (p.url) Image.prefetch(p.url).catch(()=>{}); });
  }, [next?.avatar, next?.photos]);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const superProgress = useSharedValue(0);

  const resetCard = () => {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    superProgress.value = 0;
  };
  const advance = () => {
    setUiDeck(prev => prev.slice(1));
  };

  const [match, setMatch] = useState<{ targetId: string; matchId: string | number } | null>(null);
  const busyRef = useRef(false);

  const performAction = useCallback(async (targetId: string, type: 'like' | 'pass' | 'superlike') => {
    if (!user) return;
    if (busyRef.current) return;
    busyRef.current = true;
    if (type === 'superlike' && remaining <= 0) {
      Alert.alert('Límite alcanzado', 'Has usado tus 3 superlikes de hoy.');
      resetCard();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{});
      busyRef.current = false;
      return;
    }
    // Do not advance yet; only advance after a successful upsert to avoid skipping
    // the card when the DB rejects the action (e.g., superlike quota exceeded).
    try {
      if (type === 'pass') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
      else if (type === 'like') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
      else if (type === 'superlike') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(()=>{});

      const payload = { liker: user.id, liked: targetId, type, created_at: new Date().toISOString(), context_event_id: eid };
      const { error: likeErr } = await supabase.from('likes').upsert(payload, { onConflict: 'liker,liked,context_event_id' });
      if (likeErr) {
        if (type === 'superlike') {
          Alert.alert('Límite alcanzado', 'Has usado tus 3 superlikes de hoy.');
          try { refetchRemaining(); } catch {}
          // Restore the card since action failed
          resetCard();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{});
        } else {
          console.warn('[event-swipe] like upsert error', likeErr.message);
          // Non-superlike errors: also restore the card
          resetCard();
        }
        return;
      }
      if (type === 'superlike') { try { incSuperlike(user.id); } catch {}; refetchRemaining(); }
      if (type === 'like' || type === 'superlike') {
        const { matched, matchId } = await ensureMatchConsistency(user.id, targetId);
        if (matched && matchId != null) setMatch({ targetId, matchId });
      }
      qc.invalidateQueries({ queryKey: ['event-swipe-profiles', eid, user?.id] });
      // Cross-context: ensure Classic deck refreshes so the liked user disappears immediately
      qc.invalidateQueries({ queryKey: ['classic-swipe-profiles', user?.id] });
      // Update any pending counters derived from the event feed
      try {
        qc.setQueryData<any[]>(['my-feed-events-with-pending', user.id], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map(ev => ev.id === eid ? { ...ev, pending: Math.max(0, (ev.pending || 0) - 1) } : ev);
        });
      } catch {}
      // Only after success, mark decided and advance deck
      decidedRef.current.add(targetId);
      advance();
      translateX.value = 0; translateY.value = 0; superProgress.value = 0;
    } finally {
      actionsCountRef.current += 1;
      if (tutorialVisibleRef.current && actionsCountRef.current >= TUTORIAL_ACTIONS_AUTO_DISMISS) {
        runOnJS(dismissTutorial)();
      }
      setTimeout(()=>{ busyRef.current = false; }, 120);
    }
  }, [user, remaining, eid]);

  useEffect(() => {
    if (!eid) return;
    const ch = supabase
      .channel(`event-attendance-${eid}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'event_attendance', filter:`event_id=eq.${eid}` }, () => refetch())
      .on('postgres_changes', { event:'DELETE', schema:'public', table:'event_attendance', filter:`event_id=eq.${eid}` }, () => refetch());
    return () => { supabase.removeChannel(ch); };
  }, [eid, refetch]);

  // Realtime: refrescar cuando cambien fotos o avatar de cualquier perfil mientras esta pantalla está abierta
  useEffect(() => {
    const ch = supabase
      .channel(`event-photos-profiles-rt-${eid || 'global'}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_photos' },
        () => { try { refetch(); } catch {} }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => { try { refetch(); } catch {} }
      )
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [eid, refetch]);

  useEffect(() => {
    const id = setInterval(() => { refetch(); refetchRemaining(); }, 45000);
    return () => clearInterval(id);
  }, [refetch, refetchRemaining]);

  const cardStyle = useAnimatedStyle(() => {
    const rawAngle = translateX.value / 18;
    const clamped = Math.max(-12, Math.min(12, rawAngle));
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

  // Next card appears from bottom as you drag the current one
  const NEXT_CARD_OFFSET_Y = 26;
  const NEXT_CARD_SCALE_MIN = 0.96;
  const nextCardStyle = useAnimatedStyle(() => {
    const pX = Math.min(1, Math.abs(translateX.value) / SWIPE_THRESHOLD_X);
    const pY = Math.min(1, Math.max(0, -translateY.value) / SWIPE_THRESHOLD_Y);
    const p = Math.max(pX, pY);
    const ty = NEXT_CARD_OFFSET_Y * (1 - p);
    const sc = NEXT_CARD_SCALE_MIN + (1 - NEXT_CARD_SCALE_MIN) * p;
    // Hide the next card completely until user interaction begins
    const op = p;
    return { transform: [{ translateY: ty }, { scale: sc }], opacity: op };
  });

  const particles = useMemo(() => Array.from({ length: SUPERLIKE_PARTICLES }).map((_, i) => ({
    id: i,
    offsetX: (Math.random() * 140) - 70,
    delay: Math.random() * 0.25,
    height: 140 + Math.random()*60,
    size: 8 + Math.random()*10
  })), []);
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

  const onEnd = ({ nativeEvent }: any) => {
    // micro-debounce to avoid spurious double end events
    const now = Date.now();
    if (now - (lastEndTsRef.current || 0) < 80) return;
    lastEndTsRef.current = now;
    const { translationX, translationY } = nativeEvent;
    isDraggingRef.current = false;
    const mode = gestureModeRef.current;
    if (translationY < -SWIPE_THRESHOLD_Y && current) {
      translateY.value = withTiming(-height, { duration:250 }, () => runOnJS(performAction)(current.id, 'superlike'));
      gestureModeRef.current = 'undecided';
      startXRef.current = null;
      lastPhotoCommitRef.current = 0;
      return;
    }
    if (mode === 'card') {
      const SOFT_X = SWIPE_THRESHOLD_X * 0.7;
      if (translationX > SWIPE_THRESHOLD_X && current) {
        translateX.value = withTiming(width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'like'));
      } else if (translationX < -SWIPE_THRESHOLD_X && current) {
        translateX.value = withTiming(-width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'pass'));
      } else if (translationX > SOFT_X && current) {
        translateX.value = withTiming(width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'like'));
      } else if (translationX < -SOFT_X && current) {
        translateX.value = withTiming(-width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'pass'));
      } else {
        resetCard();
      }
    } else {
      resetCard();
    }
    gestureModeRef.current = 'undecided';
    startXRef.current = null;
    lastPhotoCommitRef.current = 0;
  };
  const handleGestureEvent = useCallback((evt: any) => {
    const { translationX, translationY, x } = evt.nativeEvent;
    if (!isDraggingRef.current && (Math.abs(translationX) > 6 || Math.abs(translationY) > 6)) {
      isDraggingRef.current = true;
    }
    const photosLen = current?.photos?.length || 0;
    if (startXRef.current == null && typeof x === 'number') startXRef.current = x;
    const mode = gestureModeRef.current;
    const horizontalDominant = Math.abs(translationX) > Math.abs(translationY);
    if (mode === 'undecided') {
      if (horizontalDominant && photosLen > 1 && startXRef.current != null) {
        const EDGE_ZONE_PX = CARD_WIDTH * EDGE_ZONE_RATIO;
        const inEdge = startXRef.current < EDGE_ZONE_PX || startXRef.current > (CARD_WIDTH - EDGE_ZONE_PX);
        gestureModeRef.current = inEdge ? 'photo' : 'card';
        if (gestureModeRef.current === 'photo') {
          lastPhotoCommitRef.current = 0;
        }
      } else {
        gestureModeRef.current = 'card';
      }
    }
    if (gestureModeRef.current === 'photo') {
      if (Math.abs(translationX) >= PROMOTE_DISTANCE) {
        gestureModeRef.current = 'card';
        translateX.value = translationX;
        translateY.value = translationY;
        return;
      }
      const delta = translationX - lastPhotoCommitRef.current;
      if (delta > PHOTO_SWIPE_DISTANCE) {
        setPhotoIndex(idx => {
          const nextIdx = idx - 1;
          return nextIdx < 0 ? 0 : nextIdx;
        });
        lastPhotoCommitRef.current = translationX;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
      } else if (delta < -PHOTO_SWIPE_DISTANCE) {
        setPhotoIndex(idx => {
          const nextIdx = idx + 1;
          return nextIdx >= photosLen ? photosLen - 1 : nextIdx;
        });
        lastPhotoCommitRef.current = translationX;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
      }
      translateX.value = 0; translateY.value = 0;
      return;
    }
    translateX.value = translationX; translateY.value = translationY;
    superProgress.value = translationY < -SUPERLIKE_ACTIVATION_Y ? Math.min(1, Math.abs(translationY) / SWIPE_THRESHOLD_Y) : 0;
  }, [current?.photos?.length]);

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

  const hashId = (id: string) => { let h = 0; for (let i=0;i<id.length;i++) { h = (h * 131 + id.charCodeAt(i)) >>> 0; } return h; };
  const promptOrder = useMemo(() => {
    if (!current?.prompts) return [] as any[];
    const valid = current.prompts.filter(p => {
      if (!p) return false; const r = p.response; if (Array.isArray(r)) return r.length>0; if (typeof r === 'string') return r.trim().length>0; return r != null && String(r).trim().length>0; });
    if (valid.length <= 1) return valid;
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

  const prioritizedPrompts = useMemo(() => {
    const isArrayPrompt = (p: any) => Array.isArray(p?.response);
    const isLanguagesKey = (k: string) => {
      const key = k.toLowerCase();
      const LANGUAGE_KEYS = new Set(['languages', 'idiomas', 'languagespoken', 'idiomashablados', 'lang', 'langs']);
      if (LANGUAGE_KEYS.has(key)) return true;
      return key.includes('language') || key.includes('idioma') || key.includes('idiom') || key.includes('lang');
    };
    const isLikelyLanguages = (p: any) => {
      const k = String(p?.key || '');
      if (k && isLanguagesKey(k)) return true;
      const q = String(p?.question || '').toLowerCase();
      if (q.includes('idiomas') || q.includes('lengu') || q.includes('languages') || q.includes('speak')) return true;
      const resp = p?.response;
      if (Array.isArray(resp) && resp.length) {
        const SAMPLE_LANGS = ['es', 'en', 'fr', 'de', 'it', 'pt', 'chino', 'chinese', 'inglés', 'español', 'francés'];
        const s = String(resp[0] || '').toLowerCase();
        if (SAMPLE_LANGS.some(w => s.includes(w))) return true;
      }
      return false;
    };
    const score = (p: any) => (isLikelyLanguages(p) ? 3 : isArrayPrompt(p) ? 2 : 1);
    const base = [...promptOrder];
    base.sort((a, b) => score(b) - score(a));
    return base;
  }, [promptOrder]);

  // Two prompts per photo starting at photo index 2 (third visual card). No compact grouping, no overflow indicator.
  // If there are more prompts than slots*2 we simply truncate (no +N badge per spec).
  const promptSlots = useMemo(() => Math.max(0, (current?.photos?.length || 0) - 2), [current?.photos?.length]);
  const visiblePrompts = useMemo(() => prioritizedPrompts.slice(0, promptSlots * 2), [prioritizedPrompts, promptSlots]);

  const renderSinglePrompt = (p: any) => {
    if (!p) return null;
    const respRaw = p.response;
    const isArray = Array.isArray(respRaw);
    const answerText = !isArray ? tAnswer(String(respRaw).trim(), (p as any).choices_labels) : '';
    return (
      <View style={{ marginTop:8, alignSelf:'flex-start', maxWidth:'92%' }}>
        {p.question && (
          <Text style={{ color:'#fff', fontSize:12, fontWeight:'700', opacity:0.9, marginBottom:4 }} numberOfLines={2}>
            {prefixIcon(
              tPromptQ(p.question, (p as any).key),
              (p as any).icon as string | undefined
            )}
          </Text>
        )}
        {isArray ? (
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
            {respRaw.slice(0,6).map((opt: any, i: number) => (
              <View key={i} style={{ backgroundColor:'rgba(255,255,255,0.12)', borderWidth:1, borderColor:'rgba(255,255,255,0.18)', paddingHorizontal:10, paddingVertical:5, borderRadius:14 }}>
                <Text style={{ color:'#fff', fontSize:11.5, fontWeight:'600' }} numberOfLines={1}>{tAnswer(opt, (p as any).choices_labels)}</Text>
              </View>
            ))}
            {respRaw.length > 6 && (
              <View style={{ backgroundColor:'rgba(255,255,255,0.12)', borderWidth:1, borderColor:'rgba(255,255,255,0.18)', paddingHorizontal:10, paddingVertical:5, borderRadius:14 }}>
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

  // Removed CompactPromptGroup – now we only render up to two prompts side-by-side per photo slot.

  // Full interest list (server enforces per-category limit); highlight common ones.
  const interestChips = useMemo(() => {
    const ui: string[] = Array.isArray(current?.interests) ? current!.interests : [];
    return ui;
  }, [current?.id, current?.interests]);

  // Compute one-line bio (grapheme-safe truncation)
  const bioLine = useMemo(() => {
    const raw = (current?.bio || '').trim();
    if (!raw) return null;
    return truncateByGraphemes(raw, 90);
  }, [current?.id, current?.bio]);

  // Compute prompt highlights (emoji + short label) to fill if interests < 3
  const promptHighlights = useMemo(() => {
    const maxNeeded = Math.min(2, Math.max(0, 3 - (interestChips?.length || 0)));
    if (!current?.prompts || maxNeeded <= 0) return [] as string[];
    const makeLabel = (p: any): string | null => {
      const emoji = (p?.icon as string) || '✨';
      const resp = p?.response;
      if (Array.isArray(resp) && resp.length > 0) {
        const raw = resp[0];
        const label = tAnswer(raw, p?.choices_labels);
        const txt = String(label || '').trim();
        if (!txt) return null;
        const pretty = txt.length > 18 ? `${txt.slice(0,16)}…` : txt;
        return `${emoji} ${pretty}`;
      }
      return null;
    };
    const all = (current.prompts || [])
      .map(makeLabel)
      .filter((s: any): s is string => typeof s === 'string' && s.length > 0);
    const seen = new Set<string>();
    const uniq = [] as string[];
    for (const s of all) { if (!seen.has(s)) { seen.add(s); uniq.push(s); } }
    return uniq.slice(0, maxNeeded);
  }, [current?.id, current?.prompts, interestChips]);

  const boosterTipShownRef = useRef(false);
  const [showBoosterTip, setShowBoosterTip] = useState(false);
  useEffect(() => {
    if (current && boostSetGlobal.has(current.id) && !boosterTipShownRef.current) {
      boosterTipShownRef.current = true;
      setShowBoosterTip(true);
      const t = setTimeout(()=> setShowBoosterTip(false), 3200);
      return () => clearTimeout(t);
    } else if (!current) {
      setShowBoosterTip(false);
    }
  }, [current?.id, boostSetGlobal]);

  const [tutorialVisible, setTutorialVisible] = useState(false);
  const tutorialVisibleRef = useRef(false);
  const dismissTutorial = useCallback(() => {
    setTutorialVisible(false); tutorialVisibleRef.current = false;
  }, []);
  useEffect(() => {
    if (!tutorialVisibleRef.current) {
      setTutorialVisible(true); tutorialVisibleRef.current = true;
    }
  }, []);

  // Empty state: use unified component

  return (
    <Screen style={{ padding:0 }} edges={[]}> 
      {isLoading && (
        <YStack style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </YStack>
      )}
      {!isLoading && !current && (
        <EmptyState
          title="No hay más personas"
          subtitle="Cuando haya más asistentes compatibles aparecerán aquí. Mientras tanto puedes explorar otros eventos."
          ctaLabel="Explorar eventos"
          onPressCta={() => router.push('/')}
          iconName="people-outline"
        />
      )}
      {!isLoading && current && (
        <View style={{ flex:1, alignItems:'stretch', padding: OUTER_INSET }}>
          {process.env.EXPO_PUBLIC_SWIPE_DEBUG === '1' && pages.length > 0 && !pages[0].usedRpc && (
            <View style={{ position:'absolute', top:4, left:4, zIndex:20, backgroundColor:'#c53030', paddingHorizontal:10, paddingVertical:6, borderRadius:8 }}>
              <Text style={{ color:'#fff', fontSize:11, fontWeight:'700' }}>FALLBACK RPC</Text>
            </View>
          )}
          {next && imgLoaded && (
            <Animated.View pointerEvents='none' style={[{ position:'absolute', top: 0, left:0, right:0, bottom: 0, borderRadius:24, overflow:'hidden', backgroundColor: theme.colors.card }, nextCardStyle]}>
              {next.photos && next.photos.length > 0 ? (
                <Image
                  source={{ uri: next.photos[0]?.url || next.avatar || '' }}
                  style={{ flex:1 }}
                  resizeMode='cover'
                />
              ) : next.avatar ? (
                <Image source={{ uri: next.avatar }} style={{ flex:1 }} resizeMode='cover' />
              ) : (
                <View style={{ flex:1, backgroundColor: theme.colors.border }} />
              )}
            </Animated.View>
          )}
          <PanGestureHandler onGestureEvent={handleGestureEvent} onEnded={onEnd}>
            <Animated.View style={[{ width:'100%', height:'100%', borderRadius:24, overflow:'hidden', backgroundColor: theme.colors.card }, cardStyle]}>
              <View style={{ flex:1 }}>
                {current?.photos && current.photos.length > 0 ? (
                  imgLoaded ? (
                    <Animated.Image
                      key={`active-${current.id}-${current.photos?.[photoIndex]?.id ?? 'av'}`}
                      source={{ uri: currentUri || '' }}
                      style={[{ flex:1 }, parallaxStyle]}
                      resizeMode='cover'
                      fadeDuration={0 as any}
                    />
                  ) : (
                    <>
                      <View style={{ flex:1, backgroundColor: theme.colors.card }} />
                      {!!currentUri && (
                        <Image
                          key={`loader-${current.id}-${current.photos?.[photoIndex]?.id ?? 'av'}`}
                          source={{ uri: currentUri }}
                          style={{ position:'absolute', top:0, left:0, right:0, bottom:0, opacity:0 }}
                          resizeMode='cover'
                          fadeDuration={0}
                          onLoadEnd={() => setImgLoaded(true)}
                        />
                      )}
                    </>
                  )
                ) : current?.avatar ? (
                  imgLoaded ? (
                    <Animated.Image
                      key={`active-${current.id}-avatar`}
                      source={{ uri: current.avatar }}
                      style={[{ flex:1 }, parallaxStyle]}
                      resizeMode='cover'
                      fadeDuration={0 as any}
                    />
                  ) : (
                    <>
                      <View style={{ flex:1, backgroundColor: theme.colors.card }} />
                      <Image
                        key={`loader-${current.id}-avatar`}
                        source={{ uri: current.avatar }}
                        style={{ position:'absolute', top:0, left:0, right:0, bottom:0, opacity:0 }}
                        resizeMode='cover'
                        fadeDuration={0}
                        onLoadEnd={() => setImgLoaded(true)}
                      />
                    </>
                  )
                ) : (
                  <View style={{ flex:1, backgroundColor: theme.colors.border, alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ color: theme.colors.subtext }}>Sin foto</Text>
                  </View>
                )}
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
              {current.photos && current.photos.length > 1 && (
                <View
                  style={{ position:'absolute', top:40, bottom:0, left:'32%', right:'32%' }}
                  onStartShouldSetResponder={() => true}
                  onResponderGrant={pausePhotoProgress}
                  onResponderRelease={resumePhotoProgress}
                  pointerEvents='box-only'
                />
              )}
              <Animated.View pointerEvents='none' style={[{ position:'absolute', top:0, left:0, right:0, bottom:0, justifyContent:'center', alignItems:'center' }, haloStyle]}>
                <View style={{ width:220, height:220, borderRadius:110, backgroundColor: theme.colors.primary, opacity:0.15 }} />
                <View style={{ position:'absolute', width:160, height:160, borderRadius:80, backgroundColor: theme.colors.primary, opacity:0.18 }} />
                {particleStyles.map((st, i) => (
                  <Animated.View key={i} style={[{ position:'absolute', bottom:'40%', width: particles[i].size, height: particles[i].size, borderRadius:999, backgroundColor: theme.colors.primary }, st]} />
                ))}
              </Animated.View>
              <Animated.View pointerEvents='none' style={[{ position:'absolute', top:30, left:20, paddingHorizontal:16, paddingVertical:8, borderWidth:4, borderColor: theme.colors.success || '#3ba65b', borderRadius:8, transform:[{ rotate:'-15deg' }] }, likeOpacityStyle]}>
                <Text style={{ color: theme.colors.success || '#3ba65b', fontSize:28, fontWeight:'800' }}>LIKE</Text>
              </Animated.View>
              <Animated.View pointerEvents='none' style={[{ position:'absolute', top:30, right:20, paddingHorizontal:16, paddingVertical:8, borderWidth:4, borderColor: '#d9534f', borderRadius:8, transform:[{ rotate:'15deg' }] }, nopeOpacityStyle]}>
                <Text style={{ color: '#d9534f', fontSize:28, fontWeight:'800' }}>NOPE</Text>
              </Animated.View>
              <Animated.View pointerEvents='none' style={[{ position:'absolute', top:80, alignSelf:'center', paddingHorizontal:18, paddingVertical:10, borderWidth:4, borderColor: theme.colors.primary, borderRadius:999, backgroundColor:'rgba(0,0,0,0.25)' }, superOpacityStyle]}>
                <Text style={{ color: theme.colors.primary, fontSize:24, fontWeight:'800' }}>SUPER</Text>
              </Animated.View>
              {/* Bottom legibility gradient (phase 1) */}
              <LinearGradient
                pointerEvents='none'
                colors={['rgba(0,0,0,0)','rgba(0,0,0,0.28)','rgba(0,0,0,0.55)','rgba(0,0,0,0.70)']}
                locations={[0,0.45,0.75,1]}
                style={{ position:'absolute', left:0, right:0, bottom:0, height:'48%' }}
              />
              <View pointerEvents='box-none' style={{ position:'absolute', left:0, right:0, bottom:INFO_OVERLAY_RAISE, paddingHorizontal:18, paddingBottom:18, paddingTop:12 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                  <Text style={{ color:'#fff', fontSize:22, fontWeight:'800', textShadowColor:'rgba(0,0,0,0.55)', textShadowOffset:{ width:0, height:1 }, textShadowRadius:4 }} numberOfLines={1}>
                    {current.name}{current.age?`, ${current.age}`:''}
                  </Text>
                </View>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:4 }}>
                  {onlineSet.has(current.id) && (
                    <View style={{ paddingHorizontal:8, paddingVertical:3, borderRadius:10, backgroundColor:'rgba(34,197,94,0.18)', borderWidth:1, borderColor:'rgba(34,197,94,0.55)' }}>
                      <Text style={{ color:'#fff', fontSize:11, fontWeight:'800' }}>{onlineLabel}</Text>
                    </View>
                  )}
                  {typeof current.distanceKm === 'number' && isFinite(current.distanceKm) && (
                    <View style={{ paddingHorizontal:8, paddingVertical:3, borderRadius:10, backgroundColor:'rgba(59,130,246,0.18)', borderWidth:1, borderColor:'rgba(59,130,246,0.55)' }}>
                      <Text style={{ color:'#fff', fontSize:11, fontWeight:'800' }}>📍 {formatDistanceKm(current.distanceKm!)}</Text>
                    </View>
                  )}
                </View>
                {/* Sectioned content by photo index */}
                {photoIndex === 0 && !!(current.bio || '').trim() && (
                  <Text style={{ color:'#fff', fontSize:13.5, fontWeight:'600', opacity:0.95, marginTop:4 }} numberOfLines={4}>
                    {(current.bio || '').trim()}
                  </Text>
                )}
                {photoIndex === 1 && interestChips.length > 0 && (
                  <View style={{ marginTop:6 }}>
                    <Text style={{ color:'#fff', fontSize:12, fontWeight:'700', opacity:0.9 }}>Intereses</Text>
                    <View style={{ marginTop:6, flexDirection:'row', flexWrap:'wrap', gap:6, maxWidth:'96%', maxHeight:140 }}>
                      {interestChips.map((label, i) => {
                        const isCommon = (viewerInterests || []).includes(label);
                        const chipStyle = isCommon
                          ? { backgroundColor: colorWithAlpha(theme.colors.primary, 0.18), borderWidth: 1, borderColor: theme.colors.primary }
                          : { backgroundColor:'rgba(255,255,255,0.12)', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' };
                        return (
                          <View key={`int-${label}-${i}`} style={{ paddingHorizontal:10, paddingVertical:5, borderRadius:14, ...chipStyle }}>
                            <Text style={{ color:'#fff', fontSize:11.5, fontWeight:'700' }} numberOfLines={1}>{label.length > 18 ? `${label.slice(0,16)}…` : label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
                {photoIndex >= 2 && (() => {
                  const slotIdx = photoIndex - 2;
                  if (slotIdx < 0 || slotIdx >= promptSlots) return null;
                  const left = visiblePrompts[slotIdx * 2];
                  const right = visiblePrompts[slotIdx * 2 + 1];
                  if (!left && !right) return null;
                  return (
                    <View style={{ marginTop:6, maxWidth:'96%', flexDirection:'row', gap:8 }}>
                      {left && (
                        <View style={{ flex: right ? 1 : 1 }}>
                          {renderSinglePrompt(left)}
                        </View>
                      )}
                      {right && (
                        <View style={{ flex:1 }}>
                          {renderSinglePrompt(right)}
                        </View>
                      )}
                    </View>
                  );
                })()}
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
      {/* Match popup unified via MatchPopupProvider */}
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
