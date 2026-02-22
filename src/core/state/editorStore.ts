/**
 * Editor store
 * Manages editor mode, auto-save, dirty tracking, and content cache.
 *
 * @module editorStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EditorMode = 'read' | 'edit' | 'source';

interface EditorStore {
  // ── Mode ─────────────────────────────────────────────────────────────────
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;

  // ── Auto-save ────────────────────────────────────────────────────────────
  autoSaveEnabled: boolean;
  setAutoSave: (enabled: boolean) => void;

  // ── Close confirmation modal ──────────────────────────────────────────────
  showClosePrompt: boolean;
  setShowClosePrompt: (show: boolean) => void;

  // ── Dirty tracking ───────────────────────────────────────────────────────
  /** Set of noteIds that have unsaved changes */
  dirtyDocuments: Set<string>;
  addDirtyDocument: (noteId: string) => void;
  removeDirtyDocument: (noteId: string) => void;
  clearDirtyDocuments: () => void;

  // ── Content cache (for Save All on close) ────────────────────────────────
  /** Maps noteId → { content, absolutePath } */
  documentContents: Map<string, { content: string; absolutePath: string }>;
  setDocumentContent: (noteId: string, content: string, absolutePath: string) => void;
  getDocumentEntry: (noteId: string) => { content: string; absolutePath: string } | undefined;
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      // ── Mode ───────────────────────────────────────────────────────────────
      mode: 'read',

      setMode: (mode) => {
        console.log('[INFO] [editorStore] Mode set:', mode);
        set({ mode });
      },

      // ── Auto-save ──────────────────────────────────────────────────────────
      autoSaveEnabled: true,

      setAutoSave: (enabled) => {
        console.log('[INFO] [editorStore] Auto-save:', enabled);
        set({ autoSaveEnabled: enabled });
      },

      // ── Close prompt ───────────────────────────────────────────────────────
      showClosePrompt: false,

      setShowClosePrompt: (show) => set({ showClosePrompt: show }),

      // ── Dirty tracking ─────────────────────────────────────────────────────
      dirtyDocuments: new Set(),

      addDirtyDocument: (noteId) => {
        set((state) => ({
          dirtyDocuments: new Set(state.dirtyDocuments).add(noteId),
        }));
      },

      removeDirtyDocument: (noteId) => {
        set((state) => {
          const next = new Set(state.dirtyDocuments);
          next.delete(noteId);
          return { dirtyDocuments: next };
        });
      },

      clearDirtyDocuments: () => set({ dirtyDocuments: new Set() }),

      // ── Content cache ──────────────────────────────────────────────────────
      documentContents: new Map(),

      setDocumentContent: (noteId, content, absolutePath) => {
        set((state) => ({
          documentContents: new Map(state.documentContents).set(noteId, {
            content,
            absolutePath,
          }),
        }));
      },

      getDocumentEntry: (noteId) => {
        return get().documentContents.get(noteId);
      },
    }),
    {
      name: 'unstablon-editor',
      // Only persist user preferences — not runtime state like dirty docs
      partialize: (state) => ({
        mode: state.mode,
        autoSaveEnabled: state.autoSaveEnabled,
      }),
    }
  )
);
