import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  activeFilters: Record<string, string>;
  setSidebarOpen: (open: boolean) => void;
  setFilter: (key: string, value: string) => void;
  clearFilters: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  activeFilters: {},
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setFilter: (key, value) =>
    set((state) => ({
      activeFilters: { ...state.activeFilters, [key]: value },
    })),
  clearFilters: () => set({ activeFilters: {} }),
}));
