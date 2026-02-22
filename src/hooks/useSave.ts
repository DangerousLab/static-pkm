/**
 * useSave hook
 * Provides save logic for the markdown editor.
 * Handles manual save, Cmd+S/Ctrl+S shortcut, and dirty tracking.
 *
 * @module useSave
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { writeFile } from '@core/ipc/commands';
import { useEditorStore } from '@core/state/editorStore';

interface UseSaveReturn {
  save: () => Promise<boolean>;
  isSaving: boolean;
  lastSaved: Date | null;
  /** Exposed so useAutoSave can update the timestamp after an auto-save */
  setLastSaved: (date: Date) => void;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
}

/**
 * useSave
 *
 * @param noteId       - Unique identifier for the document (used for dirty tracking)
 * @param absolutePath - Full filesystem path used by write_file IPC command
 * @param getContent   - Callback ref returning current content (avoids stale closures)
 */
export function useSave(
  noteId: string,
  absolutePath: string,
  getContent: () => string
): UseSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const addDirtyDocument = useEditorStore((s) => s.addDirtyDocument);
  const removeDirtyDocument = useEditorStore((s) => s.removeDirtyDocument);
  const setDocumentContent = useEditorStore((s) => s.setDocumentContent);

  // Keep content cache in sync for close-time Save All
  const getContentRef = useRef(getContent);
  getContentRef.current = getContent;

  useEffect(() => {
    const content = getContentRef.current();
    setDocumentContent(noteId, content, absolutePath);
  });

  // Sync dirty state to global store
  useEffect(() => {
    if (isDirty) {
      addDirtyDocument(noteId);
    } else {
      removeDirtyDocument(noteId);
    }
  }, [isDirty, noteId, addDirtyDocument, removeDirtyDocument]);

  const save = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);

    try {
      const content = getContentRef.current();
      await writeFile(absolutePath, content);

      setLastSaved(new Date());
      setIsDirty(false);
      removeDirtyDocument(noteId);

      console.log('[INFO] [useSave] Saved:', noteId);
      return true;
    } catch (error) {
      console.error('[ERROR] [useSave] Save failed:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [absolutePath, noteId, removeDirtyDocument]);

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

  // Remove from dirty tracking on unmount
  useEffect(() => {
    return () => {
      removeDirtyDocument(noteId);
    };
  }, [noteId, removeDirtyDocument]);

  return { save, isSaving, lastSaved, setLastSaved, isDirty, setIsDirty };
}
