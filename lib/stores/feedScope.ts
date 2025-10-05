import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      partialize: (s) => ({ feedScope: s.feedScope }),
    }
  )
);
