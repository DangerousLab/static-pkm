/**
 * Editor store
 * Manages editor mode.
 * Simplified for Obsidian-style always-auto-save approach.
 *
 * @module editorStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EditorMode = 'edit' | 'source';

interface EditorStore {
  // ── Mode ─────────────────────────────────────────────────────────────────
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set) => ({
      // ── Mode ───────────────────────────────────────────────────────────────
      mode: 'edit',

      setMode: (mode) => {
        set({ mode });
      },
    }),
    {
      name: 'unstablon-editor-settings',
      // Only persist the mode
      partialize: (state) => ({
        mode: state.mode,
      }),
    }
  )
);
