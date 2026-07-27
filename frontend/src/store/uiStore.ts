import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  selectedEntityId: string | null;
  activeFilters: Record<string, string>;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSelectedEntityId: (id: string | null) => void;
  setFilter: (key: string, value: string) => void;
  clearFilters: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  selectedEntityId: null,
  activeFilters: {},
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSelectedEntityId: (selectedEntityId) => set({ selectedEntityId }),
  setFilter: (key, value) =>
    set((s) => ({ activeFilters: { ...s.activeFilters, [key]: value } })),
  clearFilters: () => set({ activeFilters: {} }),
}));
