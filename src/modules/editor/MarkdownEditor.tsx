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
 */
function extractTitleFromContent(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
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

  // Track when we're saving to prevent infinite reload loop
  const isSavingRef = useRef(false);

  // Track path for unmount save - ONLY update after content is loaded
  const unmountPathRef = useRef<string | null>(null);
  const unmountContentRef = useRef<string>('');
  const hasLoadedRef = useRef(false);

  const { save: originalSave, isSaving, lastSaved } = useSave(absolutePath, getContent);

  // Wrap save to also update tree title
  const save = useCallback(async (): Promise<boolean> => {
    isSavingRef.current = true;
    const success = await originalSave();

    // Delay clearing the flag to account for file watcher latency
    setTimeout(() => {
      isSavingRef.current = false;
    }, 500);

    if (success) {
      // After successful save, extract title and update tree
      const newTitle = extractTitleFromContent(content);
      if (newTitle && newTitle !== node.title) {
        useNavigationStore.getState().updateNodeTitle(node.id, newTitle);
      }
    }

    return success;
  }, [originalSave, content, node.id, node.title]);

  useAutoSave(content, save);
  useFocusSave(save, content);

  // CRITICAL: Reset loaded flag when document changes - prevents stale content sync
  useEffect(() => {
    console.log('[DEBUG] [MarkdownEditor] Document changed, resetting refs:', node.id);
    hasLoadedRef.current = false;
    unmountContentRef.current = '';
    unmountPathRef.current = null;
  }, [node.id]);

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

      try {
        const text = await readFile(absolutePath);

        if (!cancelled) {
          setContent(text);
          console.log('[INFO] [MarkdownEditor] Loaded:', node.id);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load document';
          setLoadError(msg);
          console.error('[ERROR] [MarkdownEditor] Load failed:', err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
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
  }, [absolutePath, tiptapEditor]);

  // Listen for external file modifications - ALWAYS auto-reload (Obsidian behavior)
  useEffect(() => {
    if (!isTauriContext()) return;

    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listen<{ path: string; mtime: number }>('file:modified', (event) => {
        const normalizedEventPath = event.payload.path.replace(/\\/g, '/').toLowerCase();
        const normalizedAbsolutePath = absolutePath.replace(/\\/g, '/').toLowerCase();

        if (normalizedEventPath === normalizedAbsolutePath) {
          // Skip reload if this is our own save
          if (isSavingRef.current) {
            console.log('[INFO] [MarkdownEditor] Ignoring self-modification');
            return;
          }

          console.log('[INFO] [MarkdownEditor] External modification - auto-reloading');
          // Obsidian behavior: always reload immediately, no confirmation
          reloadContent();
        }
      });
    };

    setup();

    return () => {
      if (unlisten) unlisten();
    };
  }, [absolutePath, reloadContent]);

  // Listen for file deletion events - show immediate restore prompt
  useEffect(() => {
    if (!isTauriContext()) return;

    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listen<{ path: string; note_id: string }>('file:deleted', (event) => {
        if (event.payload.note_id === node.id) {
          console.log('[INFO] [MarkdownEditor] File deleted on disk:', node.id);
          setIsDeleted(true);
          setShowDeletedModal(true);
        }
      });
    };

    setup();

    return () => {
      if (unlisten) unlisten();
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
          lastSaved={lastSaved}
          isDeleted={isDeleted}
          onSave={save}
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
