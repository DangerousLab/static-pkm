/**
 * useSave hook
 * Provides save logic for the markdown editor.
 * Handles manual save and Cmd+S/Ctrl+S shortcut.
 * Simplified for Obsidian-style always-auto-save approach.
 *
 * @module useSave
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { writeFile } from '@core/ipc/commands';

interface UseSaveReturn {
  save: () => Promise<boolean>;
  isSaving: boolean;
  lastSaved: Date | null;
}

/**
 * useSave
 *
 * @param absolutePath - Full filesystem path used by write_file IPC command
 * @param getContent   - Callback ref returning current content (avoids stale closures)
 * @param onSaveComplete - Optional callback invoked after successful save (for title update, etc.)
 */
export function useSave(
  absolutePath: string,
  getContent: () => string,
  onSaveComplete?: (path: string, content: string) => Promise<void>
): UseSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const getContentRef = useRef(getContent);
  getContentRef.current = getContent;

  const save = useCallback(async (): Promise<boolean> => {
    const content = getContentRef.current();

    // Guard: Never save empty content (prevents data loss during transitions)
    if (!content) {
      console.log('[INFO] [useSave] Skipped save - empty content');
      return false;
    }

    setIsSaving(true);

    try {
      await writeFile(absolutePath, content);

      setLastSaved(new Date());
      console.log('[INFO] [useSave] Saved:', absolutePath);

      // Call optional post-save hook (for title update, etc.)
      if (onSaveComplete) {
        await onSaveComplete(absolutePath, content);
      }

      return true;
    } catch (error) {
      console.error('[ERROR] [useSave] Save failed:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [absolutePath, onSaveComplete]);

  // Keyboard shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  return { save, isSaving, lastSaved };
}
