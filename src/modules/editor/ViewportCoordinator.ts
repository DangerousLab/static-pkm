/**
 * ViewportCoordinator
 *
 * Maps scroll position → block index range and emits `ViewportUpdate` events
 * consumed by PersistentWindow.
 *
 * This is a plain TypeScript class (no React) that owns no DOM references.
 * PersistentWindow creates one instance and feeds it scroll events.
 *
 * Scroll mode is position-based only (no velocity classification):
 *   'smooth'  — visible blocks are within the loaded buffer, no dim needed
 *   'flyover' — visible area is outside the loaded buffer, full dim until fetch
 *   'settle'  — emitted after SETTLE_DEBOUNCE_MS of inactivity, triggers fetch
 *
 * Key design decision: `resolveMode` and `shouldEmitRange` operate on the
 * VISIBLE block index (`firstVisible`), NOT on the buffered range
 * (`startBlock`/`endBlock`). The buffered range always extends ±BUFFER_BLOCKS
 * beyond the visible area, so comparing it against the loaded range will
 * always show a 1-N block overshoot — falsely triggering flyover on every
 * single scroll tick. Using `firstVisible` directly avoids this.
 *
 * @module ViewportCoordinator
 */

import type { BlockMeta, ScrollMode, ViewportUpdate } from '@/types/blockstore';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Maximum blocks loaded into TipTap at any time. */
const MAX_LOADED_BLOCKS = 300;

/**
 * Buffer loaded above and below the visible area.
 * With ~30 visible blocks at DEFAULT_BLOCK_HEIGHT, the loaded window is
 * ~230 blocks (100 + 30 + 100), well within MAX_LOADED_BLOCKS = 300.
 */
const BUFFER_BLOCKS = 100;

/**
 * Hysteresis threshold (blocks).
 *
 * A new range is only emitted when `firstVisible` has moved within
 * HYSTERESIS_BLOCKS of either edge of the currently loaded range.
 *
 * With BUFFER_BLOCKS=100 and HYSTERESIS_BLOCKS=40, the user must scroll
 * through 60 blocks of pre-loaded content before a new fetch is queued.
 * This prevents the oscillation loop:
 *   height mismatch → scroll adjust → new range → fetch → height change → repeat
 *
 * Tunable: increase to reduce fetch frequency (at the cost of a smaller safe zone).
 */
const HYSTERESIS_BLOCKS = 40;

/**
 * Cooldown (ms) after emitting a range shift.
 *
 * During this window, `shouldEmitRange` returns false regardless of margin.
 * This breaks the cascade:
 *   shift → content replaced → DOM heights differ from estimates →
 *   scrollTop drifts → new emission → new fetch → repeat
 *
 * The cooldown gives the browser one reflow cycle to settle after a content
 * replacement before we consider another shift. Settle events (fired after
 * SETTLE_DEBOUNCE_MS of no scrolling) bypass this — they have their own path
 * and PersistentWindow skips the fetch if the range already matches.
 *
 * Tunable: increase if rubber-banding persists, decrease if fetches feel sluggish.
 */
const SHIFT_COOLDOWN_MS = 500;

/**
 * Fallback height used when a block's estimated height is 0.
 *
 * v5.3: Updated from 24 to 28 to match the corrected paragraph line-height
 * (CSS --line-height-relaxed: 1.75 × --font-size-base: 16px = 28px).
 * Also used by blocksPerViewport() to estimate how many blocks fill the screen.
 */
const DEFAULT_BLOCK_HEIGHT = 28;

/** Debounce (ms) before emitting a 'settle' event after scrolling stops. */
const SETTLE_DEBOUNCE_MS = 200;

// ── Types ──────────────────────────────────────────────────────────────────────

export type ViewportChangeCallback = (update: ViewportUpdate) => void;

/** Internal result of computeBlockRange — includes firstVisible for mode decisions. */
interface BlockRange {
  startBlock: number;
  endBlock: number;
  firstVisible: number;
  translateY: number;
}

// ── ViewportCoordinator ────────────────────────────────────────────────────────

export class ViewportCoordinator {
  /** Per-block estimated heights (from backend scanner). */
  private heights: number[];

  /**
   * Cumulative prefix-sum array.
   * `cumulative[i]` = sum of heights for blocks `[0, i)`.
   * `cumulative[0]` = 0, `cumulative[heights.length]` = total height.
   */
  private cumulative: number[];

  private viewportHeight: number;
  private readonly onChange: ViewportChangeCallback;

  // ── Settle debounce ────────────────────────────────────────────────────────
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  // ── RAF throttle ──────────────────────────────────────────────────────────
  /** Non-null while a requestAnimationFrame is scheduled. */
  private rafId: number | null = null;
  /** Most recent scrollTop received — processed on the next RAF tick. */
  private pendingScrollTop: number | null = null;

  // ── Scroll suppression ─────────────────────────────────────────────────────
  /**
   * When true, the next `onScroll` call is a no-op.
   *
   * Set by `suppressNextScroll()` before PersistentWindow applies a corrective
   * `scrollTop` write (step 4 of the synchronous correction pattern). Without
   * suppression, the corrective write would fire a scroll event that causes
   * the coordinator to recompute its range — potentially triggering another
   * fetch cycle and cascading rubber-banding.
   */
  private skipNextScroll = false;

  // ── Range tracking ─────────────────────────────────────────────────────────
  /**
   * The last buffered range emitted via onChange.
   * Initialized to { -1, -1 } so the first call always emits.
   */
  private lastEmittedRange: { startBlock: number; endBlock: number } = {
    startBlock: -1,
    endBlock: -1,
  };

  /**
   * Timestamp (ms) of the most recent range emission.
   * Used by the shift cooldown to suppress cascading re-emissions while
   * the DOM settles after a content replacement.
   */
  private lastEmitTime = 0;

  /**
   * Block range currently loaded in TipTap.
   * Updated by PersistentWindow after every successful `getBlocks()` call.
   * Used by `resolveMode()` and `shouldEmitRange()` to check whether the
   * visible blocks are within the pre-fetched buffer.
   */
  private loadedRange: { startBlock: number; endBlock: number } = {
    startBlock: 0,
    endBlock: 0,
  };

  // ── Constructor ──────────────────────────────────────────────────────────────

  constructor(
    blocks: BlockMeta[],
    viewportHeight: number,
    onChange: ViewportChangeCallback,
  ) {
    this.heights = blocks.map((b) => b.estimatedHeight || DEFAULT_BLOCK_HEIGHT);
    this.cumulative = this.computeCumulative(this.heights);
    this.viewportHeight = viewportHeight;
    this.onChange = onChange;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Call this on every scroll event from the PersistentWindow container.
   *
   * Uses requestAnimationFrame to throttle processing to ~60fps regardless
   * of how frequently the browser fires scroll events (trackpad can fire
   * hundreds per second). Only the most recent scrollTop is processed per
   * animation frame.
   */
  onScroll(scrollTop: number): void {
    // Ignore the scroll event triggered by PersistentWindow's corrective
    // scrollTop write (step 4 of the synchronous correction pattern).
    if (this.skipNextScroll) {
      this.skipNextScroll = false;
      console.log(`[DEBUG] [VC] onScroll SUPPRESSED | scrollTop=${scrollTop.toFixed(0)}`);
      return;
    }

    this.pendingScrollTop = scrollTop;

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        if (this.pendingScrollTop !== null) {
          this.processScroll(this.pendingScrollTop);
          this.pendingScrollTop = null;
        }
      });
    }
  }

  /**
   * Replace the full block metadata (e.g. after `update_visible_window`
   * changed the total block count).
   */
  resetBlocks(blocks: BlockMeta[]): void {
    this.heights = blocks.map((b) => b.estimatedHeight || DEFAULT_BLOCK_HEIGHT);
    this.cumulative = this.computeCumulative(this.heights);
  }

  /** Update after a container resize. */
  setViewportHeight(height: number): void {
    this.viewportHeight = height;
  }

  /**
   * Notify the coordinator which block range is currently loaded in TipTap.
   *
   * Called by PersistentWindow after every successful `getBlocks()` IPC call.
   * The coordinator uses `firstVisible` relative to this range to:
   *   - Suppress dimming when the visible area is within the loaded buffer.
   *   - Apply hysteresis — only emit a new range when `firstVisible` approaches
   *     within HYSTERESIS_BLOCKS of a loaded-range edge.
   */
  setLoadedRange(startBlock: number, endBlock: number): void {
    this.loadedRange = { startBlock, endBlock };
  }

  /** Total scrollable height in pixels (for the spacer div). */
  get totalHeight(): number {
    return this.cumulative[this.cumulative.length - 1] ?? 0;
  }

  /** Number of blocks tracked. */
  get blockCount(): number {
    return this.heights.length;
  }

  /**
   * Return the cumulative pixel offset at `blockIndex`.
   *
   * `getCumulativeHeight(i)` = sum of estimated heights for blocks `[0, i)`.
   * Used by PersistentWindow to compute the estimated height of a block range
   * for scroll correction:
   *
   *   estimatedHeight(a, b) = getCumulativeHeight(b) - getCumulativeHeight(a)
   */
  getCumulativeHeight(blockIndex: number): number {
    if (blockIndex <= 0) return 0;
    if (blockIndex >= this.cumulative.length) {
      return this.cumulative[this.cumulative.length - 1] ?? 0;
    }
    return this.cumulative[blockIndex] ?? 0;
  }

  /**
   * Suppress the next `onScroll` call.
   *
   * Call this immediately before a corrective `scrollTop` write so the
   * resulting scroll event is not treated as a new user gesture. Without
   * suppression the corrective write cascades into another range computation
   * and potential fetch cycle.
   */
  suppressNextScroll(): void {
    this.skipNextScroll = true;
  }

  /**
   * Compute the initial viewport update at `scrollTop = 0`.
   * Called by PersistentWindow on first render before any scroll events.
   */
  initialUpdate(): ViewportUpdate {
    const { startBlock, endBlock, translateY } = this.computeBlockRange(0);
    this.lastEmittedRange = { startBlock, endBlock };
    return { startBlock, endBlock, mode: 'settle', translateY };
  }

  /** Clean up timers and pending animation frames. Call on component unmount. */
  destroy(): void {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Core scroll processing — called once per animation frame.
   *
   * Computes the needed block range, uses `firstVisible` (not the buffered
   * range) for mode resolution and hysteresis, and emits only when needed.
   */
  private processScroll(scrollTop: number): void {
    const { startBlock, endBlock, firstVisible, translateY } =
      this.computeBlockRange(scrollTop);

    // Mode and hysteresis both use firstVisible — the actual block at the
    // top of the viewport — not startBlock/endBlock (which include ±buffer).
    const mode = this.resolveMode(firstVisible);
    const shouldEmit = this.shouldEmitRange(firstVisible, startBlock, endBlock);

    console.log(
      `[DEBUG] [VC] processScroll | scrollTop=${scrollTop.toFixed(0)} firstVisible=${firstVisible}` +
      ` range=[${startBlock},${endBlock}] mode=${mode} emit=${shouldEmit} estTranslateY=${translateY.toFixed(0)}`,
    );

    if (shouldEmit) {
      this.lastEmittedRange = { startBlock, endBlock };
      this.lastEmitTime = Date.now();
      this.onChange({ startBlock, endBlock, mode, translateY });
    }

    // Always reset the settle timer so it fires after the user stops scrolling.
    this.scheduleSettle(scrollTop);
  }

  /**
   * Schedule a 'settle' event after SETTLE_DEBOUNCE_MS of no scroll activity.
   *
   * The settle event fires with mode='settle' to signal that scrolling has
   * stopped and PersistentWindow should load the final resting position.
   * PersistentWindow will skip the fetch if the range matches what's loaded.
   */
  private scheduleSettle(scrollTop: number): void {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
    }
    console.log(`[DEBUG] [VC] scheduleSettle | scrollTop=${scrollTop.toFixed(0)} (${SETTLE_DEBOUNCE_MS}ms timer)`);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      const settled = this.computeBlockRange(scrollTop);
      this.lastEmittedRange = {
        startBlock: settled.startBlock,
        endBlock: settled.endBlock,
      };
      console.log(
        `[DEBUG] [VC] SETTLE FIRED | scrollTop=${scrollTop.toFixed(0)}` +
        ` range=[${settled.startBlock},${settled.endBlock}] estTranslateY=${settled.translateY.toFixed(0)}`,
      );
      this.onChange({ ...settled, mode: 'settle' });
    }, SETTLE_DEBOUNCE_MS);
  }

  /**
   * Position-aware scroll mode resolution.
   *
   * Checks whether the VISIBLE AREA [firstVisible, firstVisible + viewport)
   * is fully contained within the currently loaded block range.
   *
   * Using `firstVisible` (not the buffered startBlock/endBlock) is critical:
   * the buffered range always extends ±BUFFER_BLOCKS past the visible area,
   * so it would perpetually overshoot the loaded range by 1-N blocks, causing
   * flyover to trigger on every single scroll tick.
   */
  private resolveMode(firstVisible: number): ScrollMode {
    const { startBlock: loadedStart, endBlock: loadedEnd } = this.loadedRange;
    const blocksPerViewport = this.blocksPerViewport();
    const lastVisible = firstVisible + blocksPerViewport;

    const mode: ScrollMode = (firstVisible >= loadedStart && lastVisible <= loadedEnd) ? 'smooth' : 'flyover';

    console.log(
      `[DEBUG] [VC] resolveMode | visible=[${firstVisible},${lastVisible}] loaded=[${loadedStart},${loadedEnd}] → ${mode}`,
    );

    return mode;
  }

  /**
   * Determine whether a new buffered range should be emitted.
   *
   * Uses `firstVisible` to measure how much buffer remains above and below
   * the visible area. Emits only when buffer is running low (< HYSTERESIS_BLOCKS).
   *
   * Edge clamping: when the loaded range already covers the document start or
   * end, the corresponding margin is treated as safe (= HYSTERESIS_BLOCKS),
   * preventing spurious emissions at document boundaries.
   *
   * Three-layer check:
   *   1. First emission (-1 sentinel) → always emit
   *   2. Buffered range identical to last emitted → skip (RAF dedup)
   *   3. Hysteresis: emit only when firstVisible is close to a loaded range edge
   */
  private shouldEmitRange(
    firstVisible: number,
    newStart: number,
    newEnd: number,
  ): boolean {
    const { startBlock: lastStart, endBlock: lastEnd } = this.lastEmittedRange;

    // First emission — always emit
    if (lastStart === -1) {
      console.log(`[DEBUG] [VC] shouldEmit | FIRST EMISSION`);
      return true;
    }

    // Buffered range is identical — skip (redundant after RAF dedup, but cheap)
    if (newStart === lastStart && newEnd === lastEnd) return false;

    // Shift cooldown: suppress emissions for SHIFT_COOLDOWN_MS after the last
    // emit. Content replacement changes DOM heights which causes scrollTop to
    // drift, which would otherwise trigger another emission — cascading into
    // rubber-banding. The cooldown breaks this loop by waiting for the browser
    // to finish reflowing before we consider another range shift.
    const cooldownRemaining = SHIFT_COOLDOWN_MS - (Date.now() - this.lastEmitTime);
    if (cooldownRemaining > 0) {
      console.log(`[DEBUG] [VC] shouldEmit | COOLDOWN (${cooldownRemaining.toFixed(0)}ms remaining)`);
      return false;
    }

    const { startBlock: loadedStart, endBlock: loadedEnd } = this.loadedRange;

    // Nothing loaded yet — emit immediately
    if (loadedStart === 0 && loadedEnd === 0) {
      console.log(`[DEBUG] [VC] shouldEmit | NOTHING LOADED → emit`);
      return true;
    }

    const totalBlocks = this.heights.length;

    // Buffer above: how many loaded blocks are above firstVisible.
    // If loadedStart === 0, the doc boundary is above — treat as safe.
    const topMargin =
      loadedStart === 0 ? HYSTERESIS_BLOCKS : firstVisible - loadedStart;

    // Buffer below: how many loaded blocks are below the last visible block.
    // If loadedEnd covers the end of the doc, treat as safe.
    const lastVisible = firstVisible + this.blocksPerViewport();
    const bottomMargin =
      loadedEnd >= totalBlocks ? HYSTERESIS_BLOCKS : loadedEnd - lastVisible;

    // Emit when either margin has shrunk below the threshold
    const shouldEmit = topMargin < HYSTERESIS_BLOCKS || bottomMargin < HYSTERESIS_BLOCKS;

    console.log(
      `[DEBUG] [VC] shouldEmit | topMargin=${topMargin} bottomMargin=${bottomMargin}` +
      ` threshold=${HYSTERESIS_BLOCKS} → ${shouldEmit}`,
    );

    return shouldEmit;
  }

  private computeBlockRange(scrollTop: number): BlockRange {
    const totalBlocks = this.heights.length;
    if (totalBlocks === 0) {
      return { startBlock: 0, endBlock: 0, firstVisible: 0, translateY: 0 };
    }

    // The first block whose top edge is at or above scrollTop
    const firstVisible = this.binarySearchBlock(scrollTop);

    const bpv = this.blocksPerViewport();

    // Extend by buffer on both sides
    const startBlock = Math.max(0, firstVisible - BUFFER_BLOCKS);
    const rawEnd = Math.min(totalBlocks, firstVisible + bpv + BUFFER_BLOCKS);

    // Cap total loaded blocks
    const cappedEnd =
      rawEnd - startBlock > MAX_LOADED_BLOCKS
        ? startBlock + MAX_LOADED_BLOCKS
        : rawEnd;

    const translateY = this.cumulative[startBlock] ?? 0;

    return { startBlock, endBlock: cappedEnd, firstVisible, translateY };
  }

  /** How many blocks fit in the current viewport height (minimum 1). */
  private blocksPerViewport(): number {
    return Math.max(1, Math.ceil(this.viewportHeight / DEFAULT_BLOCK_HEIGHT));
  }

  /**
   * Binary search for the index of the block that contains `scrollTop`.
   * Returns `i` such that `cumulative[i] <= scrollTop < cumulative[i+1]`.
   */
  private binarySearchBlock(scrollTop: number): number {
    if (this.cumulative.length <= 1) return 0;

    let lo = 0;
    let hi = this.cumulative.length - 1;

    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.cumulative[mid] ?? 0) <= scrollTop) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    return Math.max(0, Math.min(lo, this.heights.length - 1));
  }

  private computeCumulative(heights: number[]): number[] {
    const cum: number[] = [0];
    for (let i = 0; i < heights.length; i++) {
      cum.push((cum[i] ?? 0) + (heights[i] ?? DEFAULT_BLOCK_HEIGHT));
    }
    return cum;
  }
}
