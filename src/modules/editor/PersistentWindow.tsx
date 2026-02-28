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
import type { BlockContent, DocumentHandle, ViewportUpdate, VisibleRange } from '@/types/blockstore';
import { getBlocks } from '@core/ipc/blockstore';
import { ViewportCoordinator } from './ViewportCoordinator';
import { TiptapEditor } from './TiptapEditor';
import { parseBlocksToFragment, shiftViewportDown, shiftViewportUp } from './surgicalTransaction';

/**
 * Duration (ms) to suppress `onScroll` processing during and immediately after
 * dispatching structural DOM shifts or re-anchoring the viewport.
 */
const SCROLL_SUPPRESSION_MS = 30;

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

  /**
   * Stores the blocks array from the most recent successful fetch.
   * Used by the boundary-probe logic in CASE A/B to access the removed
   * blocks (which are in the old window but not in the new blocks array).
   * Set after every case (A, B, C) so it's always populated when A/B run.
   */
  const prevBlocksRef = useRef<BlockContent[]>([]);

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

    // Skip fetch when the range exactly matches what's already loaded, UNLESS
    // it's a 'settle' event and we drift too far, we might want to fix it.
    // However, fixing the drift implies the DOM node shifts visual position, which 
    // shouldn't happen while the user is actively viewing. We'll let it drift,
    // and rely on CASE C (mode=settle) to correct it organically, but we shouldn't
    // interrupt an idle view with a jitter.
    const loaded = loadedRangeRef.current;

    // v5.6: If the range is the same BUT it is a 'settle' event, we should verify
    // the drift and gently correct the position using fallback C.
    const estTranslateY = viewportUpdate.translateY;
    const currentAnchorTop = incrementalTranslateYRef.current;
    const drift = Math.abs(currentAnchorTop - estTranslateY);

    // We only trigger a reset (force fallback Case C) if we are in 'settle'
    // mode AND the drift is severe (> 2000px, which is ~1 screen height).
    const needsResync = mode === 'settle' && drift > 2000;

    if (startBlock === loaded.startBlock && endBlock === loaded.endBlock && !needsResync) {
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

        // ── CASE C: Non-overlapping, first load, or severe drift resync ────────
        //
        // The new range has no blocks in common with the old range (or this
        // is the very first content fetch, or the anchor has drifted too far).
        // We cannot measure incrementally. Fall back to the coordinator's
        // estimated translateY and reset the incremental tracker to that value.
        //
        // This path is taken after:
        // 1. flyover → settle jumps
        // 2. forced resyncs when drift > 2000px on a settle event
        if (!hasOverlap || isFirstLoad || needsResync) {
          const estimatedTranslateY = viewportUpdate!.translateY;
          incrementalTranslateYRef.current = estimatedTranslateY;
          anchor.style.top = `${estimatedTranslateY}px`;

          // Suppress macroscopic asynchronous browser scroll events sparked by DOM changes
          coordinator.suppressScrollFor(SCROLL_SUPPRESSION_MS);

          if (!hasOverlap || isFirstLoad) {
            shiftContentNonUndoable(editor, markdown);
          } else {
            // If we're just resyncing but the content overlaps completely,
            // we don't necessarily need to diff the DOM, replacing text is fine,
            // because we're already idle/settled.
            shiftContentNonUndoable(editor, markdown);
          }

          console.log(
            `[DEBUG] [PW] CASE C (reset) | estTranslateY=${estimatedTranslateY.toFixed(0)}` +
            ` incrementalReset=${estimatedTranslateY.toFixed(0)} isFallback=${!hasOverlap || isFirstLoad} isResync=${needsResync}`,
          );

          // Update tracking
          prevBlocksRef.current = blocks;
          loadedRangeRef.current = { startBlock, endBlock };
          coordinator.setLoadedRange(startBlock, endBlock);

          const t2 = performance.now();
          console.log(`[DEBUG] [PW] fetchAndLoad DONE | total=${(t2 - t0).toFixed(1)}ms`);
          return;
        }

        // ── CASE A & B: Overlapping shift (surgical transactions, pixel-perfect) ──
        //
        // Instead of setContent() — which replaces the entire document and forces
        // ProseMirror to diff/rebuild all 300+ nodes — we build targeted transactions
        // that only touch the changed ends. Surviving nodes in the middle keep their
        // existing DOM elements, eliminating the stutter at scroll boundaries.
        //
        // Anchor correction still uses the same delta-based DOM measurement pattern:
        //   1. Record the screen Y of the first surviving block BEFORE the transaction.
        //   2. Dispatch the surgical transaction (DOM changes only at the edges).
        //   3. Record the same block's screen Y AFTER the transaction.
        //   4. Apply -(newY - oldY) to the anchor to cancel the displacement.
        //
        // CASE A (downward): surviving block = old children[removeCount] → new children[0]
        // CASE B (upward):   surviving block = old children[0]           → new children[addCount]
        //
        // Safety valve: if the block-to-node assumption is violated or parsing
        // fails, catch the error and fall back to shiftContentNonUndoable().

        if (isDownward) {
          const addedBlocks = blocks.filter((b) => b.id >= oldEnd);
          const editorDom = editor.view.dom;

          try {
            // Parse added blocks (needed for the surgical insert).
            const ta0 = performance.now();
            const addedFragment = parseBlocksToFragment(editor, addedBlocks);
            const ta1 = performance.now();

            // Boundary-probe: compute removeNodeCount without parsing the full
            // new window. Removed blocks are in the PREVIOUS fetch (prevBlocksRef),
            // not in the current blocks array. We parse [removed + firstSurvivor]
            // together to correctly handle any boundary merge (e.g. two adjacent
            // list blocks forming one <ul> in the old doc), then subtract
            // firstSurvivor's standalone count to isolate the removed portion.
            //
            // combinedFragment.childCount - firstSurvivorAlone.childCount
            //   = nodes contributed by the removed blocks in the boundary context
            //   = number of nodes to delete from the top of the old doc.
            //
            // Fallback to full-window parse if prevBlocksRef is empty (shouldn't
            // happen: CASE A/B only run when there is overlap, meaning a previous
            // fetch already populated prevBlocksRef).
            const currentNodeCount = editor.state.doc.content.childCount;
            let removeNodeCount: number;

            const tp0 = performance.now();
            const removedBlocks = prevBlocksRef.current.filter((b) => b.id < startBlock);
            const firstSurvivor = blocks[0];

            if (removedBlocks.length === 0 || !firstSurvivor) {
              // Fallback: full-window parse (original approach)
              const fullNewFragment = parseBlocksToFragment(editor, blocks);
              removeNodeCount = currentNodeCount
                - (fullNewFragment.childCount - addedFragment.childCount);
            } else {
              const combinedFragment = parseBlocksToFragment(editor, [...removedBlocks, firstSurvivor]);
              const firstSurvivorAlone = parseBlocksToFragment(editor, [firstSurvivor]);
              removeNodeCount = combinedFragment.childCount - firstSurvivorAlone.childCount;
            }
            const tp1 = performance.now();

            if (removeNodeCount < 0 || removeNodeCount > currentNodeCount) {
              throw new Error(
                `invalid removeNodeCount=${removeNodeCount} (current=${currentNodeCount} added=${addedFragment.childCount})`,
              );
            }

            // 1. Record surviving block's screen Y BEFORE the transaction.
            //    The first surviving node is at PM index removeNodeCount.
            //    getBoundingClientRect() here should not force layout (DOM is untouched).
            const tb0 = performance.now();
            const survivorBefore = editorDom.children[removeNodeCount] as HTMLElement | undefined;
            const oldY = survivorBefore?.getBoundingClientRect().top ?? 0;
            const tb1 = performance.now();

            // 2. Surgical: delete removeNodeCount nodes from top, insert added at bottom
            const ts0 = performance.now();
            const preDispatchScrollTop = container.scrollTop;
            coordinator.suppressScrollFor(SCROLL_SUPPRESSION_MS);
            shiftViewportDown(editor, removeNodeCount, addedFragment);

            // Safari/WebKit aggressively overrides `overflow-anchor: none` during synchronous DOM 
            // mutations, illegally modifying the container's `scrollTop` to maintain the visual offset.
            // If we don't revert it, `newY - oldY` is 0, failing to trigger our own translation compensation,
            // while permanently altering the semantic scroll position (causing oscillation).
            if (container.scrollTop !== preDispatchScrollTop) {
              container.scrollTop = preDispatchScrollTop;
              coordinator.suppressScrollFor(SCROLL_SUPPRESSION_MS); // renew suppression timer
            }
            const ts1 = performance.now();

            // 3. Record that same block's screen Y AFTER the transaction (now at children[0]).
            //    getBoundingClientRect() after a DOM mutation forces a synchronous reflow.
            const survivorAfter = editorDom.children[0] as HTMLElement | undefined;
            const newY = survivorAfter?.getBoundingClientRect().top ?? 0;
            const tb2 = performance.now();

            // 4. Cancel the displacement: anchor moves by -(newY - oldY)
            const delta = newY - oldY;
            incrementalTranslateYRef.current -= delta;
            anchor.style.top = `${incrementalTranslateYRef.current}px`;

            console.log(
              `[DEBUG] [PW] CASE A Math | survivorBefore.top=${oldY.toFixed(2)} survivorAfter.top=${newY.toFixed(2)} ` +
              `delta=${delta.toFixed(2)} anchorNewTop=${incrementalTranslateYRef.current.toFixed(2)} scrollTop=${container.scrollTop.toFixed(2)}`
            );

            console.log(
              `[DEBUG] [PW] CASE A | -${startBlock - oldStart}blk +${addedBlocks.length}blk` +
              ` -${removeNodeCount}nd +${addedFragment.childCount}nd\n` +
              `  addParse=${(ta1 - ta0).toFixed(1)}ms probe=${(tp1 - tp0).toFixed(1)}ms` +
              ` bcrBefore=${(tb1 - tb0).toFixed(1)}ms dispatch=${(ts1 - ts0).toFixed(1)}ms` +
              ` bcrAfter=${(tb2 - ts1).toFixed(1)}ms\n` +
              `  delta=${delta.toFixed(1)} anchor: ${oldAnchorTop.toFixed(0)} → ${incrementalTranslateYRef.current.toFixed(0)}`,
            );
          } catch (err) {
            console.warn('[WARN] [PW] CASE A surgical failed, falling back to setContent:', err);

            // Fallback: full replace — same as old behaviour. Survivor measurement
            // is skipped entirely; the delta correction will see 0 delta here which
            // is acceptable because setContent rebuilds the DOM from scratch.
            const survivorBefore = editorDom.children[0] as HTMLElement | undefined;
            const oldY = survivorBefore?.getBoundingClientRect().top ?? 0;
            coordinator.suppressScrollFor(SCROLL_SUPPRESSION_MS);
            shiftContentNonUndoable(editor, markdown);
            const survivorAfter = editorDom.children[0] as HTMLElement | undefined;
            const newY = survivorAfter?.getBoundingClientRect().top ?? 0;
            const delta = newY - oldY;
            incrementalTranslateYRef.current -= delta;
            anchor.style.top = `${incrementalTranslateYRef.current}px`;
          }
        }

        if (isUpward) {
          const addedBlocks = blocks.filter((b) => b.id < oldStart);
          const editorDom = editor.view.dom;

          try {
            // Parse added blocks (needed for the surgical insert).
            const ta0 = performance.now();
            const addedFragment = parseBlocksToFragment(editor, addedBlocks);
            const ta1 = performance.now();

            // Boundary-probe: same approach as CASE A but mirrored.
            // Removed blocks are at the END of the old window (IDs >= endBlock).
            // We parse [lastSurvivor + removed] to capture the boundary merge,
            // then subtract lastSurvivor's standalone count.
            //
            // lastSurvivor = blocks[blocks.length - 1] (highest ID in new window,
            // which is always a surviving block since it falls in [oldStart, endBlock)).
            const currentNodeCount = editor.state.doc.content.childCount;
            let removeNodeCount: number;

            const tp0 = performance.now();
            const removedBlocks = prevBlocksRef.current.filter((b) => b.id >= endBlock);
            const lastSurvivor = blocks[blocks.length - 1];

            if (removedBlocks.length === 0 || !lastSurvivor) {
              // Fallback: full-window parse (original approach)
              const fullNewFragment = parseBlocksToFragment(editor, blocks);
              removeNodeCount = currentNodeCount
                - (fullNewFragment.childCount - addedFragment.childCount);
            } else {
              const combinedFragment = parseBlocksToFragment(editor, [lastSurvivor, ...removedBlocks]);
              const lastSurvivorAlone = parseBlocksToFragment(editor, [lastSurvivor]);
              removeNodeCount = combinedFragment.childCount - lastSurvivorAlone.childCount;
            }
            const tp1 = performance.now();

            if (removeNodeCount < 0 || removeNodeCount > currentNodeCount) {
              throw new Error(
                `invalid removeNodeCount=${removeNodeCount} (current=${currentNodeCount} added=${addedFragment.childCount})`,
              );
            }

            // 1. Record surviving block's screen Y BEFORE the transaction.
            //    The first surviving node in the old doc is children[0].
            //    getBoundingClientRect() here should not force layout (DOM is untouched).
            const tb0 = performance.now();
            const survivorBefore = editorDom.children[0] as HTMLElement | undefined;
            const oldY = survivorBefore?.getBoundingClientRect().top ?? 0;
            const tb1 = performance.now();

            // 2. Surgical: insert added nodes at top, delete removeNodeCount from bottom
            const ts0 = performance.now();
            const preDispatchScrollTop = container.scrollTop;
            coordinator.suppressScrollFor(SCROLL_SUPPRESSION_MS);
            shiftViewportUp(editor, addedFragment, removeNodeCount);

            // Revert aggressive WebKit scroll anchoring (same as CASE A)
            if (container.scrollTop !== preDispatchScrollTop) {
              container.scrollTop = preDispatchScrollTop;
              coordinator.suppressScrollFor(SCROLL_SUPPRESSION_MS); // renew suppression timer
            }
            const ts1 = performance.now();

            // 3. Record that same block's screen Y AFTER the transaction.
            //    After inserting addedFragment.childCount nodes at the top, the
            //    first surviving node has shifted to children[addedFragment.childCount].
            //    getBoundingClientRect() after a DOM mutation forces a synchronous reflow.
            const survivorAfter = editorDom.children[addedFragment.childCount] as HTMLElement | undefined;
            const newY = survivorAfter?.getBoundingClientRect().top ?? 0;
            const tb2 = performance.now();

            // 4. Cancel the displacement: anchor moves by -(newY - oldY)
            const delta = newY - oldY;
            incrementalTranslateYRef.current -= delta;
            anchor.style.top = `${incrementalTranslateYRef.current}px`;

            console.log(
              `[DEBUG] [PW] CASE B Math | survivorBefore.top=${oldY.toFixed(2)} survivorAfter.top=${newY.toFixed(2)} ` +
              `delta=${delta.toFixed(2)} anchorNewTop=${incrementalTranslateYRef.current.toFixed(2)} scrollTop=${container.scrollTop.toFixed(2)}`
            );

            console.log(
              `[DEBUG] [PW] CASE B | +${addedBlocks.length}blk -${oldEnd - endBlock}blk` +
              ` +${addedFragment.childCount}nd -${removeNodeCount}nd\n` +
              `  addParse=${(ta1 - ta0).toFixed(1)}ms probe=${(tp1 - tp0).toFixed(1)}ms` +
              ` bcrBefore=${(tb1 - tb0).toFixed(1)}ms dispatch=${(ts1 - ts0).toFixed(1)}ms` +
              ` bcrAfter=${(tb2 - ts1).toFixed(1)}ms\n` +
              `  delta=${delta.toFixed(1)} anchor: ${oldAnchorTop.toFixed(0)} → ${incrementalTranslateYRef.current.toFixed(0)}`,
            );
          } catch (err) {
            console.warn('[WARN] [PW] CASE B surgical failed, falling back to setContent:', err);

            const survivorBefore = editorDom.children[0] as HTMLElement | undefined;
            const oldY = survivorBefore?.getBoundingClientRect().top ?? 0;
            coordinator.suppressScrollFor(SCROLL_SUPPRESSION_MS);
            shiftContentNonUndoable(editor, markdown);
            const survivorAfter = editorDom.children[0] as HTMLElement | undefined;
            const newY = survivorAfter?.getBoundingClientRect().top ?? 0;
            const delta = newY - oldY;
            incrementalTranslateYRef.current -= delta;
            anchor.style.top = `${incrementalTranslateYRef.current}px`;
          }
        }

        // Update tracking after all mutations.
        prevBlocksRef.current = blocks;
        loadedRangeRef.current = { startBlock, endBlock };
        coordinator.setLoadedRange(startBlock, endBlock);

        const estBase = coordinator.getCumulativeHeight(startBlock);
        const discrepancy = incrementalTranslateYRef.current - estBase;

        const t2 = performance.now();
        console.log(
          `[DEBUG] [PW] fetchAndLoad DONE | sync=${(t2 - t1).toFixed(1)}ms total=${(t2 - t0).toFixed(1)}ms | discrepancy=${discrepancy.toFixed(0)}`,
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

  // ── Debug command ─────────────────────────────────────────────────────────────

  useEffect(() => {
    (window as any).__viewportDebug = () => {
      const coordinator = coordinatorRef.current;
      const loaded = loadedRangeRef.current;
      const actualY = incrementalTranslateYRef.current;
      const estY = coordinator?.getCumulativeHeight(loaded.startBlock) ?? 0;
      const discrepancy = actualY - estY;

      console.log('--- Viewport Debug ---');
      console.log('ScrollTop:', scrollContainerRef.current?.scrollTop);
      console.log('Anchor Actual Y:', actualY);
      console.log('Anchor Est Y:', estY);
      console.log('Discrepancy:', discrepancy);
      console.log('Loaded Range:', loaded);
      console.log('Buffer Update:', viewportUpdate);
    };
    return () => {
      delete (window as any).__viewportDebug;
    };
  }, [viewportUpdate]);

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
