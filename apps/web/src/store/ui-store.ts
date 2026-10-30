import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  /** Desktop: icon-only rail. Remembered across visits. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** Below the lg breakpoint the sidebar is a drawer; this is its open state. */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  /** ⌘K / Ctrl+K menu search. */
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileNavOpen: false,
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
    }),
    {
      name: 'st_ui',
      // Only the rail preference survives a reload; drawers and dialogs never
      // reopen by themselves.
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);
