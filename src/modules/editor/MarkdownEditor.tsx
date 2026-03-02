/**
 * MarkdownEditor
 * Full-featured markdown editor with two modes: Edit (Tiptap WYSIWYG) and Source (CodeMirror).
 *
 * In Tauri context, edit mode uses the Persistent Window Architecture (block store +
 * PersistentWindow). Source mode always reads/writes the full file from disk.
 *
 * In PWA/browser context, both modes use the legacy full-file load path.
 *
 * @module MarkdownEditor
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { readFile, writeFile, isTauriContext } from '@core/ipc/commands';
import { updateVisibleWindow, saveDocument } from '@core/ipc/blockstore';
import { listen } from '@tauri-apps/api/event';
import { useEditorStore } from '@core/state/editorStore';
import { useNavigationStore } from '@core/state/navigationStore';
import { useSave } from '@/hooks/useSave';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useFocusSave } from '@/hooks/useFocusSave';
import { useBlockStore } from '@/hooks/useBlockStore';
import type { DocumentNode } from '@/types/navigation';
import type { VisibleRange, WindowUpdateResult } from '@/types/blockstore';
import type { Editor } from '@tiptap/core';
import { TiptapEditor } from './TiptapEditor';
import { EditorToolbar } from './EditorToolbar';
import { PersistentWindow } from './PersistentWindow';
import { SourceView } from './SourceView';
import { FormatToolbar } from './FormatToolbar';
import { DeletedFileModal } from '@components/DeletedFileModal';

interface MarkdownEditorProps {
  node: DocumentNode;
  absolutePath: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractTitleFromContent(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  return normalized.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '';
}

function extractNodeIdFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] ?? '';
}

// ── Component ──────────────────────────────────────────────────────────────────

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  node,
  absolutePath,
}) => {
  const mode = useEditorStore((s) => s.mode);
  const isEditMode = mode === 'edit';
  const isSourceMode = mode === 'source';

  // Persistent window is only available in Tauri context.
  const usePW = isTauriContext();

  // ── Block store (Tauri edit mode only) ───────────────────────────────────
  // Pass null when in source mode so the block store closes.
  const { docHandle, isLoading: pwLoading, error: pwError, closeDoc } = useBlockStore(
    usePW && isEditMode ? absolutePath : null,
  );

  const docHandleRef = useRef(docHandle);
  docHandleRef.current = docHandle;

  // ── Source / legacy content ───────────────────────────────────────────────
  // Used by SourceView (all modes) and TiptapEditor when in PWA mode.
  const [legacyContent, setLegacyContent] = useState('');
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyError, setLegacyError] = useState<string | null>(null);

  // ── Editor instance (surfaced to toolbars) ────────────────────────────────
  const [tiptapEditor, setTiptapEditor] = useState<Editor | null>(null);

  // ── Misc state ────────────────────────────────────────────────────────────
  const [isDeleted, setIsDeleted] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [currentPath, setCurrentPath] = useState(absolutePath);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorToolbarRef = useRef<HTMLDivElement | null>(null);
  const formatToolbarRef = useRef<HTMLDivElement | null>(null);

  // Visible window state (PersistentWindow reports this on every edit)
  const visibleWindowMarkdownRef = useRef<string>('');
  const visibleRangeRef = useRef<VisibleRange>({ startBlock: 0, endBlock: 0 });

  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  const prevNodeIdRef = useRef<string | null>(null);
  const prevNodeTitleRef = useRef<string>(node.title);

  const hasLoadedRef = useRef(false);
  const isRenamingRef = useRef(false);

  // ── Dynamic Layout Measurement ──────────────────────────────────────────
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const measure = () => {
      const h1 = editorToolbarRef.current?.offsetHeight ?? 0;
      const h2 = formatToolbarRef.current?.offsetHeight ?? 0;
      const total = h1 + h2;
      container.style.setProperty('--layout-editor-ui-offset', `${total}px`);
      console.log(`[DEBUG] [MarkdownEditor] UI Offset measured: ${total}px (Toolbar: ${h1}px, Format: ${h2}px)`);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(container);
    if (editorToolbarRef.current) ro.observe(editorToolbarRef.current);
    if (formatToolbarRef.current) ro.observe(formatToolbarRef.current);

    measure(); // Initial measurement

    return () => ro.disconnect();
  }, [isEditMode, tiptapEditor]); // Re-run when toolbars mount/unmount

  // ── Title update ──────────────────────────────────────────────────────────
  const updateTitle = useCallback((savedPath: string, savedContent: string) => {
    const nodeId = extractNodeIdFromPath(savedPath);
    const newTitle = extractTitleFromContent(savedContent);
    const prevTitle = prevNodeTitleRef.current;
    if (newTitle && newTitle !== prevTitle) {
      useNavigationStore.getState().updateNodeTitle(nodeId, newTitle);
      console.log('[INFO] [MarkdownEditor] Title updated:', prevTitle, '->', newTitle);
      prevNodeTitleRef.current = newTitle;
    }
  }, []);

  // ── Auto-save content tracking ────────────────────────────────────────────
  // We feed a single string into useAutoSave to drive dirty-state detection.
  // In PW mode this is the visible window markdown; in legacy mode it's the full content.
  const [autoSaveContent, setAutoSaveContent] = useState('');

  // ── Save implementation ────────────────────────────────────────────────────
  const save = useCallback(async (): Promise<boolean> => {
    const path = currentPathRef.current;

    if (usePW && docHandleRef.current && isEditMode) {
      // ── Block store save (Tauri edit mode) ──────────────────────────────
      const { docId } = docHandleRef.current;
      const markdown = visibleWindowMarkdownRef.current;
      const { startBlock, endBlock } = visibleRangeRef.current;

      if (!markdown) {
        console.log('[INFO] [MarkdownEditor] Skipped PW save - empty window');
        return false;
      }
      try {
        const result: WindowUpdateResult = await updateVisibleWindow(
          docId, startBlock, endBlock, markdown,
        );
        await saveDocument(docId);
        console.log('[INFO] [MarkdownEditor] PW saved:', docId, `(${result.newTotalBlocks} blocks)`);
        updateTitle(path, markdown);
        return true;
      } catch (err) {
        console.error('[ERROR] [MarkdownEditor] PW save failed:', err);
        return false;
      }
    } else {
      // ── Full-file save (PWA / source mode) ──────────────────────────────
      const content = legacyContent;
      if (!content) {
        console.log('[INFO] [MarkdownEditor] Skipped legacy save - empty content');
        return false;
      }
      try {
        await writeFile(path, content);
        console.log('[INFO] [MarkdownEditor] Legacy saved:', path);
        updateTitle(path, content);
        return true;
      } catch (err) {
        console.error('[ERROR] [MarkdownEditor] Legacy save failed:', err);
        return false;
      }
    }
  }, [usePW, isEditMode, updateTitle, legacyContent]);

  // getContent for useSave (Ctrl+S indicator / keyboard shortcut)
  const getContent = useCallback((): string => {
    if (usePW && isEditMode) return visibleWindowMarkdownRef.current;
    return legacyContent;
  }, [usePW, isEditMode, legacyContent]);

  const { isSaving } = useSave(currentPath, getContent);
  const { flushPendingSave, markClean, isDirty } = useAutoSave(autoSaveContent, save);
  useFocusSave(flushPendingSave, isDirty, editorContainerRef as React.RefObject<HTMLDivElement>);

  // ── Load legacy content ───────────────────────────────────────────────────
  // Triggers on: initial mount (PWA), source mode (Tauri), document switch (PWA).
  const loadLegacyContent = useCallback(async (path: string): Promise<void> => {
    setLegacyLoading(true);
    setLegacyError(null);
    try {
      const text = await readFile(path);
      setLegacyContent(text);
      markClean(text);
      hasLoadedRef.current = true;
      console.log('[INFO] [MarkdownEditor] Legacy loaded:', node.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load document';
      setLegacyError(msg);
      console.error('[ERROR] [MarkdownEditor] Legacy load failed:', err);
    } finally {
      setLegacyLoading(false);
    }
  }, [node.id, markClean]);

  // PWA: load on mount / document switch
  useEffect(() => {
    if (usePW) return; // PW handles its own load
    if (isRenamingRef.current) { isRenamingRef.current = false; return; }
    loadLegacyContent(absolutePath);
  }, [node.id, absolutePath, usePW, loadLegacyContent]);

  // Tauri source mode: save block store then read from disk
  useEffect(() => {
    if (!usePW || !isSourceMode) return;

    let cancelled = false;
    async function enterSourceMode(): Promise<void> {
      setLegacyLoading(true);
      // Flush block-store save so disk is up-to-date
      await flushPendingSave();
      try {
        const text = await readFile(currentPathRef.current);
        if (!cancelled) {
          setLegacyContent(text);
          setLegacyLoading(false);
          markClean(text);
        }
      } catch (err) {
        if (!cancelled) {
          setLegacyError(err instanceof Error ? err.message : 'Failed to load for source view');
          setLegacyLoading(false);
        }
      }
    }
    enterSourceMode();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usePW, isSourceMode, currentPath]);

  // When block store opens, mark clean so autoSave doesn't fire immediately
  useEffect(() => {
    if (docHandle) {
      hasLoadedRef.current = true;
      markClean(''); // Visible window content is fetched by PersistentWindow
    }
  }, [docHandle?.docId, markClean]);

  // ── Document switch ───────────────────────────────────────────────────────
  useEffect(() => {
    if (prevNodeIdRef.current !== null && prevNodeIdRef.current !== node.id) {
      if (!isRenamingRef.current) {
        flushPendingSave();
        setCurrentPath(absolutePath);
      }
      hasLoadedRef.current = false;
      isRenamingRef.current = false;
    }
    prevNodeIdRef.current = node.id;
    prevNodeTitleRef.current = node.title;
  }, [node.id, absolutePath, flushPendingSave]);

  // ── Unmount save (legacy path only) ──────────────────────────────────────
  const legacyContentRef = useRef(legacyContent);
  legacyContentRef.current = legacyContent;

  useEffect(() => {
    return () => {
      if (!usePW && hasLoadedRef.current && legacyContentRef.current) {
        writeFile(currentPathRef.current, legacyContentRef.current)
          .then(() => console.log('[INFO] [MarkdownEditor] Unmount save complete'))
          .catch((err) => console.error('[ERROR] [MarkdownEditor] Unmount save failed:', err));
      }
    };
  }, []); // Empty deps — runs only on unmount

  // ── PersistentWindow callbacks ────────────────────────────────────────────
  const handleWindowChange = useCallback((markdown: string, range: VisibleRange) => {
    visibleWindowMarkdownRef.current = markdown;
    visibleRangeRef.current = range;
    setAutoSaveContent(markdown);
  }, []);

  const handleEditorReady = useCallback((editor: Editor) => {
    setTiptapEditor(editor);
  }, []);

  // ── Legacy content change ─────────────────────────────────────────────────
  const handleLegacyChange = useCallback((newContent: string) => {
    setLegacyContent(newContent);
    setAutoSaveContent(newContent);
  }, []);

  // ── File rename listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isTauriContext()) return;
    const unlistenPromise = listen<{ old_path: string; new_path: string }>(
      'file:renamed',
      (event) => {
        const oldNorm = event.payload.old_path.replace(/\\/g, '/').toLowerCase();
        if (oldNorm === currentPath.replace(/\\/g, '/').toLowerCase()) {
          isRenamingRef.current = true;
          const newPath = event.payload.new_path.replace(/\\/g, '/');
          setCurrentPath(newPath);
          console.log('[INFO] [MarkdownEditor] Renamed:', oldNorm, '->', newPath);
        }
      },
    );
    return () => { unlistenPromise.then((u) => u()); };
  }, [currentPath]);

  // ── External modification listener ────────────────────────────────────────
  useEffect(() => {
    if (!isTauriContext()) return;
    const unlistenPromise = listen<{ path: string; mtime: number }>(
      'file:modified',
      async (event) => {
        const eventNorm = event.payload.path.replace(/\\/g, '/').toLowerCase();
        if (eventNorm !== currentPath.replace(/\\/g, '/').toLowerCase()) return;
        console.log('[INFO] [MarkdownEditor] External modification detected');

        if (usePW && isEditMode && docHandleRef.current) {
          // Close and reopen the document so the backend rescans blocks
          try {
            await closeDoc();
            // Toggling the path triggers useBlockStore to reopen
            setCurrentPath((p) => p); // same path — useBlockStore keyed on absolutePath
            // Force useBlockStore effect to re-run by toggling a dummy state
            setIsDeleted(false); // harmless re-render trigger
          } catch (err) {
            console.error('[ERROR] [MarkdownEditor] Failed to reopen after external edit:', err);
          }
        } else {
          // PWA / source mode: reload from disk
          try {
            const diskContent = await readFile(currentPath);
            setLegacyContent(diskContent);
            markClean(diskContent);
            updateTitle(currentPath, diskContent);
            if (tiptapEditor && !tiptapEditor.isDestroyed) {
              const cursor = tiptapEditor.state.selection.anchor;
              tiptapEditor.commands.setContent(diskContent);
              const max = tiptapEditor.state.doc.content.size;
              tiptapEditor.commands.setTextSelection(Math.min(cursor, max));
            }
          } catch (err) {
            console.error('[ERROR] [MarkdownEditor] Reload failed:', err);
          }
        }
      },
    );
    return () => { unlistenPromise.then((u) => u()); };
  }, [currentPath, usePW, isEditMode, markClean, tiptapEditor, closeDoc, updateTitle]);

  // ── File deletion listener ────────────────────────────────────────────────
  useEffect(() => {
    if (!isTauriContext()) return;
    const unlistenPromise = listen<{ path: string; note_id: string }>(
      'file:deleted',
      (event) => {
        if (event.payload.note_id === node.id) {
          setIsDeleted(true);
          setShowDeletedModal(true);
        }
      },
    );
    return () => { unlistenPromise.then((u) => u()); };
  }, [node.id]);

  const handleRestore = useCallback(() => {
    setIsDeleted(false);
    setShowDeletedModal(false);
  }, []);

  const handleDiscard = useCallback(() => {
    useNavigationStore.getState().setActiveNode(null);
  }, []);

  // ── Loading / error ───────────────────────────────────────────────────────
  const isLoading = (usePW && isEditMode) ? pwLoading : legacyLoading;
  const loadError = (usePW && isEditMode) ? pwError : legacyError;

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
        <div className="ui-status-text is-deleted ui-p-md">
          Error loading document: {loadError}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="editor-container" ref={editorContainerRef}>
        <div ref={editorToolbarRef}>
          <EditorToolbar isSaving={isSaving} isDeleted={isDeleted} />
        </div>

        {isEditMode && tiptapEditor && (
          <div ref={formatToolbarRef}>
            <FormatToolbar editor={tiptapEditor} />
          </div>
        )}

        {/* Tauri edit mode: Persistent Window */}
        {isEditMode && usePW && docHandle && (
          <PersistentWindow
            docHandle={docHandle}
            onWindowChange={handleWindowChange}
            onEditorReady={handleEditorReady}
          />
        )}

        {/* PWA edit mode: legacy full-document TipTap */}
        {isEditMode && !usePW && (
          <div className="editor-live-preview">
            <TiptapEditor
              docId={node.id}
              content={legacyContent}
              onChange={handleLegacyChange}
              onEditorReady={setTiptapEditor}
            />
          </div>
        )}

        {/* Source mode (both Tauri and PWA) */}
        {isSourceMode && (
          <div className="editor-source-view">
            <SourceView
              content={legacyContent}
              onChange={handleLegacyChange}
              nodeId={node.id}
            />
          </div>
        )}
      </div>

      {showDeletedModal && (
        <DeletedFileModal
          absolutePath={absolutePath}
          content={legacyContent}
          onRestore={handleRestore}
          onDiscard={handleDiscard}
        />
      )}
    </>
  );
};

export default MarkdownEditor;
