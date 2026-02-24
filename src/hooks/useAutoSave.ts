/**
 * useAutoSave hook
 * Obsidian-style auto-save: debounced save after 2 seconds of inactivity.
 * Always enabled - no dirty tracking, no external mtime checks.
 *
 * @module useAutoSave
 */

import { useEffect, useRef } from 'react';

const AUTO_SAVE_DELAY_MS = 2000;

/**
 * useAutoSave
 *
 * @param content - Current content string (triggers save when changed)
 * @param save    - Save function from useSave hook
 */
export function useAutoSave(
  content: string,
  save: () => Promise<boolean>
): void {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastContentRef = useRef<string>('');
  const saveRef = useRef<() => Promise<boolean>>(save);
  saveRef.current = save;

  // Debounced save on content change
  useEffect(() => {
    // Skip empty content (initial state or between doc switches)
    if (!content) return;

    // Skip if content hasn't changed
    if (content === lastContentRef.current) return;
    lastContentRef.current = content;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule save in 2 seconds
    saveTimeoutRef.current = setTimeout(() => {
      saveRef.current();
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content]); // Only depend on content
}
