import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type FilterRange = 'today' | '7' | '30' | 'all';
export type VenueType = 'all' | 'nightclub' | 'concert_hall' | 'festival';

interface EventsFiltersState {
  range: FilterRange;
  search: string;
  selectedCityId: number | 'all';
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number; // geo filter radius
  locationLabel: string | null; // label shown in chip
  selectedVenueType: VenueType;
  _hasHydrated: boolean;
  setRange: (v: FilterRange) => void;
  setSearch: (v: string) => void;
  setSelectedCityId: (v: number | 'all') => void;
  setLocationCenter: (lat: number | null, lng: number | null, label?: string | null) => void;
  setRadiusKm: (km: number) => void;
  setSelectedVenueType: (v: VenueType) => void;
  reset: () => void;
}

export const useEventsFiltersStore = create<EventsFiltersState>()(
  persist(
    (set) => ({
      range: '7',
      search: '',
      selectedCityId: 'all',
      centerLat: null,
      centerLng: null,
      radiusKm: 75,
      locationLabel: null,
      selectedVenueType: 'all',
      _hasHydrated: false,
      setRange: (range) => set({ range }),
      setSearch: (search) => set({ search }),
      setSelectedCityId: (selectedCityId) => set({ selectedCityId }),
      setLocationCenter: (lat, lng, label) => set({ centerLat: lat, centerLng: lng, locationLabel: label ?? null }),
      setRadiusKm: (radiusKm) => set({ radiusKm }),
      setSelectedVenueType: (selectedVenueType) => set({ selectedVenueType }),
      reset: () => set({ range: '7', search: '', selectedCityId: 'all', centerLat: null, centerLng: null, radiusKm: 75, locationLabel: null, selectedVenueType: 'all' }),
    }),
    {
      name: 'eventsFilters:v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) state._hasHydrated = true;
      },
      partialize: (s) => ({
        range: s.range,
        search: s.search,
        selectedCityId: s.selectedCityId,
        centerLat: s.centerLat,
        centerLng: s.centerLng,
        radiusKm: s.radiusKm,
        locationLabel: s.locationLabel,
        selectedVenueType: s.selectedVenueType,
      }),
      migrate: (persisted, _version) => {
        // future migrations
        return persisted as any;
      },
    }
  )
);

// Selectors util for granular subscription
export const useEventRange = () => useEventsFiltersStore(s => s.range);
export const useEventSearch = () => useEventsFiltersStore(s => s.search);
export const useEventSelectedCityId = () => useEventsFiltersStore(s => s.selectedCityId);
export const useEventSelectedVenueType = () => useEventsFiltersStore(s => s.selectedVenueType);
export const useEventsFiltersHydrated = () => useEventsFiltersStore(s => s._hasHydrated);
