import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FilterRange = 'today' | '7' | '30' | 'all';
export type VenueType = 'all' | 'nightclub' | 'concert_hall' | 'festival';

interface EventsFiltersState {
  range: FilterRange;
  search: string;
  selectedCityId: number | 'all';
  selectedVenueType: VenueType;
  _hasHydrated: boolean;
  setRange: (v: FilterRange) => void;
  setSearch: (v: string) => void;
  setSelectedCityId: (v: number | 'all') => void;
  setSelectedVenueType: (v: VenueType) => void;
  reset: () => void;
}

export const useEventsFiltersStore = create<EventsFiltersState>()(
  persist(
    (set) => ({
      range: '7',
      search: '',
      selectedCityId: 'all',
      selectedVenueType: 'all',
      _hasHydrated: false,
      setRange: (range) => set({ range }),
      setSearch: (search) => set({ search }),
      setSelectedCityId: (selectedCityId) => set({ selectedCityId }),
      setSelectedVenueType: (selectedVenueType) => set({ selectedVenueType }),
      reset: () => set({ range: '7', search: '', selectedCityId: 'all', selectedVenueType: 'all' }),
    }),
    {
      name: 'eventsFilters:v1',
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) state._hasHydrated = true;
      },
      partialize: (s) => ({
        range: s.range,
        search: s.search,
        selectedCityId: s.selectedCityId,
        selectedVenueType: s.selectedVenueType,
      }),
      migrate: (persisted, version) => {
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
