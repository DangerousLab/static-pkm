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
 */
export function useFocusSave(
  save: () => Promise<boolean>,
  content: string
): void {
  const saveRef = useRef(save);
  const contentRef = useRef(content);
  saveRef.current = save;
  contentRef.current = content;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && contentRef.current) {
        // User switched away from app - save immediately (only if content exists)
        saveRef.current();
      }
    };

    const handleBlur = () => {
      // Window lost focus - save immediately (only if content exists)
      if (contentRef.current) {
        saveRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []); // Empty deps - handlers use ref
}
