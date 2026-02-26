/**
 * ViewportCoordinator
 *
 * Maps scroll position → block index range, detects scroll velocity, and
 * emits `ViewportUpdate` events consumed by PersistentWindow.
 *
 * This is a plain TypeScript class (no React) that owns no DOM references.
 * PersistentWindow creates one instance and feeds it scroll events.
 *
 * @module ViewportCoordinator
 */

import type { BlockMeta, ScrollMode, ViewportUpdate } from '@/types/blockstore';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Maximum blocks loaded into TipTap at any time. */
const MAX_LOADED_BLOCKS = 200;

/**
 * Buffer loaded above and below the visible area.
 * Reduces visible blank flashes during slow scrolls.
 */
const BUFFER_BLOCKS = 20;

/** Fallback height used when a block's estimated height is 0. */
const DEFAULT_BLOCK_HEIGHT = 24;

// ── Velocity thresholds (px/s) ─────────────────────────────────────────────────
const THRESHOLD_SMOOTH = 500;   // below → 'smooth'
const THRESHOLD_SKELETON = 2000; // below → 'skeleton', above → 'flyover'

/** Debounce (ms) before emitting a 'settle' event after scrolling stops. */
const SETTLE_DEBOUNCE_MS = 150;

/** Number of scroll samples used for rolling velocity average. */
const VELOCITY_HISTORY_SIZE = 5;

// ── Types ──────────────────────────────────────────────────────────────────────

export type ViewportChangeCallback = (update: ViewportUpdate) => void;

// ── ViewportCoordinator ────────────────────────────────────────────────────────

export class ViewportCoordinator {
  /** Per-block estimated heights (refined by DOM measurements). */
  private heights: number[];

  /**
   * Cumulative prefix-sum array.
   * `cumulative[i]` = sum of heights for blocks `[0, i)`.
   * `cumulative[0]` = 0, `cumulative[heights.length]` = total height.
   */
  private cumulative: number[];

  private viewportHeight: number;
  private readonly onChange: ViewportChangeCallback;

  // Velocity tracking
  private lastScrollTop = 0;
  private lastScrollTime = 0;
  private velocityHistory: number[] = [];

  // Settle debounce
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

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
   * Computes the new block range, detects scroll velocity, and emits an update.
   */
  onScroll(scrollTop: number): void {
    const now = performance.now();
    const velocity = this.computeVelocity(scrollTop, now);
    const mode = this.classifyVelocity(velocity);

    this.lastScrollTop = scrollTop;
    this.lastScrollTime = now;

    const { startBlock, endBlock, translateY } = this.computeBlockRange(scrollTop);
    this.onChange({ startBlock, endBlock, mode, translateY });

    // Schedule settle event after scrolling stops
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
    }
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      const settled = this.computeBlockRange(this.lastScrollTop);
      this.onChange({ ...settled, mode: 'settle' });
    }, SETTLE_DEBOUNCE_MS);
  }

  /**
   * Refine the estimated height of a block from a DOM measurement.
   * Recalculates cumulative heights so scrollbar accuracy improves over time.
   */
  updateBlockHeight(blockId: number, actualHeight: number): void {
    if (blockId < 0 || blockId >= this.heights.length) return;
    this.heights[blockId] = actualHeight;
    this.cumulative = this.computeCumulative(this.heights);
  }

  /**
   * Replace the full block metadata (after a `update_visible_window` result
   * that changed the total block count).
   */
  resetBlocks(blocks: BlockMeta[]): void {
    this.heights = blocks.map((b) => b.estimatedHeight || DEFAULT_BLOCK_HEIGHT);
    this.cumulative = this.computeCumulative(this.heights);
  }

  /** Update after a container resize. */
  setViewportHeight(height: number): void {
    this.viewportHeight = height;
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
   * Compute the initial viewport update at `scrollTop = 0`.
   * Called by PersistentWindow on first render before any scroll events.
   */
  initialUpdate(): ViewportUpdate {
    const { startBlock, endBlock, translateY } = this.computeBlockRange(0);
    return { startBlock, endBlock, mode: 'settle', translateY };
  }

  /** Clean up the settle timer. Call on component unmount. */
  destroy(): void {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private computeBlockRange(scrollTop: number): {
    startBlock: number;
    endBlock: number;
    translateY: number;
  } {
    const totalBlocks = this.heights.length;
    if (totalBlocks === 0) {
      return { startBlock: 0, endBlock: 0, translateY: 0 };
    }

    // Find the first block whose top edge is at or below `scrollTop`
    const firstVisible = this.binarySearchBlock(scrollTop);

    // How many blocks fit in the viewport (minimum 1)
    const blocksPerViewport = Math.max(
      1,
      Math.ceil(this.viewportHeight / DEFAULT_BLOCK_HEIGHT),
    );

    // Extend by buffer on both sides
    const startBlock = Math.max(0, firstVisible - BUFFER_BLOCKS);
    const endBlock = Math.min(
      totalBlocks,
      firstVisible + blocksPerViewport + BUFFER_BLOCKS,
    );

    // Cap total loaded blocks
    const loadedCount = endBlock - startBlock;
    const cappedEnd =
      loadedCount > MAX_LOADED_BLOCKS
        ? startBlock + MAX_LOADED_BLOCKS
        : endBlock;

    const translateY = this.cumulative[startBlock] ?? 0;

    return { startBlock, endBlock: cappedEnd, translateY };
  }

  /**
   * Binary search for the index of the block that contains `scrollTop`.
   *
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

    // `lo` is the last index where cumulative[lo] <= scrollTop
    // That corresponds to block `lo` (blocks[lo]'s top is at cumulative[lo])
    return Math.max(0, Math.min(lo, this.heights.length - 1));
  }

  private computeVelocity(scrollTop: number, now: number): number {
    const dt = now - this.lastScrollTime;
    if (dt <= 0 || this.lastScrollTime === 0) return 0;

    const dy = Math.abs(scrollTop - this.lastScrollTop);
    const velocity = (dy / dt) * 1000; // px/s

    this.velocityHistory.push(velocity);
    if (this.velocityHistory.length > VELOCITY_HISTORY_SIZE) {
      this.velocityHistory.shift();
    }

    // Rolling average
    const avg =
      this.velocityHistory.reduce((a, b) => a + b, 0) / this.velocityHistory.length;
    return avg;
  }

  private classifyVelocity(velocity: number): ScrollMode {
    if (velocity < THRESHOLD_SMOOTH) return 'smooth';
    if (velocity < THRESHOLD_SKELETON) return 'skeleton';
    return 'flyover';
  }

  private computeCumulative(heights: number[]): number[] {
    const cum: number[] = [0];
    for (let i = 0; i < heights.length; i++) {
      cum.push((cum[i] ?? 0) + (heights[i] ?? DEFAULT_BLOCK_HEIGHT));
    }
    return cum;
  }
}
