/**
 * useFocusSave hook
 * Saves immediately when user switches away from the app or clicks outside the editor.
 * Implements Obsidian-style instant external visibility on focus loss.
 *
 * @module useFocusSave
 */

import { useEffect, useRef, RefObject } from 'react';

/**
 * useFocusSave
 * Triggers save when:
 * 1. App loses focus or becomes hidden (window blur, visibility change)
 * 2. User clicks outside the editor container (sidebar, toolbar, background, etc.)
 *
 * @param flushPendingSave - Flush function from useAutoSave hook
 * @param isDirtyFn - Function to check if content is dirty (prevents duplicate saves)
 * @param containerRef - Optional ref to editor container for click-outside detection
 */
export function useFocusSave(
  flushPendingSave: () => void,
  isDirtyFn: () => boolean,
  containerRef?: RefObject<HTMLDivElement>
): void {
  const flushPendingSaveRef = useRef(flushPendingSave);
  const isDirtyFnRef = useRef(isDirtyFn);
  const isSavingRef = useRef(false);  // Prevent duplicate triggers

  flushPendingSaveRef.current = flushPendingSave;
  isDirtyFnRef.current = isDirtyFn;

  useEffect(() => {
    const handleFocusLoss = () => {
      // Skip if already saving or not dirty
      if (isSavingRef.current || !isDirtyFnRef.current()) {
        return;
      }

      isSavingRef.current = true;
      flushPendingSaveRef.current();
      // Reset after short delay to allow for rapid focus changes
      setTimeout(() => { isSavingRef.current = false; }, 100);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleFocusLoss();
      }
    };

    const handleBlur = () => {
      handleFocusLoss();
    };

    // Handle clicks outside the editor container
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef?.current) return;

      // Check if click target is outside the editor container
      if (!containerRef.current.contains(event.target as Node)) {
        handleFocusLoss();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    // Add click-outside listener if containerRef is provided
    if (containerRef) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      if (containerRef) {
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
  }, [containerRef]); // Re-attach listener if containerRef changes
}
