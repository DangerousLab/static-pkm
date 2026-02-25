/**
 * Editor store
 * Manages editor mode, line numbers, and optional cursor/scroll state.
 * Simplified for Obsidian-style always-auto-save approach.
 *
 * @module editorStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

export type EditorMode = 'edit' | 'source';

interface DocumentState {
  /** Scroll percentage (0-1) - primary cross-mode coordinate */
  scrollPercentage: number;
}

/**
 * Custom storage with Map serialization support
 */
const mapStorage: PersistStorage<EditorStore> = {
  getItem: (name): StorageValue<EditorStore> | null => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    return JSON.parse(str, (_key, value) => {
      if (value?.__type === 'Map') return new Map(value.entries);
      return value;
    }) as StorageValue<EditorStore>;
  },
  setItem: (name, value) => {
    const serialized = JSON.stringify(value, (_key, val) => {
      if (val instanceof Map) return { __type: 'Map', entries: [...val.entries()] };
      return val;
    });
    localStorage.setItem(name, serialized);
  },
  removeItem: (name) => localStorage.removeItem(name),
};

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
              scrollPercentage: 0,
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
      storage: mapStorage,
      // Persist user preferences and document states
      partialize: (state) => ({
        mode: state.mode,
        lineNumbersEnabled: state.lineNumbersEnabled,
        documentStates: state.documentStates,
      }) as EditorStore,
    }
  )
);
