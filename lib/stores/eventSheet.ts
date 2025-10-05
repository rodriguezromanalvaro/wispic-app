import { create } from 'zustand';

interface EventSheetState {
  open: boolean;
  eventId: number | null;
  openWith: (id: number) => void;
  close: () => void;
}

export const useEventSheetStore = create<EventSheetState>((set) => ({
  open: false,
  eventId: null,
  openWith: (id) => set({ open: true, eventId: id }),
  close: () => set({ open: false, eventId: null })
}));
