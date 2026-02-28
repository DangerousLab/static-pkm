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
const MAX_LOADED_BLOCKS = 400;

/**
 * Buffer loaded above and below the visible area.
 * With ~30 visible blocks at DEFAULT_BLOCK_HEIGHT, the loaded window is
 * ~330 blocks (150 + 30 + 150), well within MAX_LOADED_BLOCKS = 400.
 */
const BUFFER_BLOCKS = 30;

/**
 * Hysteresis threshold (blocks).
 *
 * A new range is only emitted when `firstVisible` has moved within
 * HYSTERESIS_BLOCKS of either edge of the currently loaded range.
 *
 * With BUFFER_BLOCKS=150 and HYSTERESIS_BLOCKS=75, the user must scroll
 * through 75 blocks of pre-loaded content before a new fetch is queued.
 * This prevents the oscillation loop:
 *   height mismatch → scroll adjust → new range → fetch → height change → repeat
 *
 * Tunable: increase to reduce fetch frequency (at the cost of a smaller safe zone).
 */
const HYSTERESIS_BLOCKS = 25;

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
const SHIFT_COOLDOWN_MS = 30;

/**
 * Fallback height used when a block's estimated height is 0.
 *
 * v5.3: Updated from 24 to 28 to match the corrected paragraph line-height
 * (CSS --line-height-relaxed: 1.75 × --font-size-base: 16px = 28px).
 * Also used by blocksPerViewport() to estimate how many blocks fill the screen.
 */
const DEFAULT_BLOCK_HEIGHT = 28;

/** Debounce (ms) before emitting a 'settle' event after scrolling stops. */
const SETTLE_DEBOUNCE_MS = 100;

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
  /** The last processed scrollTop, used to calculate scroll distance deltas */
  private lastProcessedScrollTop: number = 0;

  // ── Scroll suppression ─────────────────────────────────────────────────────
  /**
   * Timestamp (ms) until which all `onScroll` events should be discarded.
   *
   * Replaces the old `skipNextScroll` boolean. Modern WebKit/macOS dispatches
   * layout reflow scroll events asynchronously (a frame or two later) rather
   * than strictly synchronously during the DOM mutation. A brief time-based
   * window blinds the coordinator to these micro-adjustments, breaking the
   * endless ±2 block oscillation loop.
   */
  private ignoreScrollUntil = 0;

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
    // Flag the engine as actively scrolling to bypass expensive operations
    // like Shiki AST parsing until the viewport settles.
    (window as any).unstablonScrollState = 'scrolling';
    // Ignore scroll events sparked asynchronously by layout reflows from DOM
    // mutations (surgical shift overlapping insertions/deletions).
    if (Date.now() < this.ignoreScrollUntil) {
      console.log(`[DEBUG] [VC] onScroll IGNORED | scrollTop=${scrollTop.toFixed(0)} | ignoreRemaining=${this.ignoreScrollUntil - Date.now()}ms`);
      return;
    }

    console.log(`[DEBUG] [VC] onScroll ACCEPTED | scrollTop=${scrollTop.toFixed(0)}`);

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
   * Suppress `onScroll` processing for a specific duration.
   *
   * Call this immediately before surgical block range fetching/DOM mutations.
   * It prevents the engine from capturing asynchronous macroscopic reflow `scrollTop`
   * values that immediately bounce the ViewportCoordinator into an opposite
   * surgical shift, preventing endless 'down 2, up 2' loop oscillations.
   */
  suppressScrollFor(ms: number): void {
    this.ignoreScrollUntil = Date.now() + ms;
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
    const scrollDelta = Math.abs(scrollTop - this.lastProcessedScrollTop);
    const mode = this.resolveMode(firstVisible, scrollDelta);
    const shouldEmit = this.shouldEmitRange(firstVisible, startBlock, endBlock);

    if (shouldEmit) {
      this.lastEmittedRange = { startBlock, endBlock };
      this.lastEmitTime = Date.now();
      this.onChange({ startBlock, endBlock, mode, translateY });
    }

    this.lastProcessedScrollTop = scrollTop;

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
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;

      // Deflag the scrolling state so heavy parsers can resume
      (window as any).unstablonScrollState = 'idle';

      const settled = this.computeBlockRange(scrollTop);
      this.lastEmittedRange = {
        startBlock: settled.startBlock,
        endBlock: settled.endBlock,
      };
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
  private resolveMode(firstVisible: number, scrollDelta: number): ScrollMode {
    const { startBlock: loadedStart, endBlock: loadedEnd } = this.loadedRange;
    const blocksPerViewport = this.blocksPerViewport();
    const lastVisible = firstVisible + blocksPerViewport;

    const topMargin = firstVisible - loadedStart;
    const bottomMargin = loadedEnd - lastVisible;
    const totalBlocks = this.heights.length;

    // Treat document boundaries as infinite safe margin
    const effectiveTopMargin = loadedStart === 0 ? Infinity : topMargin;
    const effectiveBottomMargin = loadedEnd >= totalBlocks ? Infinity : bottomMargin;

    // Trigger flyover if ANY margin is completely exhausted (<= 0)
    // The previous hysteresis check (100 blocks) triggers earlier to emit a fetch,
    // but flyover should only clamp down if that fetch fails to arrive before
    // the user outruns the visible buffer.

    // Modification: Flyover mode causes the editor to dim and stops fetching until settle.
    // For momentum trackpad scrolling, we want it to keep fetching ("smooth").
    // We only trigger flyover if this was a massive jump (e.g., scrollbar drag),
    // which we classify as a delta of > 3000px in a single RAF tick.
    const isMassiveJump = scrollDelta > 3000;

    let mode: ScrollMode = 'smooth';
    if ((effectiveTopMargin <= 0 || effectiveBottomMargin <= 0) && isMassiveJump) {
      mode = 'flyover';
    }

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
      return false;
    }

    const { startBlock: loadedStart, endBlock: loadedEnd } = this.loadedRange;

    // Nothing loaded yet — emit immediately
    if (loadedStart === 0 && loadedEnd === 0) {
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
