import { create } from 'zustand';

interface HelpStore {
  openId: string | null;
  open: (id: string) => void;
  close: (id: string) => void;
}

/** Holds the one open tip instance, so opening a tip closes any other. */
export const useHelpStore = create<HelpStore>((set) => ({
  openId: null,
  open: (id) => set({ openId: id }),
  close: (id) => set((s) => (s.openId === id ? { openId: null } : s)),
}));
