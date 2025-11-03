import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react'

import { View, Text, Dimensions, Image, ActivityIndicator, Alert, Pressable } from 'react-native'

import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PanGestureHandler } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS, cancelAnimation } from 'react-native-reanimated'

import { YStack, XStack } from 'components/tg'
import { Screen } from 'components/ui'
import { SwipeButtons } from 'features/profile/ui/swipe/SwipeButtons'
import { ensureMatchConsistency } from 'lib/match'
import { supabase } from 'lib/supabase'
import { remainingSuperlikes, incSuperlike } from 'lib/superlikes'
import { theme } from 'lib/theme'
import { useAuth } from 'lib/useAuth'

interface ProfileRow { id: string; display_name: string | null; calculated_age?: number | null; gender?: string | null; interests?: string[] | null; avatar_url?: string | null; interested_in?: string[] | null; seeking?: string[] | null }
type CardProfile = {
  id: string;
  name: string;
  age: number | null;
  interests: string[];
  avatar: string | null;
  gender: string | null;
  interested_in: string[];
  seeking: string[];
  photos: { id: number; url: string; sort_order: number }[];
  prompts?: { id: number; prompt_id: number; question?: string; response: any; key?: string; choices_labels?: Record<string,string>|null }[];
}

const { width, height } = Dimensions.get('window')
const CARD_WIDTH = width * 0.9
const HEADER_SPACER = 8
const ACTION_BAR_SPACER = 150
const RAW_CARD_HEIGHT = height * 0.72
const EXTRA_TOP_OFFSET = 0
const CARD_TOP_PADDING = HEADER_SPACER + 10 + EXTRA_TOP_OFFSET
const CARD_BOTTOM_PADDING = ACTION_BAR_SPACER
const AVAILABLE_HEIGHT = height - CARD_TOP_PADDING - CARD_BOTTOM_PADDING
let CARD_HEIGHT = Math.min(RAW_CARD_HEIGHT, AVAILABLE_HEIGHT - 8)
if (CARD_HEIGHT < 320) CARD_HEIGHT = Math.min(AVAILABLE_HEIGHT - 4, 320)
const INFO_OVERLAY_RAISE = 110
const SWIPE_THRESHOLD_X = 110
const SWIPE_THRESHOLD_Y = 120
const AUTO_ADVANCE = true
const AUTO_ADVANCE_INTERVAL_MS = 4000
const EDGE_ZONE_RATIO = 0.28
const PHOTO_SWIPE_DISTANCE = 60
const PROMOTE_DISTANCE = SWIPE_THRESHOLD_X * 0.52
const SUPERLIKE_ACTIVATION_Y = 40
const SUPERLIKE_PARTICLES = 10
const PARALLAX_FACTOR = -0.08
const TUTORIAL_ACTIONS_AUTO_DISMISS = 3

const PhotoProgressSegment = memo(function PhotoProgressSegment({ idx, activeIndex, progress, onPress }: { idx: number; activeIndex: number; progress: any; onPress?: () => void }) {
  const [w, setW] = useState(0)
  const barStyle = useAnimatedStyle(() => {
    let fill = 0
    if (idx < activeIndex) fill = 1
    else if (idx === activeIndex) fill = progress.value
    return { width: w * fill, opacity: idx <= activeIndex ? 1 : 0.45 }
  })
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
  )
})

export default function ClassicSwipeScreen() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const router = useRouter()

  const { data: remaining = 0, refetch: refetchRemaining } = useQuery({
    enabled: !!user,
    queryKey: ['superlikes-remaining-simple', user?.id],
    queryFn: async () => remainingSuperlikes(user!.id, 3)
  })

  // Saved precise location for near-mode (drives distance + refetch when it changes)
  const { data: myLoc } = useQuery({
    enabled: !!user,
    queryKey: ['my-profile-location', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profile_locations')
        .select('lat,lng,city_label')
        .eq('user_id', user!.id)
        .maybeSingle()
      return data as { lat?: number|null; lng?: number|null; city_label?: string|null } | null
    }
  })

  interface SwipeQueryResult { profiles: CardProfile[]; boostSet: Set<string>; myInterests: string[] }
  const { data, isLoading, refetch } = useQuery<SwipeQueryResult>({
    enabled: !!user,
    // Include lat/lng in the key so a location change forces refetch
    queryKey: ['classic-swipe-profiles', user?.id, myLoc?.lat ?? null, myLoc?.lng ?? null],
    queryFn: async (): Promise<SwipeQueryResult> => {
      if (!user?.id) return { profiles: [], boostSet: new Set(), myInterests: [] }

      // Preferred path: SECURITY DEFINER RPC returns cards with profile fields (bypasses RLS)
      try {
        const { data: cardRows, error: cardsErr } = await supabase
          .rpc('classic_candidates_cards', { p_user_id: user.id, p_limit: 200 })
        if (!cardsErr && Array.isArray(cardRows) && cardRows.length) {
          const profiles: CardProfile[] = cardRows
            .filter((r: any) => r.candidate_id !== user.id)
            .map((r: any) => ({
              id: r.candidate_id,
              name: r.display_name ?? 'Usuario',
              age: typeof r.calculated_age === 'number' ? r.calculated_age : null,
              interests: [],
              avatar: r.avatar_url || null,
              gender: (r.gender ?? null),
              interested_in: Array.isArray(r.interested_in) ? r.interested_in : [],
              seeking: Array.isArray(r.seeking) ? r.seeking : [],
              photos: [],
              prompts: []
            }))

          // Boosters: who gave me superlike (any context)
          const { data: boosters } = await supabase
            .from('likes')
            .select('liker')
            .eq('liked', user!.id)
            .eq('type', 'superlike')
          const idsAll = profiles.map(p => p.id)
          const boostSet = new Set<string>((boosters || []).map(b => (b as any).liker).filter((id: string) => idsAll.includes(id)))

          const boostersList = profiles.filter(p => boostSet.has(p.id))
          const others = profiles.filter(p => !boostSet.has(p.id))
          const collator = new Intl.Collator('es', { sensitivity:'base' })
          const sorter = (a: CardProfile, b: CardProfile) => {
            const na = a.name || ''
            const nb = b.name || ''
            const primary = collator.compare(na, nb)
            if (primary !== 0) return primary
            return a.id.localeCompare(b.id)
          }
          boostersList.sort(sorter)
          others.sort(sorter)

          // My interests (optional, best-effort)
          let myInterests: string[] = []
          try {
            const { data: myRows } = await supabase
              .from('profile_interests')
              .select('interests(name)')
              .eq('profile_id', user!.id)
            ;(myRows || []).forEach((r: any) => { const n = r.interests?.name; if (typeof n === 'string' && n.length) myInterests.push(n) })
            myInterests = Array.from(new Set(myInterests))
          } catch {}

          return { profiles: [...boostersList, ...others], boostSet, myInterests }
        }
      } catch (e) {
        console.warn('[classic] cards RPC error', (e as any)?.message)
      }

      // Fallback path: legacy RPC + client-side profile fetch (may be blocked by RLS)
      const { data: candRows, error: candErr } = await supabase
        .rpc('classic_candidates_simple', { p_user_id: user.id, p_limit: 200 })
      if (candErr) console.warn('[classic] rpc error', candErr.message)
      const ids = (candRows || []).map((r: any) => r.candidate_id).filter((id: string) => id !== user!.id)
      if (!ids.length) return { profiles: [], boostSet: new Set(), myInterests: [] }

      const normalizeLabel = (raw?: string | null): string | null => {
        if (!raw) return null
        const s = raw.toLowerCase().trim()
        if (['male','man','men','m','hombre','hombres','masculino','masculinos'].includes(s)) return 'male'
        if (['female','woman','women','f','mujer','mujeres','femenino','femeninos','femenina','femeninas'].includes(s)) return 'female'
        if (['other','others','otro','otra','otros','otras','no binario','no-binario','nobinario','nonbinary','non-binary','non binary','nb','x','otro género','otro genero','otrx'].includes(s)) return 'other'
        if (['everyone','all','cualquiera','todos','todas','any'].includes(s)) return '*'
        return s
      }
      const normalizeArr = (arr?: string[] | null): string[] => {
        if (!Array.isArray(arr)) return []
        return Array.from(new Set(arr.map(a => normalizeLabel(a)).filter(Boolean) as string[]))
      }

      // Expand legacy orientation codes to target genders for compatibility
      const expandInterested = (list: string[], selfGender: string | null): string[] => {
        if (!list || list.length === 0) return []
        if (list.includes('*')) return ['*']
        const out = new Set<string>()
        const add = (x?: string | null) => { if (!x) return; if (x === 'nonbinary') out.add('other'); else out.add(x) }
        for (const raw of list) {
          const v = (raw || '').toLowerCase()
          if (v === '*' || v === 'everyone' || v === 'all' || v === 'cualquiera' || v === 'todos' || v === 'todas' || v === 'any') { out.add('*'); continue }
          if (v === 'male' || v === 'hombre' || v === 'hombres' || v === 'm') { out.add('male'); continue }
          if (v === 'female' || v === 'mujer' || v === 'mujeres' || v === 'f') { out.add('female'); continue }
          if (v === 'other' || v === 'nonbinary' || v === 'no binario' || v === 'nb') { out.add('other'); continue }
          if (v === 'bi' || v === 'bisexual') { out.add('male'); out.add('female'); continue }
          if (v === 'straight' || v === 'hetero' || v === 'heterosexual') {
            if (selfGender === 'male') add('female')
            else if (selfGender === 'female') add('male')
            else out.add('*')
            continue
          }
          if (v === 'gay') {
            if (selfGender === 'male') add('male')
            else if (selfGender === 'female') add('female')
            else out.add('*')
            continue
          }
          if (v === 'lesbian' || v === 'lesbiana') { add('female'); continue }
        }
        return Array.from(out)
      }

      const { data: profsIn, error: profsErr } = await supabase
        .from('profiles')
        .select('id, display_name, calculated_age, gender, avatar_url, interested_in, seeking')
        .in('id', ids)
      if (profsErr) console.warn('[classic] profiles .in error', profsErr.message)
      let profilesSource: ProfileRow[] = profsIn || []
      if (!profsErr && profilesSource.length === 0 && ids.length > 0) {
        const fallback: ProfileRow[] = []
        for (const id of ids) {
          const { data: one } = await supabase
            .from('profiles')
            .select('id, display_name, calculated_age, gender, avatar_url, interested_in, seeking')
            .eq('id', id)
            .maybeSingle()
          if (one) fallback.push(one as ProfileRow)
        }
        if (fallback.length) profilesSource = fallback
      }

      let photosMap = new Map<string, { id: number; url: string; sort_order: number }[]>()
      if (profilesSource.length) {
        const { data: photosRows, error: photosErr } = await supabase
          .from('user_photos')
          .select('id, user_id, url, sort_order')
          .in('user_id', profilesSource.map(p => p.id))
        if (photosErr) console.warn('[classic] photos error', photosErr.message)
        ;(photosRows || []).forEach((r: any) => {
          if (!r.user_id) return
          const arr = photosMap.get(r.user_id) || []
          arr.push({ id: r.id, url: r.url, sort_order: r.sort_order ?? 0 })
          photosMap.set(r.user_id, arr)
        })
        photosMap.forEach((arr, k) => photosMap.set(k, arr.sort((a,b)=> (a.sort_order??0)-(b.sort_order??0))))
      }

      let promptsMap = new Map<string, { id: number; prompt_id: number; question?: string; response: any; key?: string; choices_labels?: Record<string,string>|null }[]>()
      if (profilesSource.length) {
        const { data: promptsRows, error: promErr } = await supabase
          .from('profile_prompts')
          .select('id, prompt_id, answer, profile_id, profile_prompt_templates(question, key, profile_prompt_template_locales(locale,title,choices_labels))')
          .in('profile_id', profilesSource.map(p => p.id))
        if (promErr) console.warn('[classic] prompts error', promErr.message)
        function parseArrayLike(val: any): any {
          if (Array.isArray(val)) return val
          if (typeof val === 'string') {
            const s = val.trim()
            if (s.startsWith('[') && s.endsWith(']')) { try { const parsed = JSON.parse(s); if (Array.isArray(parsed)) return parsed } catch {} }
            if (s.startsWith('{') && s.endsWith('}')) {
              const inner = s.slice(1, -1)
              if (!inner) return []
              const parts = inner.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g,''))
              return parts.filter(p => p.length > 0)
            }
          }
          return val
        }
        ;(promptsRows || []).forEach((r: any) => {
          const arr = promptsMap.get(r.profile_id) || []
          let resp = r.answer ?? ''
          resp = parseArrayLike(resp)
          let localizedQ: string | undefined = undefined
          let choicesLabels: Record<string,string>|null = null
          const locales = r.profile_prompt_templates?.profile_prompt_template_locales
          if (Array.isArray(locales)) {
            const es = locales.find((l: any) => l?.locale === 'es')
            if (es?.title) localizedQ = es.title
            if (es?.choices_labels && typeof es.choices_labels === 'object') choicesLabels = es.choices_labels
            if (!localizedQ) {
              const en = locales.find((l:any)=> l?.locale==='en' && l.title)
              if (en?.title) localizedQ = en.title
              if (!choicesLabels && en?.choices_labels && typeof en.choices_labels === 'object') choicesLabels = en.choices_labels
            }
          }
          arr.push({ id: r.id, prompt_id: r.prompt_id, question: localizedQ || r.profile_prompt_templates?.question, response: resp, key: r.profile_prompt_templates?.key, choices_labels: choicesLabels })
          promptsMap.set(r.profile_id, arr)
        })
        promptsMap.forEach((arr, k) => promptsMap.set(k, arr.sort((a,b)=> a.prompt_id - b.prompt_id)))
      }

      const { data: interestRows, error: intErr } = await supabase
        .from('profile_interests')
        .select('profile_id, interests(name)')
        .in('profile_id', ids)
      if (intErr) console.warn('[classic] interests error', intErr.message)
      const interestsMap = new Map<string, string[]>()
      ;(interestRows || []).forEach((r: any) => {
        const name = r.interests?.name
        if (typeof name === 'string' && name.length > 0) {
          const arr = interestsMap.get(r.profile_id) || []
          arr.push(name)
          interestsMap.set(r.profile_id, arr)
        }
      })
      interestsMap.forEach((arr, k) => interestsMap.set(k, Array.from(new Set(arr))))

      let myInterests: string[] = []
      try {
        const { data: myRows } = await supabase
          .from('profile_interests')
          .select('interests(name)')
          .eq('profile_id', user!.id)
        ;(myRows || []).forEach((r: any) => { const n = r.interests?.name; if (typeof n === 'string' && n.length) myInterests.push(n) })
        myInterests = Array.from(new Set(myInterests))
      } catch {}

      const profiles: CardProfile[] = (profilesSource || []).map((p: ProfileRow) => ({
        id: p.id,
        name: p.display_name ?? 'Usuario',
        age: typeof p.calculated_age === 'number' ? p.calculated_age : null,
        interests: (interestsMap.get(p.id) || []).slice(0, 6),
        avatar: p.avatar_url || null,
        gender: normalizeLabel(p.gender) || null,
        interested_in: normalizeArr(p.interested_in),
        seeking: normalizeArr(p.seeking),
        photos: photosMap.get(p.id) || [],
        prompts: promptsMap.get(p.id) || []
      }))

      const { data: meProfileRaw } = await supabase
        .from('profiles')
        .select('gender, interested_in, seeking')
        .eq('id', user!.id)
        .maybeSingle()
  const gMe = normalizeLabel(meProfileRaw?.gender as string | null)
  const myInterestedInRaw: string[] = normalizeArr(meProfileRaw?.interested_in as any)
  const myInterestedIn = expandInterested(myInterestedInRaw, gMe)

      const wants = (list: string[], other: string | null): boolean => {
        if (!other) return true
        if (!list.length) return true
        if (list.includes('*')) return true
        return list.includes(other)
      }
      const hasMutual = (p: CardProfile): boolean => {
        const gOther = p.gender
        if (!gMe || !gOther) return true
        const otherTargets = expandInterested(p.interested_in || [], gOther)
        const iWant = wants(myInterestedIn, gOther)
        const otherWants = wants(otherTargets, gMe)
        return iWant && otherWants
      }

      const pending = profiles.filter(p => hasMutual(p))

      // Boosters: who gave me superlike (any context)
      const { data: boosters } = await supabase
        .from('likes')
        .select('liker')
        .eq('liked', user!.id)
        .eq('type', 'superlike')
      const boostSet = new Set<string>((boosters || []).map(b => (b as any).liker).filter((id: string) => ids.includes(id)))

      const boostersList = pending.filter(p => boostSet.has(p.id))
      const others = pending.filter(p => !boostSet.has(p.id))
      const collator = new Intl.Collator('es', { sensitivity:'base' })
      const sorter = (a: CardProfile, b: CardProfile) => {
        const na = a.name || ''
        const nb = b.name || ''
        const primary = collator.compare(na, nb)
        if (primary !== 0) return primary
        return a.id.localeCompare(b.id)
      }
      boostersList.sort(sorter)
      others.sort(sorter)
      const ordered = [...boostersList, ...others]
      return { profiles: ordered, boostSet, myInterests }
    }
  })

  const swipeData: SwipeQueryResult | undefined = data as SwipeQueryResult | undefined
  const deck = swipeData?.profiles || []

  const [uiDeck, setUiDeck] = useState<CardProfile[]>([])
  const decidedRef = useRef<Set<string>>(new Set())
  // Reset/reconcile deck when backend candidates change (prevents stale cards after location change)
  useEffect(() => {
    if (!deck) { setUiDeck([]); return }
    const next = deck.filter(p => !decidedRef.current.has(p.id))
    setUiDeck(next)
  }, [deck.map(p=>p.id).join('|')])

  // If location changes, clear UI deck immediately to avoid flashing old candidates
  useEffect(() => {
    // myLoc drives queryKey, but clear UI eagerly for UX
    if (typeof myLoc?.lat === 'number' && typeof myLoc?.lng === 'number') {
      setUiDeck([])
    }
  }, [myLoc?.lat, myLoc?.lng])

  const current = uiDeck[0]
  const next = uiDeck[1]
  const [photoIndex, setPhotoIndex] = useState(0)
  useEffect(()=>{ setPhotoIndex(0) }, [current?.id])
  const isDraggingRef = useRef(false)
  const gestureModeRef = useRef<'undecided' | 'photo' | 'card'>('undecided')
  const startXRef = useRef<number | null>(null)
  const lastPhotoCommitRef = useRef(0)
  const actionsCountRef = useRef(0)
  const photoAutoProgress = useSharedValue(0)
  const pauseRef = useRef(false)
  const startTsRef = useRef(0)
  const totalDurationRef = useRef(AUTO_ADVANCE_INTERVAL_MS)
  const remainingRef = useRef(AUTO_ADVANCE_INTERVAL_MS)

  const launchProgress = useCallback(() => {
    cancelAnimation(photoAutoProgress)
    if (!AUTO_ADVANCE) { photoAutoProgress.value = 1; return }
    if (!current || !current.photos || current.photos.length <= 1) { photoAutoProgress.value = 1; return }
    const last = photoIndex >= current.photos.length - 1
    if (last) { photoAutoProgress.value = 1; return }
    pauseRef.current = false
    photoAutoProgress.value = 0
    totalDurationRef.current = AUTO_ADVANCE_INTERVAL_MS
    remainingRef.current = AUTO_ADVANCE_INTERVAL_MS
    startTsRef.current = Date.now()
    const baseIndex = photoIndex
    photoAutoProgress.value = withTiming(1, { duration: remainingRef.current }, (finished) => {
      if (finished) runOnJS(setPhotoIndex)(baseIndex + 1)
    })
  }, [current?.id, current?.photos?.length, photoIndex])

  useEffect(() => { launchProgress() }, [current?.id, photoIndex, current?.photos?.length])

  const pausePhotoProgress = useCallback(() => {
    if (pauseRef.current) return
    if (!AUTO_ADVANCE) return
    if (!current || !current.photos || current.photos.length <= 1) return
    const last = photoIndex >= current.photos.length - 1
    if (last) return
    pauseRef.current = true
    const progress = photoAutoProgress.value
    cancelAnimation(photoAutoProgress)
    remainingRef.current = Math.max(16, (1 - progress) * totalDurationRef.current)
  }, [current?.photos?.length, photoIndex])

  const resumePhotoProgress = useCallback(() => {
    if (!AUTO_ADVANCE) return
    if (!pauseRef.current) return
    const last = photoIndex >= (current?.photos?.length || 0) - 1
    if (last) { photoAutoProgress.value = 1; return }
    pauseRef.current = false
    startTsRef.current = Date.now()
    const baseIndex = photoIndex
    photoAutoProgress.value = withTiming(1, { duration: remainingRef.current }, (finished) => {
      if (finished) runOnJS(setPhotoIndex)(baseIndex + 1)
    })
  }, [current?.photos?.length, photoIndex])

  useEffect(() => {
    if (next?.avatar) Image.prefetch(next.avatar).catch(()=>{})
    ;(next?.photos || []).slice(0,3).forEach((p: { url: string }) => { if (p.url) Image.prefetch(p.url).catch(()=>{}) })
  }, [next?.avatar, next?.photos])

  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const superProgress = useSharedValue(0)

  const resetCard = () => {
    translateX.value = withSpring(0)
    translateY.value = withSpring(0)
    superProgress.value = 0
  }
  const advance = () => {
    setUiDeck(prev => prev.slice(1))
  }

  const [match, setMatch] = useState<{ targetId: string; matchId: string | number } | null>(null)
  const busyRef = useRef(false)

  const performAction = useCallback(async (targetId: string, type: 'like' | 'pass' | 'superlike') => {
    if (!user) return
    if (busyRef.current) return
    busyRef.current = true
    if (type === 'superlike' && remaining <= 0) {
      Alert.alert('Límite alcanzado', 'Has usado tus 3 superlikes de hoy.')
      resetCard()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{})
      busyRef.current = false
      return
    }
    // Do not advance yet; only advance after a successful upsert.
    // This prevents skipping the card if the DB rejects the action (e.g., superlike quota).
    try {
      if (type === 'pass') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{})
      else if (type === 'like') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{})
      else if (type === 'superlike') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(()=>{})

      const payload: any = { liker: user.id, liked: targetId, type, created_at: new Date().toISOString(), context_event_id: null }
      const { error: likeErr } = await supabase.from('likes').upsert(payload, { onConflict: 'liker,liked,context_event_id' })
      if (likeErr) {
        // Handle DB-enforced quota or other errors gracefully
        if (type === 'superlike') {
          Alert.alert('Límite alcanzado', 'Has usado tus 3 superlikes de hoy.')
          try { refetchRemaining() } catch {}
          // Bring the card back since action failed
          resetCard()
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{})
        } else {
          console.warn('[classic] like upsert error', likeErr.message)
          // Non-superlike errors: also restore the card
          resetCard()
        }
        return
      }
      if (type === 'superlike') { try { incSuperlike(user.id) } catch {}; refetchRemaining() }
      if (type === 'like' || type === 'superlike') {
        const { matched, matchId } = await ensureMatchConsistency(user.id, targetId)
        if (matched && matchId != null) setMatch({ targetId, matchId })
      }
      qc.invalidateQueries({ queryKey: ['classic-swipe-profiles', user?.id] })
      // Cross-context: refrescar cualquier feed de evento abierto para excluir al usuario recién decidido
      qc.invalidateQueries({ queryKey: ['event-swipe-profiles'] })
      // Actualizar contadores/listas derivadas del feed (si están en uso)
      qc.invalidateQueries({ queryKey: ['my-feed-events-with-pending', user?.id] })
      // Only now mark as decided and advance the deck
      decidedRef.current.add(targetId)
      advance()
      translateX.value = 0; translateY.value = 0; superProgress.value = 0
    } finally {
      actionsCountRef.current += 1
      if (tutorialVisibleRef.current && actionsCountRef.current >= TUTORIAL_ACTIONS_AUTO_DISMISS) {
        runOnJS(dismissTutorial)()
      }
      setTimeout(()=>{ busyRef.current = false }, 120)
    }
  }, [user, remaining])

  useEffect(() => {
    const id = setInterval(() => { refetch(); refetchRemaining() }, 45000)
    return () => clearInterval(id)
  }, [refetch, refetchRemaining])

  // Realtime: refetch when my profile location changes while Classic is open
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase
      .channel('classic-ploc-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profile_locations', filter: `user_id=eq.${user.id}` },
        () => { try { refetch() } catch {} }
      )
      .subscribe()
    return () => { try { supabase.removeChannel(ch) } catch {} }
  }, [user?.id, refetch])

  const cardStyle = useAnimatedStyle(() => {
    const rawAngle = translateX.value / 18
    const clamped = Math.max(-12, Math.min(12, rawAngle))
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${clamped}deg` }
      ]
    }
  })
  const likeOpacityStyle = useAnimatedStyle(() => ({ opacity: translateX.value > 0 ? Math.min(1, translateX.value / SWIPE_THRESHOLD_X) : 0 }))
  const nopeOpacityStyle = useAnimatedStyle(() => ({ opacity: translateX.value < 0 ? Math.min(1, -translateX.value / SWIPE_THRESHOLD_X) : 0 }))
  const superOpacityStyle = useAnimatedStyle(() => ({ opacity: translateY.value < 0 ? Math.min(1, -translateY.value / SWIPE_THRESHOLD_Y) : 0 }))
  const parallaxStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value * PARALLAX_FACTOR }] }))
  const haloStyle = useAnimatedStyle(() => ({
    opacity: superProgress.value,
    transform: [ { scale: 0.8 + superProgress.value * 0.6 } ]
  }))

  const particles = useMemo(() => Array.from({ length: SUPERLIKE_PARTICLES }).map((_, i) => ({
    id: i,
    offsetX: (Math.random() * 140) - 70,
    delay: Math.random() * 0.25,
    height: 140 + Math.random()*60,
    size: 8 + Math.random()*10
  })), [])
  // The following line intentionally calls a Reanimated hook inside a map over a fixed-size array.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const particleStyles = particles.map(p => useAnimatedStyle(() => {
    const prog = superProgress.value
    const local = Math.max(0, prog - p.delay) / (1 - p.delay || 1)
    const clamped = Math.min(1, Math.max(0, local))
    return {
      opacity: clamped > 0.05 ? (1 - clamped) : 0,
      transform: [
        { translateY: -clamped * p.height },
        { translateX: p.offsetX * (1 - clamped) },
        { scale: 0.6 + clamped * 0.8 }
      ]
    }
  }))

  const onEnd = ({ nativeEvent }: any) => {
    const { translationX, translationY } = nativeEvent
    isDraggingRef.current = false
    const mode = gestureModeRef.current
    if (translationY < -SWIPE_THRESHOLD_Y && current) {
      translateY.value = withTiming(-height, { duration:250 }, () => runOnJS(performAction)(current.id, 'superlike'))
      gestureModeRef.current = 'undecided'
      startXRef.current = null
      lastPhotoCommitRef.current = 0
      return
    }
    if (mode === 'card') {
      if (translationX > SWIPE_THRESHOLD_X && current) { translateX.value = withTiming(width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'like')) } 
      else if (translationX < -SWIPE_THRESHOLD_X && current) { translateX.value = withTiming(-width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'pass')) } 
      else { resetCard() }
    } else {
      resetCard()
    }
    gestureModeRef.current = 'undecided'
    startXRef.current = null
    lastPhotoCommitRef.current = 0
  }
  const handleGestureEvent = useCallback((evt: any) => {
    const { translationX, translationY, x } = evt.nativeEvent
    if (!isDraggingRef.current && (Math.abs(translationX) > 6 || Math.abs(translationY) > 6)) {
      isDraggingRef.current = true
    }
    const photosLen = current?.photos?.length || 0
    if (startXRef.current == null && typeof x === 'number') startXRef.current = x
    const mode = gestureModeRef.current
    const horizontalDominant = Math.abs(translationX) > Math.abs(translationY)
    if (mode === 'undecided') {
      if (horizontalDominant && photosLen > 1 && startXRef.current != null) {
        const EDGE_ZONE_PX = CARD_WIDTH * EDGE_ZONE_RATIO
        const inEdge = startXRef.current < EDGE_ZONE_PX || startXRef.current > (CARD_WIDTH - EDGE_ZONE_PX)
        gestureModeRef.current = inEdge ? 'photo' : 'card'
        if (gestureModeRef.current === 'photo') {
          lastPhotoCommitRef.current = 0
        }
      } else {
        gestureModeRef.current = 'card'
      }
    }
    if (gestureModeRef.current === 'photo') {
      if (Math.abs(translationX) >= PROMOTE_DISTANCE) {
        gestureModeRef.current = 'card'
        translateX.value = translationX
        translateY.value = translationY
        return
      }
      const delta = translationX - lastPhotoCommitRef.current
      if (delta > PHOTO_SWIPE_DISTANCE) {
        setPhotoIndex(idx => {
          const nextIdx = idx - 1
          return nextIdx < 0 ? 0 : nextIdx
        })
        lastPhotoCommitRef.current = translationX
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{})
      } else if (delta < -PHOTO_SWIPE_DISTANCE) {
        setPhotoIndex(idx => {
          const nextIdx = idx + 1
          return nextIdx >= photosLen ? photosLen - 1 : nextIdx
        })
        lastPhotoCommitRef.current = translationX
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{})
      }
      translateX.value = 0; translateY.value = 0
      return
    }
    translateX.value = translationX; translateY.value = translationY
    superProgress.value = translationY < 0 ? Math.min(1, Math.abs(translationY) / SWIPE_THRESHOLD_Y) : 0
  }, [current?.photos?.length])

  const PROMPT_Q_MAP: Record<string,string> = {
    'Describe your personality':'Describe tu personalidad',
    'What is your perfect plan?':'¿Cuál es tu plan perfecto?',
    'Two truths and one lie':'Dos verdades y una mentira',
    "The most spontaneous thing you've done":'Lo más espontáneo que has hecho'
  }
  const PROMPT_A_MAP: Record<string,string> = {
    creative:'Creativa', adventurous:'Aventurera', analytical:'Analítica', empathetic:'Empática', funny:'Divertida', ambitious:'Ambiciosa',
    coffeeChat:'Charla con café', museumVisit:'Visitar un museo', hikingNature:'Senderismo', cookingTogether:'Cocinar juntos', liveMusic:'Música en vivo', movieMarathon:'Maratón de pelis',
    traveled10:'Viajé a 10 países', playsInstrument:'Toco un instrumento', climbedVolcano:'Subí un volcán', polyglot:'Soy políglota', ranMarathon:'Corrí una maratón', neverOnPlane:'Nunca volé en avión',
    lastMinuteTrip:'Viaje improvisado', boughtConcert:'Entradas de concierto última hora', changedCareer:'Cambio de carrera repentino', movedCity:'Mudanza inesperada', dancedRain:'Bailé bajo la lluvia', randomRoadtrip:'Roadtrip aleatorio'
  }
  const PROMPT_KEY_Q_MAP: Record<string,string> = {
    myPersonality:'Describe tu personalidad',
    myPerfectPlan:'¿Cuál es tu plan perfecto?',
    twoTruthsOneLie:'Dos verdades y una mentira',
    theMostSpontaneous:'Lo más espontáneo que has hecho'
  }
  const tPromptQ = (q?: string, key?: string) => (key && PROMPT_KEY_Q_MAP[key]) || (q && PROMPT_Q_MAP[q]) || q || ''
  const tAnswer = (val: any, customMap?: Record<string,string>|null) => {
    const mapLookup = (v: any) => (customMap && customMap[v]) || PROMPT_A_MAP[v] || String(v)
    if (Array.isArray(val)) return val.map(mapLookup).join(', ')
    return mapLookup(String(val))
  }

  const hashId = (id: string) => { let h = 0; for (let i=0;i<id.length;i++) { h = (h * 131 + id.charCodeAt(i)) >>> 0 } return h }
  const promptOrder = useMemo(() => {
    if (!current?.prompts) return [] as any[]
    const valid = current.prompts.filter(p => {
      if (!p) return false; const r = p.response; if (Array.isArray(r)) return r.length>0; if (typeof r === 'string') return r.trim().length>0; return r != null && String(r).trim().length>0; })
    if (valid.length <= 1) return valid
    const seedBase = hashId(current.id) || 1
    let seed = seedBase
    const nextRand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff }
    const arr = [...valid]
    for (let i = arr.length -1; i>0; i--) {
      const r = Math.floor(nextRand() * (i+1))
      ;[arr[i], arr[r]] = [arr[r], arr[i]]
    }
    return arr
  }, [current?.id, current?.prompts])
  const currentPrompt = (photoIndex < promptOrder.length) ? promptOrder[photoIndex] : null
  const renderSinglePrompt = () => {
    if (!currentPrompt) return null
    const respRaw = currentPrompt.response
    const isArray = Array.isArray(respRaw)
    const answerText = !isArray ? tAnswer(String(respRaw).trim(), (currentPrompt as any).choices_labels) : ''
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
    )
  }

  const boosterTipShownRef = useRef(false)
  const [showBoosterTip, setShowBoosterTip] = useState(false)
  useEffect(() => {
    if (current && swipeData?.boostSet?.has(current.id) && !boosterTipShownRef.current) {
      boosterTipShownRef.current = true
      setShowBoosterTip(true)
      const t = setTimeout(()=> setShowBoosterTip(false), 3200)
      return () => clearTimeout(t)
    } else if (!current) {
      setShowBoosterTip(false)
    }
  }, [current?.id, (data as any)?.boostSet])

  const [tutorialVisible, setTutorialVisible] = useState(false)
  const tutorialVisibleRef = useRef(false)
  const dismissTutorial = useCallback(() => { setTutorialVisible(false); tutorialVisibleRef.current = false }, [])
  useEffect(() => { if (!tutorialVisibleRef.current) { setTutorialVisible(true); tutorialVisibleRef.current = true } }, [])

  const EmptyState = () => {
    if (!myLoc || (typeof myLoc.lat !== 'number' || typeof myLoc.lng !== 'number')) {
      // No location: prompt to configure
      return (
        <YStack style={{ flex:1, justifyContent:'center', alignItems:'center', padding:32 }}>
          <View style={{ width:140, height:140, marginBottom:12, opacity:0.9 }}>
            <Image source={require('../../../assets/unmatched.png')} style={{ width:'100%', height:'100%', tintColor: theme.colors.primary, opacity:0.85 }} resizeMode='contain' />
          </View>
          <Text style={{ color: theme.colors.text, fontSize:20, fontWeight:'800', marginBottom:8 }}>Configura tu ubicación</Text>
          <Text style={{ color: theme.colors.subtext, textAlign:'center', marginBottom:24 }}>
            Para descubrir gente cercana, selecciona tu ciudad o permite acceso a la ubicación.
          </Text>
          <XStack style={{ flexDirection:'row', gap:14, flexWrap:'wrap', justifyContent:'center' }}>
            <Pressable onPress={() => router.push('/(tabs)/profile/location')} style={() => ({ paddingHorizontal:22, paddingVertical:13, borderRadius:30, backgroundColor: theme.colors.primary, borderWidth:1, borderColor: theme.colors.primary })}>
              <Text style={{ color: theme.colors.primaryText || '#fff', fontWeight:'700' }}>Configurar ubicación</Text>
            </Pressable>
          </XStack>
        </YStack>
      )
    }
    // Location set but no candidates: show reload
    return (
      <YStack style={{ flex:1, justifyContent:'center', alignItems:'center', padding:32 }}>
        <View style={{ width:140, height:140, marginBottom:12, opacity:0.9 }}>
          <Image source={require('../../../assets/unmatched.png')} style={{ width:'100%', height:'100%', tintColor: theme.colors.primary, opacity:0.85 }} resizeMode='contain' />
        </View>
        <Text style={{ color: theme.colors.text, fontSize:20, fontWeight:'800', marginBottom:8 }}>No hay más personas</Text>
        <Text style={{ color: theme.colors.subtext, textAlign:'center', marginBottom:24 }}>
          Cuando haya más personas compatibles aparecerán aquí.
        </Text>
        <XStack style={{ flexDirection:'row', gap:14, flexWrap:'wrap', justifyContent:'center' }}>
          <Pressable onPress={() => refetch()} style={({pressed})=>({ paddingHorizontal:22, paddingVertical:13, borderRadius:30, backgroundColor: pressed? theme.colors.primary: theme.colors.card, borderWidth:1, borderColor: theme.colors.primary })}>
            <Text style={{ color: theme.colors.primary, fontWeight:'700' }}>Recargar</Text>
          </Pressable>
        </XStack>
      </YStack>
    )
  }

  return (
    <Screen style={{ padding:0 }}>
      {/* Realtime: refetch when my profile location changes */}
      {/* This ensures immediate refresh if location is updated while Classic is open */}
      {isLoading && (
        <YStack style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </YStack>
      )}
      {!isLoading && !current && <EmptyState />}
      {!isLoading && current && (
        <View style={{ flex:1, alignItems:'center', paddingTop: CARD_TOP_PADDING, paddingBottom: ACTION_BAR_SPACER }}>
          {next && (
            <View pointerEvents='none' style={{ position:'absolute', top: CARD_TOP_PADDING, width:CARD_WIDTH, height:CARD_HEIGHT, borderRadius:24, overflow:'hidden', backgroundColor: theme.colors.card, opacity:0.4 }} />
          )}
          <PanGestureHandler onGestureEvent={handleGestureEvent} onEnded={onEnd}>
            <Animated.View style={[{ width:CARD_WIDTH, height:CARD_HEIGHT, borderRadius:24, overflow:'hidden', backgroundColor: theme.colors.card }, cardStyle]}>
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
                {current.photos && current.photos.length > 1 && (
                  <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0 }}>
                    <Pressable onPress={() => setPhotoIndex(i => i <= 0 ? 0 : i - 1)} style={{ position:'absolute', top:0, bottom:0, left:0, width:'30%' }} android_ripple={{ color:'#00000022' }} />
                    <Pressable onPress={() => setPhotoIndex(i => i >= current.photos.length -1 ? i : i + 1)} style={{ position:'absolute', top:0, bottom:0, right:0, width:'30%' }} android_ripple={{ color:'#00000022' }} />
                    <View style={{ position:'absolute', top:8, left:8, right:8, flexDirection:'row', gap:4 }}>
                      {current.photos.map((p: { id: number }, idx: number) => (
                        <PhotoProgressSegment
                          key={p.id}
                          idx={idx}
                          activeIndex={photoIndex}
                          progress={photoAutoProgress}
                          onPress={() => { cancelAnimation(photoAutoProgress); setPhotoIndex(idx) }}
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
              <Pressable onPress={() => { setMatch(null) }} style={() => ({ paddingVertical:12, paddingHorizontal:20, borderRadius:30, backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border })}>
                <Text style={{ color: theme.colors.text, fontWeight:'700' }}>Seguir</Text>
              </Pressable>
              <Pressable onPress={() => { const { matchId } = match; setMatch(null); router.push(`/(tabs)/chat/${matchId}`) }} style={() => ({ paddingVertical:12, paddingHorizontal:20, borderRadius:30, backgroundColor: theme.colors.primary, borderWidth:1, borderColor: theme.colors.primary })}>
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
  )
}
