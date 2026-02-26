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
 * Content control:
 *   - PersistentWindow is the sole owner of TipTap content. It passes
 *     `externalContentControl` to TiptapEditor, disabling the prop-based
 *     content sync and the mount-time setContent call. All content is set
 *     through `shiftContentNonUndoable` after the editor signals ready.
 *   - The fetch effect is gated on `editorReady` so no content is pushed
 *     before extensions have finished loading.
 *
 * translateY management (v5.5c):
 *   - translateY is tracked INCREMENTALLY via `incrementalTranslateYRef`
 *     using actual DOM measurements — NOT estimated cumulative heights.
 *   - On each overlapping range shift, a reference block's screen Y is
 *     captured BEFORE and AFTER setContent. The anchor is then adjusted
 *     by -(newY - oldY) to cancel any displacement. This is pixel-perfect
 *     because it captures all sources of movement: margins, padding,
 *     collapsed margins, block-type differences — everything.
 *   - No estimation is involved in the overlapping-shift path at all.
 *   - For non-overlapping shifts (flyover → settle jumps), we fall back
 *     to the estimated translateY from ViewportCoordinator and reset the
 *     incremental tracker to that value.
 *   - Estimated heights remain in ViewportCoordinator for: scrollbar
 *     proportional height (spacer div), binary search (scrollTop → block
 *     index), and hysteresis calculations.
 *
 * @module PersistentWindow
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import type { DocumentHandle, ViewportUpdate, VisibleRange } from '@/types/blockstore';
import { getBlocks } from '@core/ipc/blockstore';
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

  /**
   * Ref to the editor anchor div. The `top` style is applied imperatively
   * inside fetchAndLoad — never through React state — so that the position
   * change, content swap, and scrollTop correction are always batched into
   * one synchronous block (one browser paint frame).
   */
  const editorAnchorRef = useRef<HTMLDivElement>(null);

  /**
   * Tracks the current anchor `top` value using actual DOM measurements.
   * Starts at 0 and is adjusted incrementally on each overlapping range shift:
   *   - Downward: += measured height of blocks removed from the editor top
   *   - Upward:   -= measured height of blocks added to the editor top
   *
   * For non-overlapping shifts (flyover → settle jumps) it is reset to the
   * estimated translateY from ViewportCoordinator, which is the only fallback
   * available when there are no overlapping DOM nodes to measure.
   *
   * This is the v5.5 fix: using actual measurements eliminates the cumulative
   * error that accumulates when estimated heights diverge from real heights.
   */
  const incrementalTranslateYRef = useRef<number>(0);

  // Stable refs for callbacks (avoid stale closures)
  const onWindowChangeRef = useRef(onWindowChange);
  onWindowChangeRef.current = onWindowChange;

  const docHandleRef = useRef(docHandle);
  docHandleRef.current = docHandle;

  // ── State ─────────────────────────────────────────────────────────────────────
  const [viewportUpdate, setViewportUpdate] = useState<ViewportUpdate | null>(null);

  /**
   * Flips to true once TiptapEditor fires `onEditorReady`.
   * The fetch effect is gated on this flag so we never push content before
   * extensions have finished loading (eliminates the line-156 race condition).
   */
  const [editorReady, setEditorReady] = useState(false);

  // Track the currently loaded block range for edit sync
  const loadedRangeRef = useRef<VisibleRange>({ startBlock: 0, endBlock: 0 });

  // ── ViewportCoordinator ───────────────────────────────────────────────────────

  // Create coordinator when docHandle changes (new document opened)
  useEffect(() => {
    const container = scrollContainerRef.current;
    const viewportHeight = container?.clientHeight ?? 600;

    // Reset incremental tracking state for the new document.
    // loadedRangeRef must also be reset here — if it holds stale values
    // from the previous document, the first fetchAndLoad may incorrectly
    // compute isDownward/hasOverlap/isFirstLoad and skip the fallback.
    incrementalTranslateYRef.current = 0;
    loadedRangeRef.current = { startBlock: 0, endBlock: 0 };

    // Reset anchor to top for the new document.
    if (editorAnchorRef.current) {
      editorAnchorRef.current.style.top = '0px';
    }

    const coordinator = new ViewportCoordinator(
      docHandle.blocks,
      viewportHeight,
      (update) => setViewportUpdate(update),
    );

    coordinatorRef.current = coordinator;

    // Emit initial update synchronously so we know the first block range.
    // The fetch effect is gated on editorReady, so this will only actually
    // fetch once the editor signals it's ready.
    const initial = coordinator.initialUpdate();
    setViewportUpdate(initial);

    console.log(
      `[DEBUG] [PW] Coordinator created | docId=${docHandle.docId} blocks=${docHandle.blocks.length}` +
      ` totalHeight=${coordinator.totalHeight.toFixed(0)} initial=[${initial.startBlock},${initial.endBlock}]` +
      ` estTranslateY=${initial.translateY.toFixed(0)}`,
    );

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
    // Gate: don't fetch until the editor has finished loading extensions.
    // viewportUpdate may already be set (from initialUpdate) but we hold off
    // until TiptapEditor fires onEditorReady. This ensures all extensions are
    // registered before we push the first content.
    if (!viewportUpdate || !editorReady) return;

    const { startBlock, endBlock, mode } = viewportUpdate;

    console.log(
      `[DEBUG] [PW] viewportUpdate | range=[${startBlock},${endBlock}] mode=${mode}` +
      ` estTranslateY=${viewportUpdate.translateY.toFixed(0)} editorReady=${editorReady}`,
    );

    // Don't fetch during flyover — content is outside the loaded buffer.
    // The settle event that fires after scrolling stops will trigger the real fetch.
    if (mode === 'flyover') {
      console.log(`[DEBUG] [PW] SKIP (flyover)`);
      return;
    }

    // Skip fetch when the range exactly matches what's already loaded.
    // This prevents the settle event (which fires after every scroll stop)
    // from triggering a redundant IPC call + setContent when the user hasn't
    // scrolled far enough to need new content.
    //
    // v5.5: do NOT overwrite anchor.style.top with the estimated translateY here.
    // The incremental translateY in incrementalTranslateYRef is the source of truth;
    // writing the estimated value would corrupt the incremental tracker.
    const loaded = loadedRangeRef.current;
    if (startBlock === loaded.startBlock && endBlock === loaded.endBlock) {
      console.log(`[DEBUG] [PW] SKIP (range unchanged [${startBlock},${endBlock}])`);
      return;
    }

    const docId = docHandleRef.current.docId;
    let cancelled = false;

    async function fetchAndLoad(): Promise<void> {
      try {
        const t0 = performance.now();
        console.log(
          `[DEBUG] [PW] fetchAndLoad START | new=[${startBlock},${endBlock}]` +
          ` old=[${loadedRangeRef.current.startBlock},${loadedRangeRef.current.endBlock}]`,
        );

        const blocks = await getBlocks(docId, startBlock, endBlock);
        if (cancelled) return;

        const t1 = performance.now();
        console.log(`[DEBUG] [PW] getBlocks | ${blocks.length} blocks in ${(t1 - t0).toFixed(1)}ms`);

        const markdown = blocks.map((b) => b.markdown).join('\n\n');

        const editor = editorInstanceRef.current;
        const container = scrollContainerRef.current;
        const anchor = editorAnchorRef.current;
        const coordinator = coordinatorRef.current;
        if (!editor || editor.isDestroyed || !container || !anchor || !coordinator) return;

        const oldStart = loadedRangeRef.current.startBlock;
        const oldEnd = loadedRangeRef.current.endBlock;

        const isDownward = startBlock > oldStart;
        const isUpward = startBlock < oldStart;
        const hasOverlap = startBlock < oldEnd && endBlock > oldStart;
        // First load: loadedRangeRef was reset to {0,0} on document change.
        // For the first document (no prior loaded range), old={0,0} and
        // new starts at 0, so hasOverlap will be true when we begin loading.
        // We treat the very first fetch specially so we always go through
        // the non-overlapping path and set up the anchor at block 0.
        const isFirstLoad = oldStart === 0 && oldEnd === 0;

        const scrollTopBefore = container.scrollTop;
        const oldAnchorTop = incrementalTranslateYRef.current;

        console.log(
          `[DEBUG] [PW] pre-mutate | scrollTop=${scrollTopBefore.toFixed(0)}` +
          ` anchorTop=${oldAnchorTop.toFixed(0)} isDownward=${isDownward} isUpward=${isUpward}` +
          ` hasOverlap=${hasOverlap} isFirstLoad=${isFirstLoad}`,
        );

        // ── CASE C: Non-overlapping or first load ──────────────────────────────
        //
        // The new range has no blocks in common with the old range (or this
        // is the very first content fetch). We cannot measure incrementally.
        // Fall back to the coordinator's estimated translateY and reset the
        // incremental tracker to that value. From this point, incremental
        // measurements resume using the reset baseline.
        //
        // This path is taken after flyover → settle jumps (when the user
        // scrolled far enough that the old and new ranges do not overlap).
        // The editor was hidden (opacity 0) during flyover, so the user did
        // not see the old content — no visual discontinuity from using an
        // estimated position.
        if (!hasOverlap || isFirstLoad) {
          const estimatedTranslateY = viewportUpdate!.translateY;
          incrementalTranslateYRef.current = estimatedTranslateY;
          anchor.style.top = `${estimatedTranslateY}px`;
          shiftContentNonUndoable(editor, markdown);

          console.log(
            `[DEBUG] [PW] CASE C (non-overlapping/first) | estTranslateY=${estimatedTranslateY.toFixed(0)}` +
            ` incrementalReset=${estimatedTranslateY.toFixed(0)}`,
          );

          loadedRangeRef.current = { startBlock, endBlock };
          coordinator.setLoadedRange(startBlock, endBlock);

          const t2 = performance.now();
          console.log(`[DEBUG] [PW] fetchAndLoad DONE | total=${(t2 - t0).toFixed(1)}ms`);
          return;
        }

        // ── CASE A & B: Overlapping shift (delta-based, pixel-perfect) ──────────
        //
        // Instead of measuring block heights and trying to compute how far the
        // anchor should move, we:
        //   1. Record the screen Y of the first surviving block BEFORE setContent.
        //   2. Call setContent (DOM changes).
        //   3. Record the same block's screen Y AFTER setContent.
        //   4. Apply -(newY - oldY) to the anchor to cancel the displacement.
        //
        // This is pixel-perfect: it captures ALL sources of movement (margins,
        // padding, block-type differences, collapsed margins) with no estimation.
        //
        // CASE A (downward): surviving block = old children[removeCount] → new children[0]
        // CASE B (upward):   surviving block = old children[0]           → new children[addCount]

        if (isDownward) {
          const removeCount = startBlock - oldStart;
          const editorDom = editor.view.dom;

          // 1. Record surviving block's screen Y BEFORE setContent
          const survivorBefore = editorDom.children[removeCount] as HTMLElement | undefined;
          const oldY = survivorBefore?.getBoundingClientRect().top ?? 0;

          // 2. Replace content (removes blocks from the top of the editor)
          shiftContentNonUndoable(editor, markdown);

          // 3. Record that same block's screen Y AFTER setContent (now at children[0])
          const survivorAfter = editorDom.children[0] as HTMLElement | undefined;
          const newY = survivorAfter?.getBoundingClientRect().top ?? 0;

          // 4. Cancel the displacement: anchor moves by -(newY - oldY)
          const delta = newY - oldY;
          incrementalTranslateYRef.current -= delta;
          anchor.style.top = `${incrementalTranslateYRef.current}px`;

          console.log(
            `[DEBUG] [PW] CASE A (downward) | removing ${removeCount} blocks from top\n` +
            `  oldY=${oldY.toFixed(1)} newY=${newY.toFixed(1)} delta=${delta.toFixed(1)}\n` +
            `  anchorTop: ${oldAnchorTop.toFixed(0)} → ${incrementalTranslateYRef.current.toFixed(0)}`,
          );
        }

        if (isUpward) {
          const addCount = oldStart - startBlock;
          const editorDom = editor.view.dom;

          // 1. Record surviving block's screen Y BEFORE setContent (currently at children[0])
          const survivorBefore = editorDom.children[0] as HTMLElement | undefined;
          const oldY = survivorBefore?.getBoundingClientRect().top ?? 0;

          // 2. Replace content (adds blocks to the top of the editor)
          shiftContentNonUndoable(editor, markdown);

          // 3. Record that same block's screen Y AFTER setContent (now at children[addCount])
          const survivorAfter = editorDom.children[addCount] as HTMLElement | undefined;
          const newY = survivorAfter?.getBoundingClientRect().top ?? 0;

          // 4. Cancel the displacement: anchor moves by -(newY - oldY)
          const delta = newY - oldY;
          incrementalTranslateYRef.current -= delta;
          anchor.style.top = `${incrementalTranslateYRef.current}px`;

          console.log(
            `[DEBUG] [PW] CASE B (upward) | adding ${addCount} blocks to top\n` +
            `  oldY=${oldY.toFixed(1)} newY=${newY.toFixed(1)} delta=${delta.toFixed(1)}\n` +
            `  anchorTop: ${oldAnchorTop.toFixed(0)} → ${incrementalTranslateYRef.current.toFixed(0)}`,
          );
        }

        // Update tracking after all mutations.
        loadedRangeRef.current = { startBlock, endBlock };
        coordinator.setLoadedRange(startBlock, endBlock);

        const t2 = performance.now();
        console.log(
          `[DEBUG] [PW] fetchAndLoad DONE | sync=${(t2 - t1).toFixed(1)}ms total=${(t2 - t0).toFixed(1)}ms`,
        );
      } catch (err) {
        console.error('[ERROR] [PersistentWindow] Failed to fetch blocks:', err);
      }
    }

    fetchAndLoad();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportUpdate, editorReady]);

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
      setEditorReady(true);
      onEditorReady?.(editor);
    },
    [onEditorReady],
  );

  // ── User edit handler ─────────────────────────────────────────────────────────

  const handleChange = useCallback((markdown: string) => {
    onWindowChangeRef.current(markdown, loadedRangeRef.current);
  }, []);

  // ── Computed values ───────────────────────────────────────────────────────────

  const totalHeight = coordinatorRef.current?.totalHeight ?? docHandle.totalEstimatedHeight;
  const scrollMode = viewportUpdate?.mode ?? 'settle';

  // Two modes: 'flyover' (full dim, outside loaded range) or 'pw-settle' (visible).
  // 'skeleton' mode has been removed — the editor is either fully visible or
  // fully hidden. The position-aware logic in ViewportCoordinator handles the
  // transition: smooth scrolling within the buffer never triggers flyover.
  const anchorModeClass = scrollMode === 'flyover' ? 'pw-flyover' : 'pw-settle';

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
        {/* Editor anchor position (top) is managed imperatively via
            editorAnchorRef — not through React state — so that the
            translateY change, content swap, and scrollTop correction
            are always batched into one synchronous block in fetchAndLoad
            (v5.5). The CSS default is top: 0; set explicitly on doc change. */}
        <div
          ref={editorAnchorRef}
          className={`persistent-window__editor-anchor ${anchorModeClass}`}
        >
          {/* externalContentControl disables TiptapEditor's own content sync
              effects and mount-time setContent call. PersistentWindow is the
              sole content owner and sets content via shiftContentNonUndoable
              once the editor signals ready. */}
          <TiptapEditor
            content=""
            onChange={handleChange}
            onEditorReady={handleEditorReady}
            externalContentControl
          />
        </div>
      </div>
    </div>
  );
};

export default PersistentWindow;
