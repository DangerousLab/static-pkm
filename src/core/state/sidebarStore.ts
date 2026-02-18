import { create } from 'zustand';

/** Sidebar store state interface */
interface SidebarState {
  /** Whether sidebar is open */
  isOpen: boolean;
  /** Base sidebar width in pixels */
  width: number;
  /** Whether hover expansion is needed (content overlaps) */
  hoverNeeded: boolean;
  /** Hover width when expanded */
  hoverWidth: number;

  /** Actions */
  toggle: () => void;
  open: () => void;
  close: () => void;
  setWidth: (width: number) => void;
  setHoverNeeded: (needed: boolean) => void;
  setHoverWidth: (width: number) => void;
}

/** Default sidebar width */
const DEFAULT_WIDTH = 240;

/**
 * Sidebar store - no persistence (defaults to closed on reload)
 * Manages sidebar open/close state and dimensions
 */
export const useSidebarStore = create<SidebarState>()((set) => ({
  isOpen: false,
  width: DEFAULT_WIDTH,
  hoverNeeded: false,
  hoverWidth: DEFAULT_WIDTH,

  toggle: () =>
    set((state) => {
      const newOpen = !state.isOpen;
      console.log('[INFO] [sidebarStore] Sidebar toggled:', newOpen ? 'open' : 'closed');
      return { isOpen: newOpen };
    }),

  open: () => {
    console.log('[INFO] [sidebarStore] Sidebar opened');
    set({ isOpen: true });
  },

  close: () => {
    console.log('[INFO] [sidebarStore] Sidebar closed');
    set({ isOpen: false });
  },

  setWidth: (width: number) => {
    console.log('[INFO] [sidebarStore] Sidebar width set:', width);
    set({ width });
  },

  setHoverNeeded: (hoverNeeded: boolean) => {
    console.log('[INFO] [sidebarStore] Hover needed:', hoverNeeded);
    set({ hoverNeeded });
  },

  setHoverWidth: (hoverWidth: number) => {
    console.log('[INFO] [sidebarStore] Hover width set:', hoverWidth);
    set({ hoverWidth });
  },
}));
