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

/**
 * Extract node ID (filename) from absolute path
 */
function extractNodeIdFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1];
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
  // Internal path state for rename handling (updated on file:renamed without remount)
  const [currentPath, setCurrentPath] = useState(absolutePath);

  const mode = useEditorStore((s) => s.mode);

  // Ref to editor container for click-outside detection
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Stable getter for current content (avoids stale closures in hooks)
  const contentRef = useRef(content);
  contentRef.current = content;
  const getContent = useCallback(() => contentRef.current, []);

  // Stable ref for current path (avoids stale closure in save)
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  // Track path for unmount save - ONLY update after content is loaded
  const unmountPathRef = useRef<string | null>(null);
  const unmountContentRef = useRef<string>('');
  const hasLoadedRef = useRef(false);

  // Track previous node title for title update detection
  const prevNodeTitleRef = useRef<string>(node.title);

  // Universal post-save handler - updates title when changed
  const handleSaveComplete = useCallback(async (savedPath: string, savedContent: string) => {
    const nodeId = extractNodeIdFromPath(savedPath);
    const newTitle = extractTitleFromContent(savedContent);
    const prevTitle = prevNodeTitleRef.current;

    if (newTitle && newTitle !== prevTitle) {
      useNavigationStore.getState().updateNodeTitle(nodeId, newTitle);
      console.log('[INFO] [MarkdownEditor] Title updated:', prevTitle, '->', newTitle);
      prevNodeTitleRef.current = newTitle;
    }
  }, []);

  // useSave with post-save callback for title updates
  const { save, isSaving, lastSaved } = useSave(currentPath, getContent, handleSaveComplete);

  const { flushPendingSave, markClean, isDirty } = useAutoSave(content, save);
  useFocusSave(flushPendingSave, isDirty, editorContainerRef);

  // Track previous node ID to detect document changes
  const prevNodeIdRef = useRef<string | null>(null);
  // Track rename to skip save on rename-triggered document switch
  const isRenamingRef = useRef(false);


  // Listen for file:renamed events
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistenPromise = listen<{ old_path: string; new_path: string }>('file:renamed', (event) => {
      const oldNorm = event.payload.old_path.replace(/\\/g, '/').toLowerCase();
      const currentNorm = currentPath.replace(/\\/g, '/').toLowerCase();

      if (oldNorm === currentNorm) {
        console.log('[INFO] [MarkdownEditor] File renamed - updating path silently');
        isRenamingRef.current = true;

        // Update path without triggering reload
        const normalizedNewPath = event.payload.new_path.replace(/\\/g, '/');
        setCurrentPath(normalizedNewPath);
        unmountPathRef.current = normalizedNewPath;

        // Content is unchanged - no need to reload
        console.log('[DEBUG] [MarkdownEditor] Updated path on rename:', oldNorm, '->', normalizedNewPath);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [currentPath]);

  // CRITICAL: Save and reset refs when document changes
  useEffect(() => {
    // If node.id changed, flush pending save and save previous document
    if (prevNodeIdRef.current !== null && prevNodeIdRef.current !== node.id) {
      console.log('[DEBUG] [MarkdownEditor] Document changed, flushing save:', prevNodeIdRef.current);

      // Skip save if this is a rename (not a user navigation)
      if (isRenamingRef.current) {
        console.log('[INFO] [MarkdownEditor] Skipping save on rename');
        // Just reset refs, don't save
        hasLoadedRef.current = false;
        unmountContentRef.current = '';
        unmountPathRef.current = null;
      } else {
        // Normal document switch - flush pending auto-save (includes title update via callback)
        flushPendingSave();

        // Reset refs for new document
        hasLoadedRef.current = false;
        unmountContentRef.current = '';
        unmountPathRef.current = null;
      }
    }

    // Update previous node ID and title
    prevNodeIdRef.current = node.id;
    prevNodeTitleRef.current = node.title;
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
      unmountPathRef.current = currentPath;
      hasLoadedRef.current = true;
      console.log('[DEBUG] [MarkdownEditor] Refs updated:', { path: currentPath, contentLen: content.length });
    }
  }, [isLoading, content, currentPath]);

  // Save on unmount only
  useEffect(() => {
    return () => {
      // Only save if we actually loaded content AND have valid refs
      if (hasLoadedRef.current && unmountContentRef.current && unmountPathRef.current) {
        const pathToSave = unmountPathRef.current;
        const contentToSave = unmountContentRef.current;
        const prevTitle = prevNodeTitleRef.current;

        console.log('[DEBUG] [MarkdownEditor] Unmount save:', {
          path: pathToSave,
          contentLen: contentToSave.length
        });

        writeFile(pathToSave, contentToSave)
          .then(() => {
            console.log('[INFO] [MarkdownEditor] Saved on unmount');

            // Update title (same logic as handleSaveComplete)
            const nodeId = extractNodeIdFromPath(pathToSave);
            const newTitle = extractTitleFromContent(contentToSave);
            if (newTitle && newTitle !== prevTitle) {
              useNavigationStore.getState().updateNodeTitle(nodeId, newTitle);
              console.log('[INFO] [MarkdownEditor] Title updated on unmount:', prevTitle, '->', newTitle);
            }
          })
          .catch((err) => console.error('[ERROR] [MarkdownEditor] Save on unmount failed:', err));
      }
    };
  }, []); // Empty deps - runs only on unmount

  // ── Load file on mount / note switch ───────────────────────────────────────
  useEffect(() => {
    // If renaming, don't reload - content is already in editor
    if (isRenamingRef.current) {
      isRenamingRef.current = false;
      console.log('[INFO] [MarkdownEditor] Skipping reload on rename');
      return;
    }

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
          const text = await readFile(absolutePath);  // Use prop, not state

          if (!cancelled) {
            setContent(text);
            setCurrentPath(absolutePath);  // Sync state after successful load
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
  }, [node.id, absolutePath, markClean]);  // Depend on absolutePath

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
      console.log('[INFO] [MarkdownEditor] Auto-reloading from disk:', currentPath);
      const text = await readFile(currentPath);

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
  }, [currentPath, tiptapEditor, markClean]);

  // Listen for external file modifications - backend already filtered our own saves
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistenPromise = listen<{ path: string; mtime: number }>('file:modified', async (event) => {
      const normalizedEventPath = event.payload.path.replace(/\\/g, '/').toLowerCase();
      const normalizedCurrentPath = currentPath.replace(/\\/g, '/').toLowerCase();

      if (normalizedEventPath === normalizedCurrentPath) {
        // External modification detected - reload
        console.log('[INFO] [MarkdownEditor] External modification detected - reloading');

        try {
          const diskContent = await readFile(currentPath);
          setContent(diskContent);
          markClean(diskContent);

          // Update title if changed
          const nodeId = extractNodeIdFromPath(currentPath);
          const newTitle = extractTitleFromContent(diskContent);
          const prevTitle = prevNodeTitleRef.current;
          if (newTitle && newTitle !== prevTitle) {
            useNavigationStore.getState().updateNodeTitle(nodeId, newTitle);
            console.log('[INFO] [MarkdownEditor] Title updated from external change:', prevTitle, '->', newTitle);
            prevNodeTitleRef.current = newTitle;
          }

          // Update Tiptap editor if active
          if (tiptapEditor && !tiptapEditor.isDestroyed) {
            const cursorPos = tiptapEditor.state.selection.anchor;
            tiptapEditor.commands.setContent(diskContent);
            const maxPos = tiptapEditor.state.doc.content.size;
            tiptapEditor.commands.setTextSelection(Math.min(cursorPos, maxPos));
          }
        } catch (err) {
          console.error('[ERROR] [MarkdownEditor] Failed to reload:', err);
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [currentPath, markClean, tiptapEditor]);

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
      <div className="editor-container" ref={editorContainerRef}>
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
