import { create } from 'zustand';

type OwnerGoals = {
  promote: boolean;
  attract: boolean;
  other: string;
};

type OwnerOnboardingState = {
  name: string;
  email: string | null;
  phone: string | null;
  category: string | null;
  cityId: number | null;
  locationText: string | null;
  description: string | null;
  avatarUri: string | null;
  venueId?: number | null; // guardamos venue_id tras finalizar
  goals: OwnerGoals;
  set: (patch: Partial<Omit<OwnerOnboardingState, 'set'>>) => void;
  reset: () => void;
};

const initial: Omit<OwnerOnboardingState, 'set'|'reset'> = {
  name: '',
  email: null,
  phone: null,
  category: null,
  cityId: null,
  locationText: null,
  description: null,
  avatarUri: null,
  venueId: null,
  goals: { promote: false, attract: false, other: '' },
};

export const useOwnerOnboarding = create<OwnerOnboardingState>((set) => ({
  ...initial,
  set: (patch) => set(patch as any),
  reset: () => set({ ...initial }),
}));
