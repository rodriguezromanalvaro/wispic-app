import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { supabase } from 'lib/supabase'
import { useAuth } from 'lib/useAuth'

export type PromptAnswer = { key: string; answers: string[] }

export type ProfileDraft = {
  // notifications / permissions
  push_opt_in?: boolean
  notify_messages?: boolean
  notify_likes?: boolean
  notify_friend_requests?: boolean
  location_opt_in?: boolean
  camera_opt_in?: boolean
  expo_push_token?: string | null
  // identity
  name?: string
  birthdate?: string
  gender?: string | null
  show_gender?: boolean
  // profile
  temp_photos?: string[]
  relationship_status?: string | null
  show_relationship?: boolean
  seeking?: string[]
  show_seeking?: boolean
  interested_in?: string[]
  show_orientation?: boolean
  bio?: string
  // prompts
  prompts: PromptAnswer[]
}

const defaultDraft: ProfileDraft = {
  prompts: [],
  temp_photos: [],
}

export type CompleteProfileCtx = {
  draft: ProfileDraft
  setDraft: (updater: (prev: ProfileDraft) => ProfileDraft) => void
  patchProfile: (updates: Partial<ProfileDraft>) => Promise<void>
  saveToSupabase: () => Promise<boolean>
}

const Ctx = createContext<CompleteProfileCtx | null>(null)

export function CompleteProfileProvider({ children }: { children: ReactNode }){
  const [draft, setDraftState] = useState<ProfileDraft>(defaultDraft)
  const { user } = useAuth()
  const setDraft = (updater: (prev: ProfileDraft) => ProfileDraft) =>
    setDraftState(prev => updater(prev))
  // Patch a subset of profile fields immediately (used by permissions step)
  const patchProfile = async (_updates: Partial<ProfileDraft>) => {
    if (!user?.id) return
    // Map draft keys -> DB columns
    const allowed: Record<string, any> = {}
    const mapSimple = [
      'push_opt_in',
      'notify_messages',
      'notify_likes',
      'notify_friend_requests',
      'location_opt_in',
      'camera_opt_in',
    ] as const
    for (const k of mapSimple) {
      if (k in _updates) (allowed as any)[k] = (_updates as any)[k]
    }
    if (Object.keys(allowed).length) {
      await supabase.from('profiles').update({ ...allowed, updated_at: new Date().toISOString() }).eq('id', user.id)
      // If request provided an expo_push_token, store it only in push_tokens (not in profiles)
      const rawToken = (_updates as any)?.expo_push_token
      if (typeof rawToken === 'string' && rawToken.trim().length) {
        try { await supabase.from('push_tokens').upsert({ user_id: user.id, token: rawToken }); } catch {}
      }
    }
  }
  // Save the full draft into Supabase (called from summary step)
  const saveToSupabase = async () => {
    if (!user?.id) return false
    // Build profile updates
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    const normGender = draft.gender === 'other' ? 'nonbinary' : draft.gender
    const normInterested = Array.isArray(draft.interested_in)
      ? (draft.interested_in.map(v => (
          v === 'men' ? 'male' : v === 'women' ? 'female' : v === 'nonBinary' ? 'nonbinary' : v === 'everyone' ? '*' : v
        )))
      : undefined

    if (typeof draft.name === 'string') updates.display_name = draft.name
    if (typeof draft.bio === 'string') updates.bio = draft.bio
    if (typeof draft.birthdate === 'string' && draft.birthdate.trim().length) updates.birthdate = draft.birthdate
    if (normGender !== undefined) updates.gender = normGender
    if (draft.show_gender !== undefined) updates.show_gender = !!draft.show_gender
    if (Array.isArray(normInterested || [])) updates.interested_in = normInterested
    if (draft.show_orientation !== undefined) updates.show_orientation = !!draft.show_orientation
    if (Array.isArray(draft.seeking)) updates.seeking = draft.seeking
    if (draft.show_seeking !== undefined) updates.show_seeking = !!draft.show_seeking
    if (draft.relationship_status !== undefined) updates.relationship_status = draft.relationship_status
    if ((draft as any).show_relationship !== undefined) updates.show_relationship = !!(draft as any).show_relationship
    // Permissions snapshot (optional)
    if (draft.push_opt_in !== undefined) updates.push_opt_in = !!draft.push_opt_in
    if (draft.notify_messages !== undefined) updates.notify_messages = !!draft.notify_messages
    if (draft.notify_likes !== undefined) updates.notify_likes = !!draft.notify_likes
    if (draft.notify_friend_requests !== undefined) updates.notify_friend_requests = !!draft.notify_friend_requests
    if (draft.location_opt_in !== undefined) updates.location_opt_in = !!draft.location_opt_in
    if (draft.camera_opt_in !== undefined) updates.camera_opt_in = !!draft.camera_opt_in

    // Persist profile core fields
    const { error: upErr } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (upErr) return false

    // If we have a token in draft, mirror into push_tokens table for multi-device
    if (typeof draft.expo_push_token === 'string' && draft.expo_push_token.trim().length) {
      try { await supabase.from('push_tokens').upsert({ user_id: user.id, token: draft.expo_push_token }); } catch {}
    }

    // Upsert prompts if provided
    try {
      const prompts = Array.isArray(draft.prompts) ? draft.prompts : []
      if (prompts.length) {
        const keys = prompts.map(p => p.key)
        const { data: templates } = await supabase
          .from('profile_prompt_templates')
          .select('id, key')
          .in('key', keys)
        const idByKey = new Map<string, number>()
        ;(templates || []).forEach(r => { if (r.key) idByKey.set(r.key, r.id as number) })
        for (const p of prompts) {
          const tid = idByKey.get(p.key)
          if (!tid) continue
          const answer = Array.isArray(p.answers) ? p.answers : []
          await supabase
            .from('profile_prompts')
            .upsert({ profile_id: user.id, prompt_id: tid, answer }, { onConflict: 'profile_id,prompt_id' })
        }
      }
    } catch {
      // Best-effort: prompts failing shouldn't block core profile save
    }

    return true
  }
  // Lightweight autosave: persist core identity/profile fields when the user changes them in steps,
  // so that Configure Profile shows their choices even if they leave before the final summary.
  const lastSentRef = useRef<string>('')
  useEffect(() => {
    if (!user?.id) return
    const minimal: Record<string, any> = {}
    const normGender = draft.gender === 'other' ? 'nonbinary' : draft.gender
    const normInterested = Array.isArray(draft.interested_in)
      ? (draft.interested_in.map(v => (
          v === 'men' ? 'male' : v === 'women' ? 'female' : v === 'nonBinary' ? 'nonbinary' : v === 'everyone' ? '*' : v
        )))
      : undefined
    if (typeof draft.name === 'string') minimal.display_name = draft.name
    if (typeof draft.bio === 'string') minimal.bio = draft.bio
    if (typeof draft.birthdate === 'string' && draft.birthdate.trim().length) minimal.birthdate = draft.birthdate
    if (normGender !== undefined) minimal.gender = normGender
    if (draft.show_gender !== undefined) minimal.show_gender = !!draft.show_gender
    if (Array.isArray(normInterested || [])) minimal.interested_in = normInterested
    if (draft.show_orientation !== undefined) minimal.show_orientation = !!draft.show_orientation
    if (Array.isArray(draft.seeking)) minimal.seeking = draft.seeking
    if (draft.show_seeking !== undefined) minimal.show_seeking = !!draft.show_seeking
    if (draft.relationship_status !== undefined) minimal.relationship_status = draft.relationship_status
    if ((draft as any).show_relationship !== undefined) minimal.show_relationship = !!(draft as any).show_relationship
    const signature = JSON.stringify(minimal)
    if (signature === lastSentRef.current || signature === '{}') return
    const t = setTimeout(async () => {
      try {
        await supabase.from('profiles').update({ ...minimal, updated_at: new Date().toISOString() }).eq('id', user.id)
        lastSentRef.current = signature
      } catch {
        // ignore autosave error; user can save from summary
      }
    }, 600)
    return () => clearTimeout(t)
  }, [draft, user?.id])
  const value = useMemo(() => ({ draft, setDraft, patchProfile, saveToSupabase }), [draft])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCompleteProfile(): CompleteProfileCtx{
  const ctx = useContext(Ctx)
  if(!ctx) throw new Error('useCompleteProfile must be used within CompleteProfileProvider')
  return ctx
}
