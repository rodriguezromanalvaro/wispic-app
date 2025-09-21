// lib/paywallStore.ts
import { create } from 'zustand';

type PaywallPayload = {
  source?: 'undo' | 'boost' | 'superlike' | string;
};

type PaywallState = {
  visible: boolean;
  payload?: PaywallPayload;
  open: (payload?: PaywallPayload) => void;
  close: () => void;
};

export const usePaywall = create<PaywallState>((set) => ({
  visible: false,
  payload: undefined,
  open: (payload) => set({ visible: true, payload }),
  close: () => set({ visible: false, payload: undefined }),
}));

export const openPaywall = (payload?: PaywallPayload) => {
  const { usePaywall } = require('./paywallStore') as typeof import('./paywallStore');
  usePaywall.getState().open(payload);
};
