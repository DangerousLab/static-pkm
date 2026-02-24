/**
 * useAutoSave hook
 * Event-driven auto-save with dirty state tracking.
 * Only saves when content differs from last saved/loaded state.
 * No timing assumptions - uses content comparison to prevent loops.
 *
 * @module useAutoSave
 */

import { useEffect, useRef, useCallback } from 'react';

const AUTO_SAVE_DELAY_MS = 2000;

/**
 * useAutoSave
 *
 * @param content - Current content string (triggers save when changed)
 * @param save    - Save function from useSave hook
 * @returns flushPendingSave, markClean, isDirty function, and isSavingRef
 */
export function useAutoSave(
  content: string,
  save: () => Promise<boolean>
): {
  flushPendingSave: () => void;
  markClean: (diskContent: string) => void;
  isDirty: () => boolean;
  isSavingRef: React.RefObject<boolean>;
} {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedContentRef = useRef<string>(''); // Content that matches disk
  const isDirtyRef = useRef<boolean>(false);
  const isSavingRef = useRef<boolean>(false);
  const saveRef = useRef<() => Promise<boolean>>(save);
  saveRef.current = save;

  // Debounced save on content change - ONLY when dirty
  useEffect(() => {
    // Skip empty content (initial state or between doc switches)
    if (!content) return;

    // Check if content differs from saved content
    const nowDirty = content !== savedContentRef.current;
    isDirtyRef.current = nowDirty;

    // Only schedule save if actually dirty
    if (!nowDirty) {
      // Content matches disk - clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = undefined;
      }
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule save in 2 seconds
    saveTimeoutRef.current = setTimeout(async () => {
      isSavingRef.current = true;
      const success = await saveRef.current();
      if (success) {
        // After successful save, mark content as clean
        savedContentRef.current = content;
        isDirtyRef.current = false;
      }
      // Clear immediately after write completes
      isSavingRef.current = false;
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content]);

  // Function to immediately flush pending save
  const flushPendingSave = useCallback(async () => {
    if (isDirtyRef.current && saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = undefined;
      console.log('[DEBUG] [useAutoSave] Flushing pending save');
      isSavingRef.current = true;
      const success = await saveRef.current();
      if (success) {
        savedContentRef.current = content;
        isDirtyRef.current = false;
      }
      isSavingRef.current = false;
    }
  }, [content]);

  // Call after load/reload to mark content as matching disk
  const markClean = useCallback((diskContent: string) => {
    savedContentRef.current = diskContent;
    isDirtyRef.current = false;
    // Cancel any pending save since we just loaded from disk
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = undefined;
    }
    console.log('[DEBUG] [useAutoSave] Marked clean, content length:', diskContent.length);
  }, []);

  // Expose isDirty as a function to get latest value
  const isDirty = useCallback(() => isDirtyRef.current, []);

  return {
    flushPendingSave,
    markClean,
    isDirty,
    isSavingRef,
  };
}
