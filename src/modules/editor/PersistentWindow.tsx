/**
 * PersistentWindow
 *
 * Synthetic scrollbar container for the Persistent Window Architecture.
 *
 * Renders a native scroll container whose internal spacer div is sized to
 * the full estimated document height. The TipTap editor is absolutely
 * positioned inside this spacer at the correct vertical offset, creating the
 * illusion of a normal scrolling document while keeping only ~200 blocks
 * loaded in ProseMirror at any time.
 *
 * Responsibilities:
 *   - Create and own a ViewportCoordinator instance.
 *   - Fetch visible blocks from the Rust backend via IPC on scroll / settle.
 *   - Execute non-undoable viewport-shift transactions on the TipTap editor.
 *   - Report user edits (visible window markdown) to the parent via callbacks.
 *   - Measure actual block heights and report them back to the coordinator.
 *
 * @module PersistentWindow
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import type { DocumentHandle, ViewportUpdate, VisibleRange } from '@/types/blockstore';
import { getBlocks, updateBlockHeight } from '@core/ipc/blockstore';
import { ViewportCoordinator } from './ViewportCoordinator';
import { TiptapEditor } from './TiptapEditor';

// ── Props ──────────────────────────────────────────────────────────────────────

interface PersistentWindowProps {
  docHandle: DocumentHandle;
  /** Called when the user edits content in the visible window. */
  onWindowChange: (markdown: string, range: VisibleRange) => void;
  /** Surfaces the TipTap editor instance to the parent (for toolbars). */
  onEditorReady?: (editor: Editor) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Execute `setContent(markdown)` on the editor as a non-undoable transaction.
 *
 * Temporarily patches `editor.view.dispatch` so every transaction fired
 * during the synchronous `setContent` call gets `addToHistory: false` and
 * `viewportShift: true` meta. These meta keys are checked in TiptapEditor's
 * `onUpdate` handler so viewport shifts don't trigger `onChange`.
 */
function shiftContentNonUndoable(editor: Editor, markdown: string): void {
  let isShifting = true;
  const original = editor.view.dispatch.bind(editor.view);

  editor.view.dispatch = (tr) => {
    if (isShifting) {
      tr.setMeta('addToHistory', false);
      tr.setMeta('viewportShift', true);
    }
    original(tr);
  };

  try {
    editor.commands.setContent(markdown);
  } finally {
    isShifting = false;
    editor.view.dispatch = original;
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export const PersistentWindow: React.FC<PersistentWindowProps> = ({
  docHandle,
  onWindowChange,
  onEditorReady,
}) => {
  // ── Refs ─────────────────────────────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const coordinatorRef = useRef<ViewportCoordinator | null>(null);

  // Stable refs for callbacks (avoid stale closures)
  const onWindowChangeRef = useRef(onWindowChange);
  onWindowChangeRef.current = onWindowChange;

  const docHandleRef = useRef(docHandle);
  docHandleRef.current = docHandle;

  // ── State ─────────────────────────────────────────────────────────────────────
  const [visibleMarkdown, setVisibleMarkdown] = useState('');
  const [viewportUpdate, setViewportUpdate] = useState<ViewportUpdate | null>(null);

  // Track the currently loaded block range for edit sync
  const loadedRangeRef = useRef<VisibleRange>({ startBlock: 0, endBlock: 0 });

  // ── ViewportCoordinator ───────────────────────────────────────────────────────

  // Create coordinator when docHandle changes (new document opened)
  useEffect(() => {
    const container = scrollContainerRef.current;
    const viewportHeight = container?.clientHeight ?? 600;

    const coordinator = new ViewportCoordinator(
      docHandle.blocks,
      viewportHeight,
      (update) => setViewportUpdate(update),
    );

    coordinatorRef.current = coordinator;

    // Emit initial update synchronously so we know the first block range
    const initial = coordinator.initialUpdate();
    setViewportUpdate(initial);

    return () => {
      coordinator.destroy();
      coordinatorRef.current = null;
    };
  }, [docHandle.docId]); // Re-create when document changes

  // Update coordinator block metadata when the document handle refreshes
  // (e.g. after update_visible_window changed total block count)
  useEffect(() => {
    coordinatorRef.current?.resetBlocks(docHandle.blocks);
  }, [docHandle.blocks]);

  // ── Fetch blocks when viewport changes ────────────────────────────────────────

  useEffect(() => {
    if (!viewportUpdate) return;

    const { startBlock, endBlock, mode } = viewportUpdate;

    // Don't fetch during flyover — just update translateY position
    if (mode === 'flyover') return;

    const docId = docHandleRef.current.docId;
    let cancelled = false;

    async function fetchAndLoad(): Promise<void> {
      try {
        const blocks = await getBlocks(docId, startBlock, endBlock);
        if (cancelled) return;

        const markdown = blocks.map((b) => b.markdown).join('\n\n');
        loadedRangeRef.current = { startBlock, endBlock };

        if (mode === 'settle' || mode === 'smooth') {
          // Settle: replace entire visible window via non-undoable transaction
          const editor = editorInstanceRef.current;
          if (editor && !editor.isDestroyed) {
            shiftContentNonUndoable(editor, markdown);
          }
          setVisibleMarkdown(markdown);
        }
        // For 'skeleton': keep existing content visible (editor fades via CSS)
        // The settle event that follows will reload with the new position.
      } catch (err) {
        console.error('[ERROR] [PersistentWindow] Failed to fetch blocks:', err);
      }
    }

    fetchAndLoad();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportUpdate]);

  // ── Scroll handler ────────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    coordinatorRef.current?.onScroll(scrollTop);
  }, []);

  // ── ResizeObserver (container height changes) ─────────────────────────────────

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 600;
      coordinatorRef.current?.setViewportHeight(height);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Editor ready callback ─────────────────────────────────────────────────────

  const handleEditorReady = useCallback(
    (editor: Editor) => {
      editorInstanceRef.current = editor;
      onEditorReady?.(editor);
    },
    [onEditorReady],
  );

  // ── User edit handler ─────────────────────────────────────────────────────────

  const handleChange = useCallback((markdown: string) => {
    setVisibleMarkdown(markdown);
    onWindowChangeRef.current(markdown, loadedRangeRef.current);
  }, []);

  // ── Height measurement ────────────────────────────────────────────────────────
  // Report actual rendered heights back to coordinator and backend for
  // improved scrollbar accuracy.

  const editorAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anchor = editorAnchorRef.current;
    if (!anchor) return;

    const docId = docHandleRef.current.docId;

    const observer = new ResizeObserver(() => {
      // Report the editor anchor's rendered height for the first visible block.
      // For a proper per-block measurement we'd need multiple observers, but
      // for MVP we update the starting block with the average block height.
      const anchorHeight = anchor.getBoundingClientRect().height;
      const { startBlock, endBlock } = loadedRangeRef.current;
      const loadedCount = endBlock - startBlock;
      if (loadedCount <= 0) return;

      const avgHeight = anchorHeight / loadedCount;
      for (let i = startBlock; i < endBlock; i++) {
        coordinatorRef.current?.updateBlockHeight(i, avgHeight);
        // Fire-and-forget IPC — no need to await for MVP
        updateBlockHeight(docId, i, avgHeight).catch(() => {});
      }
    });

    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  // ── Computed values ───────────────────────────────────────────────────────────

  const totalHeight = coordinatorRef.current?.totalHeight ?? docHandle.totalEstimatedHeight;
  const translateY = viewportUpdate?.translateY ?? 0;
  const scrollMode = viewportUpdate?.mode ?? 'settle';

  const anchorModeClass =
    scrollMode === 'skeleton'
      ? 'pw-skeleton'
      : scrollMode === 'flyover'
        ? 'pw-flyover'
        : 'pw-settle';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={scrollContainerRef}
      className="persistent-window"
      onScroll={handleScroll}
    >
      {/* Spacer div forces the full document height so the browser renders
          a scrollbar proportional to the entire document. */}
      <div
        className="persistent-window__total-space"
        style={{ height: `${totalHeight}px` }}
      >
        {/* Editor anchor is positioned at translateY so it appears at the
            correct scroll offset within the total space. */}
        <div
          ref={editorAnchorRef}
          className={`persistent-window__editor-anchor ${anchorModeClass}`}
          style={{ top: `${translateY}px` }}
        >
          <TiptapEditor
            content={visibleMarkdown}
            onChange={handleChange}
            onEditorReady={handleEditorReady}
          />
        </div>
      </div>
    </div>
  );
};

export default PersistentWindow;
