/**
 * useFocusSave hook
 * Saves immediately when user switches away from the app.
 * Implements Obsidian-style instant external visibility on focus loss.
 *
 * @module useFocusSave
 */

import { useEffect, useRef } from 'react';

/**
 * useFocusSave
 * Triggers save when app loses focus or becomes hidden
 *
 * @param save - Save function from useSave hook
 * @param content - Current content for empty content check
 * @param isDirtyFn - Function to check if content is dirty (prevents duplicate saves)
 */
export function useFocusSave(
  save: () => Promise<boolean>,
  content: string,
  isDirtyFn: () => boolean
): void {
  const saveRef = useRef(save);
  const contentRef = useRef(content);
  const isDirtyFnRef = useRef(isDirtyFn);
  const isSavingRef = useRef(false);  // Prevent duplicate triggers

  saveRef.current = save;
  contentRef.current = content;
  isDirtyFnRef.current = isDirtyFn;

  useEffect(() => {
    const handleFocusLoss = async () => {
      // Skip if already saving, no content, or not dirty
      if (isSavingRef.current || !contentRef.current || !isDirtyFnRef.current()) {
        return;
      }

      isSavingRef.current = true;
      await saveRef.current();
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

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []); // Empty deps - handlers use ref
}
