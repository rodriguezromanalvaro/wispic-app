import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

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
  const setDraft = (updater: (prev: ProfileDraft) => ProfileDraft) =>
    setDraftState(prev => updater(prev))
  const patchProfile = async (_updates: Partial<ProfileDraft>) => { /* stub: integrate with supabase later */ }
  const saveToSupabase = async () => { /* stub: integrate with supabase later */ return true }
  const value = useMemo(() => ({ draft, setDraft, patchProfile, saveToSupabase }), [draft])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCompleteProfile(): CompleteProfileCtx{
  const ctx = useContext(Ctx)
  if(!ctx) throw new Error('useCompleteProfile must be used within CompleteProfileProvider')
  return ctx
}
