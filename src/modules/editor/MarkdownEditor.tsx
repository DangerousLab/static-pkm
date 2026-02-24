/**
 * MarkdownEditor
 * Full-featured markdown editor with two modes: Edit (Tiptap WYSIWYG) and Source (CodeMirror).
 * Obsidian-style always-auto-save approach with event-based saves.
 *
 * @module MarkdownEditor
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { readFile, writeFile, isTauriContext } from '@core/ipc/commands';
import { listen } from '@tauri-apps/api/event';
import { useEditorStore } from '@core/state/editorStore';
import { useNavigationStore } from '@core/state/navigationStore';
import { useSave } from '@/hooks/useSave';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useFocusSave } from '@/hooks/useFocusSave';
import { OverlayScrollbarsComponent, getScrollbarOptions } from '@core/utils/scrollbar';
import { needsCustomScrollbar } from '@core/utils/platform';
import type { DocumentNode } from '@/types/navigation';
import type { Editor } from '@tiptap/react';
import { EditorToolbar } from './EditorToolbar';
import { TiptapEditor } from './TiptapEditor';
import { SourceView } from './SourceView';
import { FormatToolbar } from './FormatToolbar';
import { DeletedFileModal } from '@components/DeletedFileModal';

interface MarkdownEditorProps {
  node: DocumentNode;
  absolutePath: string;
}

/**
 * Extract title from markdown content (first # heading)
 * Normalizes CRLF to LF to handle Windows line endings
 */
function extractTitleFromContent(content: string): string {
  // Normalize CRLF to LF
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? '';
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  node,
  absolutePath,
}) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tiptapEditor, setTiptapEditor] = useState<Editor | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);

  const mode = useEditorStore((s) => s.mode);

  // Stable getter for current content (avoids stale closures in hooks)
  const contentRef = useRef(content);
  contentRef.current = content;
  const getContent = useCallback(() => contentRef.current, []);

  // Track path for unmount save - ONLY update after content is loaded
  const unmountPathRef = useRef<string | null>(null);
  const unmountContentRef = useRef<string>('');
  const hasLoadedRef = useRef(false);

  const { save: originalSave, isSaving, lastSaved } = useSave(absolutePath, getContent);

  // Track save-in-progress for file:modified handler
  const isSavingRef = useRef(false);

  // Wrap save to track isSaving state and update tree title
  const save = useCallback(async (): Promise<boolean> => {
    isSavingRef.current = true;
    const success = await originalSave();
    isSavingRef.current = false;  // Clear immediately after write completes

    if (success) {
      // After successful save, extract title and update tree
      // Use contentRef.current to avoid stale closure
      const newTitle = extractTitleFromContent(contentRef.current);
      if (newTitle && newTitle !== node.title) {
        useNavigationStore.getState().updateNodeTitle(node.id, newTitle);
      }
    }

    return success;
  }, [originalSave, node.id, node.title]);

  const { flushPendingSave, markClean, isDirty, isSavingRef: autoSaveIsSavingRef } = useAutoSave(content, save);
  useFocusSave(save, content, isDirty);

  // Track previous node ID to detect document changes
  const prevNodeIdRef = useRef<string | null>(null);
  // Track rename to skip save on rename-triggered document switch
  const isRenamingRef = useRef(false);

  // Listen for file:renamed events
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistenPromise = listen<{ old_path: string; new_path: string }>('file:renamed', (event) => {
      const oldNorm = event.payload.old_path.replace(/\\/g, '/').toLowerCase();
      const currentNorm = absolutePath.replace(/\\/g, '/').toLowerCase();

      if (oldNorm === currentNorm) {
        console.log('[INFO] [MarkdownEditor] File rename detected for current document');
        isRenamingRef.current = true;

        // Clear path ref to prevent saving to old path
        // This prevents document switch effect from recreating the old file
        unmountPathRef.current = null;

        console.log('[DEBUG] [MarkdownEditor] Cleared unmount path ref on rename');
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [absolutePath]);

  // CRITICAL: Save and reset refs when document changes
  useEffect(() => {
    // If node.id changed, flush pending save and save previous document
    if (prevNodeIdRef.current !== null && prevNodeIdRef.current !== node.id) {
      console.log('[DEBUG] [MarkdownEditor] Document changed, flushing save:', prevNodeIdRef.current);

      // Skip save if this is a rename (not a user navigation)
      if (isRenamingRef.current) {
        console.log('[INFO] [MarkdownEditor] Skipping save on rename');
        isRenamingRef.current = false;
        // Just reset refs, don't save
        hasLoadedRef.current = false;
        unmountContentRef.current = '';
        unmountPathRef.current = null;
      } else {
        // Normal document switch - save previous
        // Flush any pending auto-save
        flushPendingSave();

        // Save previous document if we have valid refs
        if (hasLoadedRef.current && unmountContentRef.current && unmountPathRef.current) {
          console.log('[DEBUG] [MarkdownEditor] Saving previous document on switch');
          writeFile(unmountPathRef.current, unmountContentRef.current)
            .then(() => console.log('[INFO] [MarkdownEditor] Saved previous document on switch'))
            .catch((err) => console.error('[ERROR] [MarkdownEditor] Failed to save previous document:', err));
        }

        // Reset refs for new document
        hasLoadedRef.current = false;
        unmountContentRef.current = '';
        unmountPathRef.current = null;
      }
    }

    // Update previous node ID
    prevNodeIdRef.current = node.id;
  }, [node.id, flushPendingSave]);

  // Keep content ref synced for unmount save (only after THIS document loads)
  useEffect(() => {
    // Only sync if: loaded flag is set AND we're not in loading state AND content is not empty
    if (hasLoadedRef.current && !isLoading && content) {
      unmountContentRef.current = content;
    }
  }, [content, isLoading]);

  // Update path ref AFTER content loads, not on mount
  useEffect(() => {
    if (!isLoading && content) {
      unmountPathRef.current = absolutePath;
      hasLoadedRef.current = true;
      console.log('[DEBUG] [MarkdownEditor] Refs updated:', { path: absolutePath, contentLen: content.length });
    }
  }, [isLoading, content, absolutePath]);

  // Save on unmount only
  useEffect(() => {
    return () => {
      // Only save if we actually loaded content AND have valid refs
      if (hasLoadedRef.current && unmountContentRef.current && unmountPathRef.current) {
        console.log('[DEBUG] [MarkdownEditor] Unmount save:', {
          path: unmountPathRef.current,
          contentLen: unmountContentRef.current.length
        });
        writeFile(unmountPathRef.current, unmountContentRef.current)
          .then(() => console.log('[INFO] [MarkdownEditor] Saved on unmount'))
          .catch((err) => console.error('[ERROR] [MarkdownEditor] Save on unmount failed:', err));
      }
    };
  }, []); // Empty deps - runs only on unmount

  // ── Load file on mount / note switch ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setIsLoading(true);
      setLoadError(null);
      setIsDeleted(false);
      setShowDeletedModal(false);

      // Retry logic for file rename transitions (3 attempts, 100ms delay)
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const text = await readFile(absolutePath);

          if (!cancelled) {
            setContent(text);
            setIsLoading(false);
            markClean(text); // Mark as clean - prevents auto-save
            console.log('[INFO] [MarkdownEditor] Loaded:', node.id);
          }
          return; // Success, exit retry loop
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Failed to load document');

          if (attempt < maxRetries) {
            console.log(`[WARN] [MarkdownEditor] Load attempt ${attempt} failed, retrying...`);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      // All retries failed
      if (!cancelled && lastError) {
        setLoadError(lastError.message);
        console.error('[ERROR] [MarkdownEditor] Load failed after retries:', lastError);
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [node.id, absolutePath]);

  // Restore cursor/scroll position after editor mounts or document switches (optional UX)
  useEffect(() => {
    if (!tiptapEditor || tiptapEditor.isDestroyed || isLoading) return;

    const cached = useEditorStore.getState().getDocumentState(node.id);
    if (cached) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        if (tiptapEditor.isDestroyed) return;

        if (cached.cursorPosition > 0) {
          const maxPos = tiptapEditor.state.doc.content.size;
          tiptapEditor.commands.setTextSelection(Math.min(cached.cursorPosition, maxPos));
        }

        if (cached.scrollPosition > 0) {
          const scrollContainer = document.querySelector('.editor-live-preview');
          if (scrollContainer) {
            scrollContainer.scrollTop = cached.scrollPosition;
          }
        }
      }, 0);
    }
  }, [tiptapEditor, node.id, isLoading]);

  // Save cursor/scroll position when editor changes (optional UX)
  useEffect(() => {
    if (!tiptapEditor || tiptapEditor.isDestroyed) return;

    const handleUpdate = () => {
      const cursor = tiptapEditor.state.selection.anchor;
      const scrollContainer = document.querySelector('.editor-live-preview');
      const scroll = scrollContainer?.scrollTop ?? 0;

      useEditorStore.getState().updateDocumentState(node.id, {
        cursorPosition: cursor,
        scrollPosition: scroll,
      });
    };

    tiptapEditor.on('update', handleUpdate);
    tiptapEditor.on('selectionUpdate', handleUpdate);

    return () => {
      tiptapEditor.off('update', handleUpdate);
      tiptapEditor.off('selectionUpdate', handleUpdate);
    };
  }, [tiptapEditor, node.id]);

  // Save cursor/scroll on unmount
  useEffect(() => {
    return () => {
      if (tiptapEditor && !tiptapEditor.isDestroyed) {
        const cursor = tiptapEditor.state.selection.anchor;
        const scrollContainer = document.querySelector('.editor-live-preview');
        const scroll = scrollContainer?.scrollTop ?? 0;

        useEditorStore.getState().updateDocumentState(node.id, {
          cursorPosition: cursor,
          scrollPosition: scroll,
        });
      }
    };
  }, [tiptapEditor, node.id]);

  const handleChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
    },
    []
  );

  // Reload content from disk - Obsidian behavior: always auto-reload
  const reloadContent = useCallback(async () => {
    try {
      console.log('[INFO] [MarkdownEditor] Auto-reloading from disk:', absolutePath);
      const text = await readFile(absolutePath);

      // Preserve cursor position in Tiptap
      let cursorPos: number | null = null;
      if (tiptapEditor && !tiptapEditor.isDestroyed) {
        cursorPos = tiptapEditor.state.selection.anchor;
      }

      setContent(text);
      markClean(text); // Mark as clean - prevents auto-save loop

      // Update Tiptap editor and restore cursor
      if (tiptapEditor && !tiptapEditor.isDestroyed) {
        tiptapEditor.commands.setContent(text);

        // Restore cursor position (clamped to new content length)
        if (cursorPos !== null) {
          const maxPos = tiptapEditor.state.doc.content.size;
          const safePos = Math.min(cursorPos, maxPos);
          tiptapEditor.commands.setTextSelection(safePos);
        }
      }

      console.log('[INFO] [MarkdownEditor] Auto-reload complete');
    } catch (err) {
      console.error('[ERROR] [MarkdownEditor] Auto-reload failed:', err);
    }
  }, [absolutePath, tiptapEditor, markClean]);

  // Listen for external file modifications - ALWAYS auto-reload (Obsidian behavior)
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistenPromise = listen<{ path: string; mtime: number }>('file:modified', async (event) => {
      const normalizedEventPath = event.payload.path.replace(/\\/g, '/').toLowerCase();
      const normalizedAbsolutePath = absolutePath.replace(/\\/g, '/').toLowerCase();

      if (normalizedEventPath === normalizedAbsolutePath) {
        // Skip if we just saved (prevents reading our own write)
        if (isSavingRef.current || autoSaveIsSavingRef.current) {
          console.log('[INFO] [MarkdownEditor] Ignoring file:modified during save');
          return;
        }

        // Read file and compare with our content
        try {
          const diskContent = await readFile(absolutePath);

          // If disk content matches our current content, this is our own save
          if (diskContent === contentRef.current) {
            console.log('[INFO] [MarkdownEditor] Ignoring own save (content matches)');
            return;
          }

          // External modification - reload
          console.log('[INFO] [MarkdownEditor] External modification detected - reloading');
          setContent(diskContent);
          markClean(diskContent);

          // Update Tiptap editor if active
          if (tiptapEditor && !tiptapEditor.isDestroyed) {
            const cursorPos = tiptapEditor.state.selection.anchor;
            tiptapEditor.commands.setContent(diskContent);

            // Restore cursor position (clamped to new content length)
            const maxPos = tiptapEditor.state.doc.content.size;
            const safePos = Math.min(cursorPos, maxPos);
            tiptapEditor.commands.setTextSelection(safePos);
          }
        } catch (err) {
          console.error('[ERROR] [MarkdownEditor] Failed to read for comparison:', err);
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [absolutePath, markClean, tiptapEditor]);

  // Listen for file deletion events - show immediate restore prompt
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistenPromise = listen<{ path: string; note_id: string }>('file:deleted', (event) => {
      if (event.payload.note_id === node.id) {
        console.log('[INFO] [MarkdownEditor] File deleted on disk:', node.id);
        setIsDeleted(true);
        setShowDeletedModal(true);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [node.id]);

  // Handle deleted file modal actions
  const handleRestore = useCallback(() => {
    setIsDeleted(false);
    setShowDeletedModal(false);
    console.log('[INFO] [MarkdownEditor] File restored:', absolutePath);
  }, [absolutePath]);

  const handleDiscard = useCallback(() => {
    // Return to initial page (no active document)
    useNavigationStore.getState().setActiveNode(null);
    console.log('[INFO] [MarkdownEditor] Deleted file discarded, returning to initial page');
  }, []);

  const osOptions = getScrollbarOptions();
  const useMacOSScrollbars = needsCustomScrollbar();

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="editor-container">
        <div className="editor-loading">Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="editor-container">
        <div className="p-4 text-sm text-red-600 dark:text-red-400">
          Error loading document: {loadError}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="editor-container">
        <EditorToolbar
          isSaving={isSaving}
          isDeleted={isDeleted}
        />

        {mode === 'edit' && tiptapEditor && <FormatToolbar editor={tiptapEditor} />}

        {mode === 'edit' && (
          useMacOSScrollbars ? (
            <OverlayScrollbarsComponent
              element="div"
              className="editor-live-preview"
              options={osOptions}
              defer
            >
              <TiptapEditor
                content={content}
                onChange={handleChange}
                onEditorReady={setTiptapEditor}
              />
            </OverlayScrollbarsComponent>
          ) : (
            <div className="editor-live-preview">
              <TiptapEditor
                content={content}
                onChange={handleChange}
                onEditorReady={setTiptapEditor}
              />
            </div>
          )
        )}

        {mode === 'source' && (
          useMacOSScrollbars ? (
            <OverlayScrollbarsComponent
              element="div"
              className="editor-source-view"
              options={osOptions}
              defer
            >
              <SourceView
                content={content}
                onChange={handleChange}
              />
            </OverlayScrollbarsComponent>
          ) : (
            <div className="editor-source-view">
              <SourceView
                content={content}
                onChange={handleChange}
              />
            </div>
          )
        )}
      </div>

      {/* Deleted file modal */}
      {showDeletedModal && (
        <DeletedFileModal
          absolutePath={absolutePath}
          content={content}
          onRestore={handleRestore}
          onDiscard={handleDiscard}
        />
      )}
    </>
  );
};

export default MarkdownEditor;
