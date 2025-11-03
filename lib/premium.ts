import { create } from 'zustand'

import { supabase } from './supabase'

// Minimal premium store used by PaywallModal
// Assumes a boolean column `is_premium` exists in `profiles` table. If not, calls will be no-ops.

type State = {
  isPremium: boolean
  lastUserId: string | null
}

type Actions = {
  refresh: (userId: string) => Promise<void>
  setPremium: (userId: string, value: boolean) => Promise<void>
}

export const usePremiumStore = create<State & Actions>((set, _get) => ({
  isPremium: false,
  lastUserId: null,

  refresh: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      const flag = Boolean((data as any)?.is_premium)
      set({ isPremium: flag, lastUserId: userId })
    } catch {
      // keep previous value
    }
  },

  setPremium: async (userId: string, value: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_premium: value, updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (error) throw error
      set({ isPremium: value, lastUserId: userId })
    } catch {
      // swallow
    }
  },
}))
