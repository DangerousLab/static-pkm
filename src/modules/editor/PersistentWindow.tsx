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
 *
 * @module PersistentWindow
 */

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { DocumentHandle, ViewportUpdate, VisibleRange } from '@/types/blockstore';
import { getBlocks } from '@core/ipc/blockstore';
import { ViewportCoordinator } from './ViewportCoordinator';
import { TiptapEditor } from './TiptapEditor';

interface PersistentWindowProps {
  docHandle: DocumentHandle;
  onWindowChange: (markdown: string, range: VisibleRange) => void;
  onEditorReady?: (editor: Editor) => void;
}

/**
 * Execute `setContent(markdown)` on the editor as a non-undoable transaction.
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

export const PersistentWindow: React.FC<PersistentWindowProps> = ({
  docHandle,
  onWindowChange,
  onEditorReady,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const coordinatorRef = useRef<ViewportCoordinator | null>(null);
  const editorAnchorRef = useRef<HTMLDivElement>(null);

  const onWindowChangeRef = useRef(onWindowChange);
  onWindowChangeRef.current = onWindowChange;

  const docHandleRef = useRef(docHandle);
  docHandleRef.current = docHandle;

  const [viewportUpdate, setViewportUpdate] = useState<ViewportUpdate | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  const loadedRangeRef = useRef<VisibleRange>({ startBlock: 0, endBlock: 0 });

  // ── ViewportCoordinator ───────────────────────────────────────────────────────

  useEffect(() => {
    const container = scrollContainerRef.current;
    const viewportHeight = container?.clientHeight ?? 600;

    loadedRangeRef.current = { startBlock: 0, endBlock: 0 };

    if (editorAnchorRef.current) {
      editorAnchorRef.current.style.top = '0px';
    }

    if (container) {
      container.scrollTop = 0;
    }

    const coordinator = new ViewportCoordinator(
      docHandle.blocks,
      viewportHeight,
      (update) => setViewportUpdate(update),
    );

    coordinatorRef.current = coordinator;

    const initial = coordinator.initialUpdate();
    setViewportUpdate(initial);

    return () => {
      coordinator.destroy();
      coordinatorRef.current = null;
    };
  }, [docHandle.docId]);

  useEffect(() => {
    coordinatorRef.current?.resetBlocks(docHandle.blocks);
  }, [docHandle.blocks]);

  // ── Fetch blocks when viewport changes ────────────────────────────────────────

  useEffect(() => {
    if (!viewportUpdate || !editorReady) return;

    const { startBlock, endBlock, mode, translateY } = viewportUpdate;

    if (mode === 'flyover') return;

    const loaded = loadedRangeRef.current;

    if (startBlock === loaded.startBlock && endBlock === loaded.endBlock) {
      return;
    }

    const docId = docHandleRef.current.docId;
    let cancelled = false;

    async function fetchAndLoad(): Promise<void> {
      try {
        const blocks = await getBlocks(docId, startBlock, endBlock);
        if (cancelled) return;

        const markdown = blocks.map((b) => b.markdown).join('\n\n');

        const editor = editorInstanceRef.current;
        const anchor = editorAnchorRef.current;
        const coordinator = coordinatorRef.current;
        
        if (!editor || editor.isDestroyed || !anchor || !coordinator) return;

        // Apply exactly what the Layout Oracle says.
        // No DOM measuring, no incremental tracker, no surgical shifts.
        anchor.style.top = `${translateY}px`;
        shiftContentNonUndoable(editor, markdown);

        loadedRangeRef.current = { startBlock, endBlock };
        coordinator.setLoadedRange(startBlock, endBlock);

      } catch (err) {
        console.error('[PersistentWindow] Error loading blocks:', err);
      }
    }

    fetchAndLoad();

    return () => {
      cancelled = true;
    };
  }, [viewportUpdate, editorReady]);

  // ── Callbacks ────────────────────────────────────────────────────────────────

  const handleEditorReady = (editor: Editor) => {
    editorInstanceRef.current = editor;
    setEditorReady(true);
    if (onEditorReady) {
      onEditorReady(editor);
    }
  };

  const handleEditorUpdate = (markdown: string) => {
    onWindowChangeRef.current(markdown, loadedRangeRef.current);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const totalHeight = coordinatorRef.current?.totalHeight ?? 0;
  const isFlyover = viewportUpdate?.mode === 'flyover';

  return (
    <div
      ref={scrollContainerRef}
      onScroll={(e) => coordinatorRef.current?.onScroll(e.currentTarget.scrollTop)}
      className="absolute inset-0 overflow-y-auto overflow-x-hidden scroll-smooth"
    >
      <div
        className="relative w-full"
        style={{ height: `${totalHeight}px` }}
      >
        <div
          ref={editorAnchorRef}
          className="absolute w-full left-0 transition-opacity duration-150 ease-out"
          style={{ opacity: isFlyover ? 0.3 : 1 }}
        >
          <TiptapEditor
            content=""
            onEditorReady={handleEditorReady}
            onChange={handleEditorUpdate}
            externalContentControl={true}
          />
        </div>
      </div>
    </div>
  );
};
