import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type FeedScope = 'all' | 'series' | 'events';

interface FeedScopeState {
  feedScope: FeedScope;
  setFeedScope: (v: FeedScope) => void;
}

export const useFeedScopeStore = create<FeedScopeState>()(
  persist(
    (set) => ({
      feedScope: 'all',
      setFeedScope: (feedScope) => set({ feedScope }),
    }),
    {
      name: 'feedScope:v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ feedScope: s.feedScope }),
    }
  )
);
