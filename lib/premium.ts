// lib/premium.ts
import { create } from 'zustand';
import { supabase } from './supabase';

type PremiumStore = {
  isPremium: boolean;
  loading: boolean;
  lastUserId: string | null;
  refresh: (userId: string) => Promise<void>;
  setPremium: (userId: string, value: boolean) => Promise<void>;
};

export const usePremiumStore = create<PremiumStore>((set, get) => ({
  isPremium: false,
  loading: false,
  lastUserId: null,

  refresh: async (userId: string) => {
    const _cur = get().lastUserId;
    set({ loading: true, lastUserId: userId });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      set({ isPremium: !!data?.is_premium, loading: false });
    } catch {
      // en error no forzamos premium
      set({ loading: false });
    }
  },

  setPremium: async (userId: string, value: boolean) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_premium: value })
        .eq('id', userId);
      if (error) throw error;
      set({ isPremium: value, loading: false, lastUserId: userId });
    } catch {
      set({ loading: false });
      throw new Error('No se pudo actualizar premium');
    }
  },
}));

// Helper cómodo
export async function ensurePremiumFresh(userId?: string | null) {
  if (!userId) return false;
  const { refresh, isPremium, lastUserId } = usePremiumStore.getState();
  if (lastUserId !== userId) {
    await refresh(userId);
    return usePremiumStore.getState().isPremium;
  }
  return isPremium;
}
