import { create } from 'zustand';

interface AttendeesSheetState {
  open: boolean;
  eventId?: number;
  openFor: (eventId: number) => void;
  close: () => void;
}

export const useAttendeesSheetStore = create<AttendeesSheetState>((set) => ({
  open: false,
  eventId: undefined,
  openFor: (eventId: number) => set({ open: true, eventId }),
  close: () => set({ open: false, eventId: undefined })
}));
