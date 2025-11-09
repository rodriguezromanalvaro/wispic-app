import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react'

import { View, Text, Dimensions, Image, ActivityIndicator, Alert, Pressable } from 'react-native'

import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { PanGestureHandler } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS, cancelAnimation } from 'react-native-reanimated'

import { YStack, XStack } from 'components/tg'
import { Screen } from 'components/ui'
import { SwipeButtons } from 'features/profile/ui/swipe/SwipeButtons'
import { SWIPE } from 'features/swipe/constants'

// lib imports alphabetized
import { truncateByGraphemes } from 'lib/graphemes'
import { i18n } from 'lib/i18n'
import { ensureMatchConsistency } from 'lib/match'
import { ensurePresence, useOnlineIds } from 'lib/presence'
import { getLocaleChain, pickFirstNonEmptyTitle, mergeChoiceLabels } from 'lib/promptLocale'
import { remainingSuperlikes, incSuperlike } from 'lib/superlikes'
import { supabase } from 'lib/supabase'
import { theme } from 'lib/theme'
import { formatDistanceKm } from 'lib/ui/formatDistance'
import { prefixIcon } from 'lib/ui/prefixIcon'
import { useAuth } from 'lib/useAuth'
import { normalizeAvatarUrl } from 'lib/avatars'

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
  photosVersion?: string | null;
}

const { width, height } = Dimensions.get('window')
const CARD_WIDTH = width
const HEADER_SPACER = 8
const ACTION_BAR_SPACER = 150
const RAW_CARD_HEIGHT = height * 0.72
const EXTRA_TOP_OFFSET = 0
const CARD_TOP_PADDING = HEADER_SPACER + 10 + EXTRA_TOP_OFFSET
const CARD_BOTTOM_PADDING = ACTION_BAR_SPACER
const AVAILABLE_HEIGHT = height - CARD_TOP_PADDING - CARD_BOTTOM_PADDING
let CARD_HEIGHT = AVAILABLE_HEIGHT
const INFO_OVERLAY_RAISE = SWIPE.INFO_OVERLAY_RAISE
const SWIPE_THRESHOLD_X = SWIPE.SWIPE_THRESHOLD_X
const SWIPE_THRESHOLD_Y = SWIPE.SWIPE_THRESHOLD_Y
const AUTO_ADVANCE = SWIPE.AUTO_ADVANCE
const AUTO_ADVANCE_INTERVAL_MS = SWIPE.AUTO_ADVANCE_INTERVAL_MS
const EDGE_ZONE_RATIO = SWIPE.CARD_EDGE_ZONE_RATIO
const PHOTO_SWIPE_DISTANCE = SWIPE.PHOTO_SWIPE_DISTANCE
const PROMOTE_DISTANCE = SWIPE.SWIPE_THRESHOLD_X * 0.52
const SUPERLIKE_ACTIVATION_Y = SWIPE.SUPERLIKE_ACTIVATION_Y
const SUPERLIKE_PARTICLES = SWIPE.SUPERLIKE_PARTICLES
const PARALLAX_FACTOR = SWIPE.PARALLAX_FACTOR
const TUTORIAL_ACTIONS_AUTO_DISMISS = 3
// Minimal outer inset so the card doesn't touch screen edges
const OUTER_INSET = 6

// Small helper to build rgba from hex (for subtle primary background in common chips)
const colorWithAlpha = (hex: string, alpha: number) => {
  if (!hex) return `rgba(0,0,0,${alpha})`
  let h = hex.trim()
  if (h.startsWith('#')) h = h.slice(1)
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  if (h.length >= 6) {
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  return `rgba(0,0,0,${alpha})`
}

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
  const DEBUG_PHOTO = process.env.EXPO_PUBLIC_SWIPE_PHOTO_DEBUG === '1'

  // Start realtime presence for current user (once per mount)
  useEffect(() => { if (user?.id) ensurePresence(user.id) }, [user?.id])

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

  const PAGE_SIZE = 50
  interface SwipePage { profiles: CardProfile[]; boostSet: Set<string>; myInterests: string[]; usedRpc: boolean }
  const { data, isLoading, fetchNextPage, hasNextPage, refetch } = useInfiniteQuery<SwipePage>({
    enabled: !!user,
    queryKey: ['classic-swipe-profiles-v2', user?.id, myLoc?.lat ?? null, myLoc?.lng ?? null],
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages, lastOffset) => {
      // Si la página llegó llena, asumimos que puede haber más
      return lastPage?.profiles?.length === PAGE_SIZE ? (Number(lastOffset) + PAGE_SIZE) : undefined
    },
  queryFn: async ({ pageParam }): Promise<SwipePage> => {
  if (!user?.id) return { profiles: [], boostSet: new Set(), myInterests: [], usedRpc: false }
      const offset = typeof pageParam === 'number' ? pageParam : 0

      // Preferred path: SECURITY DEFINER RPC returns cards with profile fields (bypasses RLS)
      try {
        // Intentamos usar la nueva RPC v2 (estable con photos_version); fallback a la anterior si no existe
        const { data: cardRowsV2, error: cardsErrV2 } = await supabase
          .rpc('classic_candidates_cards_with_photos_v2', { p_user_id: user.id, p_limit: PAGE_SIZE, p_offset: offset })
        const cardRows = (!cardsErrV2 && Array.isArray(cardRowsV2)) ? cardRowsV2 : []
        if (!cardsErrV2 && Array.isArray(cardRows) && cardRows.length) {
          let profiles: CardProfile[] = cardRows
            .filter((r: any) => r.candidate_id !== user.id)
            .map((r: any) => ({
              id: r.candidate_id,
              name: r.display_name ?? 'Usuario',
              age: typeof r.calculated_age === 'number' ? r.calculated_age : null,
              bio: null,
              interests: [],
              avatar: normalizeAvatarUrl(r.avatar_url || null),
              gender: (r.gender ?? null),
              interested_in: Array.isArray(r.interested_in) ? r.interested_in : [],
              seeking: Array.isArray(r.seeking) ? r.seeking : [],
              photos: Array.isArray((r as any).photos)
                ? (r as any).photos
                    .map((x: any) => {
                      const url = normalizeAvatarUrl(String(x.url || ''))
                      return url ? { id: Number(x.id), url, sort_order: Number(x.sort_order ?? 0) } : null
                    })
                    .filter(Boolean) as { id: number; url: string; sort_order: number }[]
                : [],
              prompts: [],
              distanceKm: (typeof (r as any).distance_km === 'number' ? (r as any).distance_km : null),
              photosVersion: typeof (r as any).photos_version === 'string' ? (r as any).photos_version : null
            }))

          // Boosters: who gave me superlike (any context)
          const idsAll = profiles.map(p => p.id)
          const { data: boosters } = await supabase
            .from('likes')
            .select('liker')
            .eq('liked', user!.id)
            .eq('type', 'superlike')
          const boostSet = new Set<string>((boosters || []).map(b => (b as any).liker).filter((id: string) => idsAll.includes(id)))

          // Photos: ya vienen embebidas en classic_candidates_cards_with_photos → no bulk

          // Fetch bios for candidates via SECURITY DEFINER RPC (bypass RLS safely)
          try {
            if (idsAll.length) {
              const { data: biosRows } = await supabase
                .rpc('profile_bios_bulk', { p_ids: idsAll })
              const bioMap = new Map<string, string | null>()
              ;(biosRows || []).forEach((r: any) => { if (r?.profile_id) bioMap.set(r.profile_id, r.bio ?? null) })
              if (__DEV__) {
                const missing = profiles.filter(p => !bioMap.has(p.id)).map(p => p.id)
                console.debug('[classic] bios fetched', { requested: idsAll.length, got: (biosRows||[]).length, missing: missing.slice(0, 5) })
              }
              profiles = profiles.map(p => ({ ...p, bio: bioMap.get(p.id) ?? null }))
            }
          } catch (e: any) {
            if (__DEV__) console.warn('[classic] bios fetch error', e?.message)
          }

          // Distancias: ya vienen en classic_candidates_cards.distance_km; no se hace llamada extra

          // Interests for candidates via SECURITY DEFINER RPC (bypass RLS safely)
          try {
            if (idsAll.length) {
              const { data: interestRows } = await supabase
                .rpc('profile_interests_bulk', { p_ids: idsAll })
              const interestsMap = new Map<string, string[]>()
              ;(interestRows || []).forEach((r: any) => {
                if (!r) return
                const arr = Array.isArray(r.interests) ? r.interests : []
                interestsMap.set(r.profile_id, arr)
              })
              profiles = profiles.map(p => ({
                ...p,
                interests: (interestsMap.get(p.id) || [])
              }))
            }
          } catch {}

          // Prompts for candidates via SECURITY DEFINER RPC (include localized choices labels)
          try {
            if (idsAll.length) {
              const { data: promptRows } = await supabase
                .rpc('profile_prompts_bulk', { p_ids: idsAll, p_locale: i18n.language || 'es' })
              const promptsMap = new Map<string, any[]>()
              ;(promptRows || []).forEach((r: any) => {
                if (!r?.profile_id) return
                const arr = promptsMap.get(r.profile_id) || []
                // Include icon and question if the RPC returns them (backend update ready); else leave null
                arr.push({ id: r.prompt_id, prompt_id: r.prompt_id, key: r.key, question: r.question || null, response: r.answer, choices_labels: r.choices_labels || null, icon: r.icon || null })
                promptsMap.set(r.profile_id, arr)
              })
              promptsMap.forEach((arr, k) => promptsMap.set(k, arr.sort((a,b)=> a.prompt_id - b.prompt_id)))
              profiles = profiles.map(p => ({ ...p, prompts: promptsMap.get(p.id) || [] }))
            }
          } catch {}


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

      return { profiles: [...boostersList, ...others], boostSet, myInterests, usedRpc: true }
        }
      } catch (e) {
        console.warn('[classic] cards RPC error', (e as any)?.message)
      }

      // Fallback path: legacy RPC (cards with photos) → si existe, úsalo antes de simple
      if (!user?.id) return { profiles: [], boostSet: new Set(), myInterests: [], usedRpc: false }
      try {
        const { data: legacyRows, error: legacyErr } = await supabase
          .rpc('classic_candidates_cards_with_photos', { p_user_id: user.id, p_limit: PAGE_SIZE, p_offset: offset })
        if (!legacyErr && Array.isArray(legacyRows) && legacyRows.length) {
          let profiles: CardProfile[] = legacyRows
            .filter((r: any) => r.candidate_id !== user.id)
            .map((r: any) => ({
              id: r.candidate_id,
              name: r.display_name ?? 'Usuario',
              age: typeof r.calculated_age === 'number' ? r.calculated_age : null,
              bio: null,
              interests: [],
              avatar: normalizeAvatarUrl(r.avatar_url || null),
              gender: (r.gender ?? null),
              interested_in: Array.isArray(r.interested_in) ? r.interested_in : [],
              seeking: Array.isArray(r.seeking) ? r.seeking : [],
              photos: Array.isArray((r as any).photos)
                ? (r as any).photos
                    .map((x: any) => {
                      const url = normalizeAvatarUrl(String(x.url || ''))
                      return url ? { id: Number(x.id), url, sort_order: Number(x.sort_order ?? 0) } : null
                    })
                    .filter(Boolean) as { id: number; url: string; sort_order: number }[]
                : [],
              prompts: [],
              distanceKm: (typeof (r as any).distance_km === 'number' ? (r as any).distance_km : null),
              photosVersion: null
            }))
          const idsAll = profiles.map(p => p.id)
          const { data: boosters } = await supabase
            .from('likes')
            .select('liker')
            .eq('liked', user!.id)
            .eq('type', 'superlike')
          const boostSet = new Set<string>((boosters || []).map(b => (b as any).liker).filter((id: string) => idsAll.includes(id)))
          try {
            if (idsAll.length) {
              const { data: biosRows } = await supabase
                .rpc('profile_bios_bulk', { p_ids: idsAll })
              const bioMap = new Map<string, string | null>()
              ;(biosRows || []).forEach((r: any) => { if (r?.profile_id) bioMap.set(r.profile_id, r.bio ?? null) })
              profiles = profiles.map(p => ({ ...p, bio: bioMap.get(p.id) ?? null }))
            }
          } catch {}
          try {
            if (idsAll.length) {
              const { data: interestRows } = await supabase
                .rpc('profile_interests_bulk', { p_ids: idsAll })
              const interestsMap = new Map<string, string[]>()
              ;(interestRows || []).forEach((r: any) => { if (r?.profile_id) interestsMap.set(r.profile_id, Array.isArray(r.interests) ? r.interests : []) })
              profiles = profiles.map(p => ({ ...p, interests: interestsMap.get(p.id) || [] }))
            }
          } catch {}
          try {
            if (idsAll.length) {
              const { data: promptRows } = await supabase
                .rpc('profile_prompts_bulk', { p_ids: idsAll, p_locale: i18n.language || 'es' })
              const promptsMap = new Map<string, any[]>()
              ;(promptRows || []).forEach((r: any) => {
                if (!r?.profile_id) return
                const arr = promptsMap.get(r.profile_id) || []
                arr.push({ id: r.prompt_id, prompt_id: r.prompt_id, key: r.key, question: r.question || null, response: r.answer, choices_labels: r.choices_labels || null, icon: r.icon || null })
                promptsMap.set(r.profile_id, arr)
              })
              promptsMap.forEach((arr, k) => promptsMap.set(k, arr.sort((a,b)=> a.prompt_id - b.prompt_id)))
              profiles = profiles.map(p => ({ ...p, prompts: promptsMap.get(p.id) || [] }))
            }
          } catch {}
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
          let myInterests: string[] = []
          try {
            const { data: myRows } = await supabase
              .from('profile_interests')
              .select('interests(name)')
              .eq('profile_id', user!.id)
            ;(myRows || []).forEach((r: any) => { const n = r.interests?.name; if (typeof n === 'string' && n.length) myInterests.push(n) })
            myInterests = Array.from(new Set(myInterests))
          } catch {}
          return { profiles: [...boostersList, ...others], boostSet, myInterests, usedRpc: true }
        }
      } catch {}

      // Fallback path final: legacy simple RPC + client-side profile fetch (may be blocked by RLS)
      const { data: candRows, error: candErr } = await supabase
  .rpc('classic_candidates_simple', { p_user_id: user.id, p_limit: PAGE_SIZE })
      if (candErr) console.warn('[classic] rpc error', candErr.message)
      const ids = (candRows || []).map((r: any) => r.candidate_id).filter((id: string) => id !== user!.id)
  if (!ids.length) return { profiles: [], boostSet: new Set(), myInterests: [], usedRpc: false }

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

      const { data: profsIn, error: profsErr } = await supabase
        .from('profiles')
        .select('id, display_name, bio, calculated_age, gender, avatar_url, interested_in, seeking')
        .in('id', ids)
      if (profsErr) console.warn('[classic] profiles .in error', profsErr.message)
      let profilesSource: ProfileRow[] = profsIn || []
      if (!profsErr && profilesSource.length === 0 && ids.length > 0) {
        const fallback: ProfileRow[] = []
        for (const id of ids) {
          const { data: one } = await supabase
            .from('profiles')
            .select('id, display_name, bio, calculated_age, gender, avatar_url, interested_in, seeking')
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
          const normalized = normalizeAvatarUrl(r.url || null)
          if (normalized) arr.push({ id: r.id, url: normalized, sort_order: r.sort_order ?? 0 })
          photosMap.set(r.user_id, arr)
        })
        photosMap.forEach((arr, k) => photosMap.set(k, arr.sort((a,b)=> (a.sort_order??0)-(b.sort_order??0))))
      }

      // Distances via RPC for fallback path as well
      let distMap = new Map<string, number | null>()
      try {
        if (profilesSource.length) {
          const idsAll = profilesSource.map(p => p.id)
          const { data: distRows } = await supabase
            .rpc('profile_distance_bulk', { p_viewer: user!.id, p_ids: idsAll })
          ;(distRows || []).forEach((r: any) => { if (r?.profile_id) distMap.set(r.profile_id, (typeof r.distance_km === 'number' ? r.distance_km : null)) })
        }
      } catch {}

  let promptsMap = new Map<string, { id: number; prompt_id: number; question?: string; response: any; key?: string; choices_labels?: Record<string,string>|null; icon?: string | null }[]>()
      if (profilesSource.length) {
        const { data: promptsRows, error: promErr } = await supabase
          .from('profile_prompts')
          .select('id, prompt_id, answer, profile_id, profile_prompt_templates(question, key, icon, profile_prompt_template_locales(locale,title,choices_labels))')
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
        const localeChain = getLocaleChain(i18n.language)
        ;(promptsRows || []).forEach((r: any) => {
          const arr = promptsMap.get(r.profile_id) || []
          let resp = r.answer ?? ''
          resp = parseArrayLike(resp)
          const locales = r.profile_prompt_templates?.profile_prompt_template_locales || []
          const locByLocale = Object.fromEntries(locales.map((row: any) => [row.locale, row]))
          const localizedQ = pickFirstNonEmptyTitle(locByLocale, localeChain) || r.profile_prompt_templates?.question
          const choicesLabels = mergeChoiceLabels(locByLocale, localeChain)
          arr.push({ id: r.id, prompt_id: r.prompt_id, question: localizedQ, response: resp, key: r.profile_prompt_templates?.key, choices_labels: choicesLabels, icon: r.profile_prompt_templates?.icon || null })
          promptsMap.set(r.profile_id, arr)
        })
        promptsMap.forEach((arr, k) => promptsMap.set(k, arr.sort((a,b)=> a.prompt_id - b.prompt_id)))
      }

      // Interests for candidates via RPC to avoid RLS
      const interestsMap = new Map<string, string[]>()
      try {
        if (ids.length) {
          const { data: interestRows, error: intErr } = await supabase
            .rpc('profile_interests_bulk', { p_ids: ids })
          if (intErr) console.warn('[classic] interests rpc error', intErr.message)
          ;(interestRows || []).forEach((r: any) => {
            if (!r) return
            const arr = Array.isArray(r.interests) ? r.interests : []
            interestsMap.set(r.profile_id, arr)
          })
        }
      } catch (e: any) {
        console.warn('[classic] interests rpc exception', e?.message)
      }

      let myInterests: string[] = []
      try {
        const { data: myRows } = await supabase
          .from('profile_interests')
          .select('interests(name)')
          .eq('profile_id', user!.id)
        ;(myRows || []).forEach((r: any) => { const n = r.interests?.name; if (typeof n === 'string' && n.length) myInterests.push(n) })
        myInterests = Array.from(new Set(myInterests))
      } catch {}

      // Bios via RPC (in case direct select was blocked by RLS or returned nulls)
      let bioMap = new Map<string, string | null>()
      try {
        if (profilesSource.length) {
          const idsAll = profilesSource.map(p => p.id)
          const { data: biosRows } = await supabase
            .rpc('profile_bios_bulk', { p_ids: idsAll })
          ;(biosRows || []).forEach((r: any) => { if (r?.profile_id) bioMap.set(r.profile_id, r.bio ?? null) })
        }
      } catch {}

      const profiles: CardProfile[] = (profilesSource || []).map((p: ProfileRow) => ({
        id: p.id,
        name: p.display_name ?? 'Usuario',
        age: typeof p.calculated_age === 'number' ? p.calculated_age : null,
        bio: (bioMap.get(p.id) ?? p.bio ?? null),
  interests: (interestsMap.get(p.id) || []),
        avatar: normalizeAvatarUrl(p.avatar_url || null),
        gender: normalizeLabel(p.gender) || null,
        interested_in: normalizeArr(p.interested_in),
        seeking: normalizeArr(p.seeking),
        photos: photosMap.get(p.id) || [],
        prompts: promptsMap.get(p.id) || [],
        distanceKm: distMap.get(p.id) ?? null
      }))

      // Servidor ya filtra edad/orientación/distancia: no aplicar filtros redundantes aquí
      const pending = profiles

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
      return { profiles: ordered, boostSet, myInterests, usedRpc: false }
    }
  })

  const pages = data?.pages || []
  const deck = pages.flatMap(p => p.profiles) || []
  const viewerInterests = useMemo(() => {
    // Take from the first page; it's the same for all pages in this session
    return pages.length ? (pages[0]?.myInterests || []) : []
  }, [pages])
  const boostSetGlobal = useMemo(() => {
    const s = new Set<string>()
    for (const pg of pages) { if (pg?.boostSet) { pg.boostSet.forEach(id => s.add(id)) } }
    return s
  }, [pages])

  const [uiDeck, setUiDeck] = useState<CardProfile[]>([])
  const decidedRef = useRef<Set<string>>(new Set())
  // Reset/reconcile deck when backend candidates change (prevents stale cards after location change)
  useEffect(() => {
    if (!deck) { setUiDeck([]); return }
    decidedRef.current.clear()
    setUiDeck(deck)
  }, [deck.map(p=>p.id).join('|')])

  // Auto-refill: si quedan pocas cartas y hay más páginas, pedir siguiente
  useEffect(() => {
    if (!hasNextPage) return
    if (uiDeck.length <= 5) { try { fetchNextPage() } catch {} }
  }, [uiDeck.length, hasNextPage, fetchNextPage])

  // Eliminamos el vaciado agresivo del deck al cambiar la ubicación porque provocaba deck vacío permanente
  // (IDs iguales tras refetch ⇒ efecto de repoblado no se disparaba). El queryKey ya fuerza refetch y el efecto
  // siguiente repuebla cuando cambia el contenido real.

  const current = uiDeck[0]
  const next = uiDeck[1]
  const onlineSet = useOnlineIds(current?.id ? [current.id] : [])
  const onlineLabel = (i18n.language || '').toLowerCase().startsWith('es') ? 'En línea' : 'Online'
  const [photoIndex, setPhotoIndex] = useState(0)
  useEffect(()=>{ setPhotoIndex(0) }, [current?.id])
  // Simplified image swap: single image keyed by photo id (stable pattern from prior working version)
  const [imgLoaded, setImgLoaded] = useState(false)
  const currentUri = useMemo(() => (current?.photos?.[photoIndex]?.url || current?.avatar || null), [current?.id, photoIndex])
  const suppressRefetchSV = useSharedValue(0)
  const deferRefetchTimerRef = useRef<any>(null)
  const requestRefetch = useCallback(() => {
    if (!suppressRefetchSV.value) {
      try { refetch() } catch {}
      return
    }
    if (deferRefetchTimerRef.current) { try { clearTimeout(deferRefetchTimerRef.current) } catch {} }
    deferRefetchTimerRef.current = setTimeout(() => {
      suppressRefetchSV.value = 0
      try { refetch() } catch {}
    }, 800)
  }, [refetch])
  useEffect(() => { setImgLoaded(false) }, [current?.id, photoIndex])
  const isDraggingRef = useRef(false)
  const gestureModeRef = useRef<'undecided' | 'photo' | 'card'>('undecided')
  const startXRef = useRef<number | null>(null)
  const lastPhotoCommitRef = useRef(0)
  const actionsCountRef = useRef(0)
  const photoAutoProgress = useSharedValue(0)
  const pauseRef = useRef(false)
  const startTsRef = useRef(0)
  const totalDurationRef = useRef<number>(AUTO_ADVANCE_INTERVAL_MS)
  const remainingRef = useRef<number>(AUTO_ADVANCE_INTERVAL_MS)
  const lastEndTsRef = useRef(0)

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
  qc.invalidateQueries({ queryKey: ['classic-swipe-profiles-v2', user?.id] })
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
    const id = setInterval(() => { requestRefetch(); refetchRemaining() }, 45000)
    return () => clearInterval(id)
  }, [requestRefetch, refetchRemaining])

  // Realtime: refetch when my profile location changes while Classic is open
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase
      .channel('classic-ploc-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profile_locations', filter: `user_id=eq.${user.id}` },
        () => { requestRefetch() }
      )
      .subscribe()
    return () => { try { supabase.removeChannel(ch) } catch {} }
  }, [user?.id, requestRefetch])

  // Realtime: refresh deck when any profile/avatar or photo gets updated while Classic is open
  useEffect(() => {
    const ch = supabase
      .channel('classic-photos-profiles-rt')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_photos' },
        () => { requestRefetch() }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => { requestRefetch() }
      )
      .subscribe()
    return () => { try { supabase.removeChannel(ch) } catch {} }
  }, [requestRefetch])

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

  // Next card appears from bottom as you drag the current one
  const NEXT_CARD_OFFSET_Y = 26
  const NEXT_CARD_SCALE_MIN = 0.96
  const nextCardStyle = useAnimatedStyle(() => {
    const pX = Math.min(1, Math.abs(translateX.value) / SWIPE_THRESHOLD_X)
    const pY = Math.min(1, Math.max(0, -translateY.value) / SWIPE_THRESHOLD_Y)
    const p = Math.max(pX, pY)
    const ty = NEXT_CARD_OFFSET_Y * (1 - p)
    const sc = NEXT_CARD_SCALE_MIN + (1 - NEXT_CARD_SCALE_MIN) * p
    // Hide the next card completely until the user starts interacting
    const op = p
    return { transform: [{ translateY: ty }, { scale: sc }], opacity: op }
  })

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

  // Debug event log (kept small, only if flag enabled)
  const [debugEvents, setDebugEvents] = useState<string[]>([])
  const pushDebug = useCallback((msg: string) => {
    if (!DEBUG_PHOTO) return
    setDebugEvents(ev => {
      const next = [...ev, `${Date.now()%100000}:${msg}`]
      return next.slice(-60)
    })
    if (__DEV__) console.log('[swipe-debug]', msg)
  }, [DEBUG_PHOTO])

  const onEnd = ({ nativeEvent }: any) => {
    // micro-debounce to avoid spurious double end events
    const now = Date.now()
    if (now - (lastEndTsRef.current || 0) < 80) return
    lastEndTsRef.current = now
    const { translationX, translationY } = nativeEvent
    isDraggingRef.current = false
  setTimeout(() => { suppressRefetchSV.value = 0 }, 120)
    const mode = gestureModeRef.current
    if (translationY < -SWIPE_THRESHOLD_Y && current) {
      translateY.value = withTiming(-height, { duration:250 }, () => runOnJS(performAction)(current.id, 'superlike'))
      gestureModeRef.current = 'undecided'
      startXRef.current = null
      lastPhotoCommitRef.current = 0
      return
    }
    if (mode === 'card') {
      const SOFT_X = SWIPE_THRESHOLD_X * 0.7
      if (translationX > SWIPE_THRESHOLD_X && current) {
        translateX.value = withTiming(width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'like'))
      } else if (translationX < -SWIPE_THRESHOLD_X && current) {
        translateX.value = withTiming(-width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'pass'))
      } else if (translationX > SOFT_X && current) {
        translateX.value = withTiming(width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'like'))
      } else if (translationX < -SOFT_X && current) {
        translateX.value = withTiming(-width * 1.2, { duration:220 }, () => runOnJS(performAction)(current.id, 'pass'))
      } else {
        resetCard()
      }
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
  // Avoid refetches while user is actively dragging to reduce flicker
  suppressRefetchSV.value = 1
      pushDebug('drag-start')
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
          suppressRefetchSV.value = 1
          pushDebug('mode:photo')
        }
      } else {
        gestureModeRef.current = 'card'
        pushDebug('mode:card')
      }
    }
    if (gestureModeRef.current === 'photo') {
      if (Math.abs(translationX) >= PROMOTE_DISTANCE) {
        gestureModeRef.current = 'card'
        translateX.value = translationX
        translateY.value = translationY
        pushDebug('promote->card')
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
        pushDebug('photo-back')
      } else if (delta < -PHOTO_SWIPE_DISTANCE) {
        setPhotoIndex(idx => {
          const nextIdx = idx + 1
          return nextIdx >= photosLen ? photosLen - 1 : nextIdx
        })
        lastPhotoCommitRef.current = translationX
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{})
        pushDebug('photo-forward')
      }
      translateX.value = 0; translateY.value = 0
      return
    }
    translateX.value = translationX; translateY.value = translationY
    superProgress.value = translationY < -SUPERLIKE_ACTIVATION_Y ? Math.min(1, Math.abs(translationY) / SWIPE_THRESHOLD_Y) : 0
  }, [current?.photos?.length, pushDebug])

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

  // Priority: languages > array prompts > others. Use stable sort over seeded order above.
  const prioritizedPrompts = useMemo(() => {
    const isArrayPrompt = (p: any) => Array.isArray(p?.response)
    const isLanguagesKey = (k: string) => {
      const key = k.toLowerCase()
      // Lista blanca de keys para Idiomas (ajusta si tu template usa otra clave estable)
      const LANGUAGE_KEYS = new Set(['languages', 'idiomas', 'languagespoken', 'idiomashablados', 'lang', 'langs'])
      if (LANGUAGE_KEYS.has(key)) return true
      return key.includes('language') || key.includes('idioma') || key.includes('idiom') || key.includes('lang')
    }
    const isLikelyLanguages = (p: any) => {
      const k = String(p?.key || '')
      if (k && isLanguagesKey(k)) return true
      // Fallback por texto de pregunta (EN/ES)
      const q = String(p?.question || '').toLowerCase()
      if (q.includes('idiomas') || q.includes('lengu') || q.includes('languages') || q.includes('speak')) return true
      // Fallback por forma de respuesta: array con valores tipo idioma
      const resp = p?.response
      if (Array.isArray(resp) && resp.length) {
        const SAMPLE_LANGS = ['es', 'en', 'fr', 'de', 'it', 'pt', 'chino', 'chinese', 'inglés', 'español', 'francés']
        const s = String(resp[0] || '').toLowerCase()
        if (SAMPLE_LANGS.some(w => s.includes(w))) return true
      }
      return false
    }
    const score = (p: any) => (isLikelyLanguages(p) ? 3 : isArrayPrompt(p) ? 2 : 1)
    const base = [...promptOrder]
    base.sort((a, b) => score(b) - score(a))
    return base
  }, [promptOrder])
  // Two prompts per photo starting at photo index 2 (3rd visual card). No compact grouping.
  const promptSlots = useMemo(() => Math.max(0, (current?.photos?.length || 0) - 2), [current?.photos?.length])
  const visiblePrompts = useMemo(() => prioritizedPrompts.slice(0, promptSlots * 2), [prioritizedPrompts, promptSlots])

  const renderSinglePrompt = (p: any) => {
    if (!p) return null
    const respRaw = p.response
    const isArray = Array.isArray(respRaw)
    const answerText = !isArray ? tAnswer(String(respRaw).trim(), (p as any).choices_labels) : ''
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
    )
  }


  // Full interest list (server already enforces per-category limit of 2). We still highlight common ones.
  const interestChips = useMemo(() => {
    const ui: string[] = Array.isArray(current?.interests) ? current!.interests : []
    return ui
  }, [current?.id, current?.interests])

  // Compute one-line bio (grapheme-safe truncation)
  const bioLine = useMemo(() => {
    const raw = (current?.bio || '').trim()
    if (!raw) return null
    return truncateByGraphemes(raw, 90)
  }, [current?.id, current?.bio])

  // Compute prompt highlights (emoji + short label) to fill if interests < 3
  const promptHighlights = useMemo(() => {
    const maxNeeded = Math.min(2, Math.max(0, 3 - (interestChips?.length || 0)))
    if (!current?.prompts || maxNeeded <= 0) return [] as string[]
    // Prefer choice prompts (array answers), take first option
    const makeLabel = (p: any): string | null => {
      const emoji = (p?.icon as string) || '✨'
      const resp = p?.response
      if (Array.isArray(resp) && resp.length > 0) {
        const raw = resp[0]
        const label = tAnswer(raw, p?.choices_labels)
        const txt = String(label || '').trim()
        if (!txt) return null
        const pretty = txt.length > 18 ? `${txt.slice(0,16)}…` : txt
        return `${emoji} ${pretty}`
      }
      // Skip long free-text here to keep pills short
      return null
    }
    const all = (current.prompts || [])
      .map(makeLabel)
      .filter((s: any): s is string => typeof s === 'string' && s.length > 0)
    // Deduplicate preserving order
    const seen = new Set<string>()
    const uniq = [] as string[]
    for (const s of all) { if (!seen.has(s)) { seen.add(s); uniq.push(s) } }
    return uniq.slice(0, maxNeeded)
  }, [current?.id, current?.prompts, interestChips])

  const boosterTipShownRef = useRef(false)
  const [showBoosterTip, setShowBoosterTip] = useState(false)
  useEffect(() => {
    if (current && boostSetGlobal.has(current.id) && !boosterTipShownRef.current) {
      boosterTipShownRef.current = true
      setShowBoosterTip(true)
      const t = setTimeout(()=> setShowBoosterTip(false), 3200)
      return () => clearTimeout(t)
    } else if (!current) {
      setShowBoosterTip(false)
    }
  }, [current?.id, boostSetGlobal])

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
    <Screen style={{ padding:0 }} edges={[]}> 
      {/* Realtime: refetch when my profile location changes */}
      {/* This ensures immediate refresh if location is updated while Classic is open */}
      {isLoading && (
        <YStack style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </YStack>
      )}
      {!isLoading && !current && <EmptyState />}
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
                  key={`next:${next.id}:${next.photos[0]?.id ?? 'av'}`}
                  source={{ uri: next.photos[0]?.url || next.avatar || '' }}
                  style={{ flex:1 }}
                  resizeMode='cover'
                  fadeDuration={0}
                />
              ) : next.avatar ? (
                <Image key={`next:${next.id}:avatar`} source={{ uri: next.avatar }} style={{ flex:1 }} resizeMode='cover' fadeDuration={0} />
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
                  <View style={{ flex:1, backgroundColor: theme.colors.card }} />
                )}
                {/* Avoid covering the current image while the next loads to prevent flashes */}
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
              {DEBUG_PHOTO && (
                <View style={{ position:'absolute', top:8, right:8, zIndex:50, maxWidth:'54%', backgroundColor:'#111c', padding:8, borderRadius:10 }}>
                  <Text style={{ color:'#fff', fontSize:11, fontWeight:'700', marginBottom:4 }}>PHOTO DEBUG</Text>
                  <Text style={{ color:'#fff', fontSize:10 }}>card: {current.id}</Text>
                  <Text style={{ color:'#fff', fontSize:10 }}>pIdx: {photoIndex}</Text>
                  <Text style={{ color:'#fff', fontSize:10 }}>loaded: {String(imgLoaded)}</Text>
                  <Text style={{ color:'#fff', fontSize:10 }}>version: {current.photosVersion || '∅'}</Text>
                  <Text style={{ color:'#fff', fontSize:10 }}>uri: {(currentUri||'').slice(-28)}</Text>
                  {debugEvents.slice(-10).reverse().map((e,i)=> (
                    <Text key={i} style={{ color:'#0ff', fontSize:9 }} numberOfLines={1}>{e}</Text>
                  ))}
                </View>
              )}
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
                        const isCommon = (viewerInterests || []).includes(label)
                        const chipStyle = isCommon
                          ? { backgroundColor: colorWithAlpha(theme.colors.primary, 0.18), borderWidth: 1, borderColor: theme.colors.primary }
                          : { backgroundColor:'rgba(255,255,255,0.12)', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' }
                        return (
                          <View key={`int-${label}-${i}`} style={{ paddingHorizontal:10, paddingVertical:5, borderRadius:14, ...chipStyle }}>
                            <Text style={{ color:'#fff', fontSize:11.5, fontWeight:'700' }} numberOfLines={1}>{label.length > 18 ? `${label.slice(0,16)}…` : label}</Text>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                )}
                {photoIndex >= 2 && (() => {
                  const slotIdx = photoIndex - 2
                  if (slotIdx < 0 || slotIdx >= promptSlots) return null
                  const left = visiblePrompts[slotIdx * 2]
                  const right = visiblePrompts[slotIdx * 2 + 1]
                  if (!left && !right) return null
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
                  )
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
  )
}
