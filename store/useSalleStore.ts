// store/useSalleStore.ts
import { create } from 'zustand';

type State = {
  annee: number;
  setAnnee: (a: number) => void;
  search: string;
  setSearch: (s: string) => void;
};

export const useSalleStore = create<State>((set) => ({
  annee: new Date().getFullYear(),
  setAnnee: (a) => set({ annee: a }),
  search: '',
  setSearch: (s) => set({ search: s }),
}));
