import { create } from 'zustand';

type OwnerGoals = {
  promote: boolean;
  attract: boolean;
  other: string;
};

type OwnerOnboardingState = {
  name: string;
  category: string | null;
  cityId: number | null;
  locationText: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  avatarUri: string | null;
  venueId?: number | null; // guardamos venue_id tras finalizar
  goals: OwnerGoals;
  set: (patch: Partial<Omit<OwnerOnboardingState, 'set'>>) => void;
  reset: () => void;
};

const initial: Omit<OwnerOnboardingState, 'set'|'reset'> = {
  name: '',
  category: null,
  cityId: null,
  locationText: null,
  placeId: null,
  lat: null,
  lng: null,
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
