/**
 * Zustand store that lets a page commandeer the Layout's left sidebar.
 *
 * Pattern:
 *   1. Page mounts → calls `setOverride(<MyPanel />)`.
 *      Layout swaps its nav for <MyPanel /> (opacity-fade transition).
 *   2. User hits the toggle button in the sidebar header → `showOverride`
 *      flips between true/false. Override stays REGISTERED so the toggle can
 *      flip back; only its visibility changes.
 *   3. Page unmounts → calls `setOverride(null)`. Layout returns to default.
 *
 * Why a store rather than a React context: pages can read/write from anywhere
 * (e.g. a button deep inside the result page can toggle the sidebar) without
 * lifting state to a common ancestor. Same pattern as our `useAuth` store.
 */
import type { ReactNode } from "react";
import { create } from "zustand";

interface SidebarOverrideState {
  /** The custom node to render in place of the nav. Null = no override registered. */
  override: ReactNode | null;
  /**
   * When override !== null, whether to actually show it. The toggle in the
   * sidebar header flips this; the underlying override stays mounted so
   * flipping back is instant.
   */
  showOverride: boolean;
  setOverride: (node: ReactNode | null) => void;
  toggleShowOverride: () => void;
  setShowOverride: (show: boolean) => void;
}

export const useSidebarOverride = create<SidebarOverrideState>((set) => ({
  override: null,
  showOverride: true,
  setOverride: (node) =>
    set(() => ({
      override: node,
      // Re-show by default when a fresh override is registered. If the user
      // toggled it off on a previous page, that should not persist across
      // page changes.
      showOverride: node !== null,
    })),
  toggleShowOverride: () => set((s) => ({ showOverride: !s.showOverride })),
  setShowOverride: (show) => set(() => ({ showOverride: show })),
}));
