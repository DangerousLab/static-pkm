/**
 * Editor store
 * Manages editor mode, line numbers, and optional cursor/scroll state.
 * Simplified for Obsidian-style always-auto-save approach.
 *
 * @module editorStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EditorMode = 'edit' | 'source';

interface DocumentState {
  cursorPosition: number;
  scrollPosition: number;
}

interface EditorStore {
  // ── Mode ─────────────────────────────────────────────────────────────────
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;

  // ── Line numbers ─────────────────────────────────────────────────────────
  lineNumbersEnabled: boolean;
  setLineNumbers: (enabled: boolean) => void;

  // ── Document state persistence (optional UX enhancement) ─────────────────
  /** Maps noteId → { cursorPosition, scrollPosition } */
  documentStates: Map<string, DocumentState>;
  updateDocumentState: (noteId: string, updates: Partial<DocumentState>) => void;
  getDocumentState: (noteId: string) => DocumentState | undefined;
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      // ── Mode ───────────────────────────────────────────────────────────────
      mode: 'edit',

      setMode: (mode) => {
        console.log('[INFO] [editorStore] Mode set:', mode);
        set({ mode });
      },

      // ── Line numbers ───────────────────────────────────────────────────────
      lineNumbersEnabled: false,

      setLineNumbers: (enabled) => {
        console.log('[INFO] [editorStore] Line numbers:', enabled);
        set({ lineNumbersEnabled: enabled });
      },

      // ── Document state persistence ─────────────────────────────────────────
      documentStates: new Map(),

      updateDocumentState: (noteId, updates) => {
        set((state) => {
          const states = new Map(state.documentStates);
          const existing = states.get(noteId);

          if (existing) {
            states.set(noteId, { ...existing, ...updates });
          } else {
            states.set(noteId, {
              cursorPosition: 0,
              scrollPosition: 0,
              ...updates,
            });
          }

          return { documentStates: states };
        });
      },

      getDocumentState: (noteId) => {
        return get().documentStates.get(noteId);
      },
    }),
    {
      name: 'unstablon-editor',
      // Only persist user preferences
      partialize: (state) => ({
        mode: state.mode,
        lineNumbersEnabled: state.lineNumbersEnabled,
      }),
    }
  )
);
