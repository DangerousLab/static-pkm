/**
 * PersistentWindow
 *
 * Synthetic scrollbar container for the Persistent Window Architecture.
 */

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { DocumentHandle, ViewportUpdate, VisibleRange } from '@/types/blockstore';
import { getBlocks } from '@core/ipc/blockstore';
import { ViewportCoordinator } from './ViewportCoordinator';
import { TiptapEditor } from './TiptapEditor';
import { setWindowStartBlock } from '../../core/layout/dictatorCoordinator';

interface PersistentWindowProps {
  docHandle: DocumentHandle;
  onWindowChange: (markdown: string, range: VisibleRange) => void;
  onEditorReady?: (editor: Editor) => void;
}

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
  const isFetchingRef = useRef(false);

  const onWindowChangeRef = useRef(onWindowChange);
  onWindowChangeRef.current = onWindowChange;

  const docHandleRef = useRef(docHandle);
  docHandleRef.current = docHandle;

  const [viewportUpdate, setViewportUpdate] = useState<ViewportUpdate | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  const loadedRangeRef = useRef<VisibleRange>({ startBlock: 0, endBlock: 0 });

  // ── ViewportCoordinator Initialization ───────────────────────────────────────

  useEffect(() => {
    const container = scrollContainerRef.current;
    const viewportHeight = container?.clientHeight ?? 600;

    loadedRangeRef.current = { startBlock: 0, endBlock: 0 };
    if (editorAnchorRef.current) editorAnchorRef.current.style.top = '0px';
    if (container) container.scrollTop = 0;

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
    if (!viewportUpdate || !editorReady || isFetchingRef.current) return;

    const { startBlock, endBlock, mode, translateY } = viewportUpdate;
    if (mode === 'flyover') return;

    const loaded = loadedRangeRef.current;
    if (startBlock === loaded.startBlock && endBlock === loaded.endBlock) return;

    const docId = docHandleRef.current.docId;
    let cancelled = false;

    async function fetchAndLoad(): Promise<void> {
      isFetchingRef.current = true;
      coordinatorRef.current?.setLock(true); // Lock coordinator during fetch/swap

      try {
        const blocks = await getBlocks(docId, startBlock, endBlock);
        if (cancelled) return;

        const markdown = blocks.map((b) => b.markdown).join('\n\n');
        const editor = editorInstanceRef.current;
        const anchor = editorAnchorRef.current;
        const container = scrollContainerRef.current;
        const coordinator = coordinatorRef.current;
        
        if (!editor || editor.isDestroyed || !anchor || !coordinator || !container) return;

        // Force capture of current scroll to counteract browser synthetic shifts
        const preDispatchScrollTop = container.scrollTop;
        console.log(`[TELEMETRY] [PW] fetchAndLoad PRE-SWAP | scrollTop=${preDispatchScrollTop.toFixed(2)} anchorTop=${anchor.style.top} targetTranslateY=${translateY}`);
        
        coordinator.suppressScrollFor(150); // Generous suppression window for reflow

        // Apply exactly what the Layout Dictator says.
        anchor.style.top = `${translateY}px`;
        setWindowStartBlock(startBlock);
        shiftContentNonUndoable(editor, markdown);

        // Force scrollTop consistency
        if (container.scrollTop !== preDispatchScrollTop) {
          console.log(`[TELEMETRY] [PW] fetchAndLoad ADJUST | browserChangedScrollTop=${container.scrollTop.toFixed(2)} forcingBackTo=${preDispatchScrollTop.toFixed(2)}`);
          container.scrollTop = preDispatchScrollTop;
        }

        loadedRangeRef.current = { startBlock, endBlock };
        coordinator.setLoadedRange(startBlock, endBlock);

      } catch (err) {
        console.error('[PersistentWindow] Error loading blocks:', err);
      } finally {
        isFetchingRef.current = false;
        // Small delay before unlocking to allow micro-tasks to settle
        setTimeout(() => {
          console.log(`[TELEMETRY] [PW] fetchAndLoad UNLOCK | finalScrollTop=${scrollContainerRef.current?.scrollTop.toFixed(2)}`);
          coordinatorRef.current?.setLock(false);
        }, 50);
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
    if (onEditorReady) onEditorReady(editor);
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
      className="persistent-window"
    >
      <div
        className="persistent-window__total-space"
        style={{ height: `${totalHeight}px` }}
      >
        <div
          ref={editorAnchorRef}
          className={[
            'persistent-window__editor-anchor',
            isFlyover ? 'pw-flyover' : 'pw-settle',
          ].join(' ')}
        >
          <TiptapEditor
            docId={docHandle.docId}
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
