/**
 * useAutoSave hook
 * Debounced auto-save: after 10 seconds of inactivity when the document is
 * dirty and auto-save is enabled, writes the file to disk.
 *
 * After a successful auto-save, calls `setIsDirty(false)` and `setLastSaved(Date)`
 * so the toolbar status ("Unsaved changes" / "Saved just now") updates correctly.
 *
 * @module useAutoSave
 */

import { useEffect, useRef } from 'react';
import { writeFile } from '@core/ipc/commands';
import { useEditorStore } from '@core/state/editorStore';

const AUTO_SAVE_DELAY_MS = 10_000;

/**
 * useAutoSave
 *
 * @param noteId       - Document identifier for dirty-state tracking
 * @param absolutePath - Full filesystem path for write_file IPC
 * @param getContent   - Callback ref returning current content (avoids stale closures)
 * @param isDirty      - Whether the document has unsaved changes
 * @param setIsDirty   - Setter from useSave; called with `false` after auto-save succeeds
 * @param setLastSaved - Setter from useSave; called with current Date after auto-save succeeds
 */
export function useAutoSave(
  noteId: string,
  absolutePath: string,
  getContent: () => string,
  isDirty: boolean,
  setIsDirty: (dirty: boolean) => void,
  setLastSaved: (date: Date) => void,
): void {
  const autoSaveEnabled = useEditorStore((s) => s.autoSaveEnabled);
  const removeDirtyDocument = useEditorStore((s) => s.removeDirtyDocument);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getContentRef = useRef(getContent);
  getContentRef.current = getContent;

  // Keep stable refs so the timer callback always has the latest setters
  const setIsDirtyRef = useRef(setIsDirty);
  setIsDirtyRef.current = setIsDirty;
  const setLastSavedRef = useRef(setLastSaved);
  setLastSavedRef.current = setLastSaved;

  useEffect(() => {
    if (!autoSaveEnabled || !isDirty) {
      // Clear any pending timer when auto-save is toggled off or doc becomes clean
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Reset debounce timer on every content change
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      try {
        const content = getContentRef.current();
        await writeFile(absolutePath, content);
        removeDirtyDocument(noteId);
        // Sync React state so toolbar reflects "Saved just now" instead of "Unsaved changes"
        setIsDirtyRef.current(false);
        setLastSavedRef.current(new Date());
        console.log('[INFO] [useAutoSave] Auto-saved:', noteId);
      } catch (error) {
        console.error('[ERROR] [useAutoSave] Auto-save failed:', error);
      } finally {
        timerRef.current = null;
      }
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isDirty, autoSaveEnabled, absolutePath, noteId, removeDirtyDocument]);
}
