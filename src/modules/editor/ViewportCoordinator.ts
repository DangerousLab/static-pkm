/**
 * ViewportCoordinator.ts
 *
 * Maps scroll position → block index range and emits `ViewportUpdate` events
 * consumed by PersistentWindow.
 *
 * It uses the Layout Oracle (Phase 2) to accurately compute cumulative heights,
 * removing the need for error-prone DOM height guessing.
 */

import type { BlockMeta, ScrollMode, ViewportUpdate } from '@/types/blockstore';
import { getHeight } from '../../core/layout/layoutOracle';

const MAX_LOADED_BLOCKS = 400;
const BUFFER_BLOCKS = 30;
const DEFAULT_BLOCK_HEIGHT = 28;
const SETTLE_DEBOUNCE_MS = 100;
const HYSTERESIS_BLOCKS = 25;

export type ViewportChangeCallback = (update: ViewportUpdate) => void;

interface BlockRange {
  startBlock: number;
  endBlock: number;
  firstVisible: number;
  translateY: number;
}

export class ViewportCoordinator {
  private blocks: BlockMeta[];
  private cumulative: number[];
  private viewportHeight: number;
  private readonly onChange: ViewportChangeCallback;

  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;
  private pendingScrollTop: number | null = null;
  private lastProcessedScrollTop: number = 0;
  
  /**
   * Timestamp (ms) until which all `onScroll` events should be discarded.
   * Prevents capturing synthetic scroll events triggered by browser layout reflows.
   */
  private ignoreScrollUntil = 0;

  /**
   * Lock prevents any scroll processing while the frontend is waiting for IPC
   * blocks or performing a DOM content swap.
   */
  private isLocked = false;

  private lastEmittedRange = { startBlock: -1, endBlock: -1 };
  private loadedRange = { startBlock: 0, endBlock: 0 };

  constructor(blocks: BlockMeta[], viewportHeight: number, onChange: ViewportChangeCallback) {
    this.blocks = blocks;
    this.cumulative = this.computeCumulative(blocks);
    this.viewportHeight = viewportHeight;
    this.onChange = onChange;
  }

  onScroll(scrollTop: number): void {
    // Flag the engine as actively scrolling to bypass expensive operations
    (window as any).unstablonScrollState = 'scrolling';

    // Ignore scroll events during active fetches or suppression windows
    if (this.isLocked || Date.now() < this.ignoreScrollUntil) {
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

  resetBlocks(blocks: BlockMeta[]): void {
    this.blocks = blocks;
    this.cumulative = this.computeCumulative(blocks);
  }

  setViewportHeight(height: number): void {
    this.viewportHeight = height;
  }

  setLoadedRange(startBlock: number, endBlock: number): void {
    this.loadedRange = { startBlock, endBlock };
  }

  /**
   * Suppress `onScroll` processing for a specific duration.
   * Prevents capturing synthetic browser scroll events during surgical DOM shifts.
   */
  suppressScrollFor(ms: number): void {
    this.ignoreScrollUntil = Date.now() + ms;
  }

  setLock(locked: boolean): void {
    this.isLocked = locked;
  }

  get totalHeight(): number {
    return this.cumulative[this.cumulative.length - 1] ?? 0;
  }

  get blockCount(): number {
    return this.blocks.length;
  }

  getCumulativeHeight(blockIndex: number): number {
    if (blockIndex <= 0) return 0;
    if (blockIndex >= this.cumulative.length) return this.cumulative[this.cumulative.length - 1] ?? 0;
    return this.cumulative[blockIndex] ?? 0;
  }

  initialUpdate(): ViewportUpdate {
    const { startBlock, endBlock, translateY } = this.computeBlockRange(0);
    this.lastEmittedRange = { startBlock, endBlock };
    return { startBlock, endBlock, mode: 'settle', translateY };
  }

  destroy(): void {
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

    private processScroll(scrollTop: number): void {
      const { startBlock, endBlock, firstVisible, translateY } =
        this.computeBlockRange(scrollTop);
  
      const scrollDelta = Math.abs(scrollTop - this.lastProcessedScrollTop);
      const mode = this.resolveMode(firstVisible, scrollDelta);
      const shouldEmit = this.shouldEmitRange(firstVisible, startBlock, endBlock);
  
      if (shouldEmit) {
        console.log(`[TELEMETRY] [VC] EMIT | scrollTop=${scrollTop.toFixed(2)} firstVisible=${firstVisible} range=[${startBlock},${endBlock}] translateY=${translateY} mode=${mode}`);
        this.lastEmittedRange = { startBlock, endBlock };
        this.onChange({ startBlock, endBlock, mode, translateY });
      }
  
      this.lastProcessedScrollTop = scrollTop;
      this.scheduleSettle(scrollTop);
    }
  
    private scheduleSettle(scrollTop: number): void {
      if (this.settleTimer !== null) clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(() => {
        this.settleTimer = null;
        (window as any).unstablonScrollState = 'idle';
        const settled = this.computeBlockRange(scrollTop);
        console.log(`[TELEMETRY] [VC] SETTLE | scrollTop=${scrollTop.toFixed(2)} firstVisible=${settled.firstVisible} range=[${settled.startBlock},${settled.endBlock}]`);
        this.lastEmittedRange = { startBlock: settled.startBlock, endBlock: settled.endBlock };
        this.onChange({ ...settled, mode: 'settle' });
      }, SETTLE_DEBOUNCE_MS);
    }

  private resolveMode(firstVisible: number, scrollDelta: number): ScrollMode {
    const { startBlock: loadedStart, endBlock: loadedEnd } = this.loadedRange;
    const blocksPerViewport = this.blocksPerViewport();
    const lastVisible = firstVisible + blocksPerViewport;

    const topMargin = firstVisible - loadedStart;
    const bottomMargin = loadedEnd - lastVisible;
    const totalBlocks = this.blocks.length;

    const effectiveTopMargin = loadedStart === 0 ? Infinity : topMargin;
    const effectiveBottomMargin = loadedEnd >= totalBlocks ? Infinity : bottomMargin;

    if ((effectiveTopMargin <= 0 || effectiveBottomMargin <= 0) && scrollDelta > 3000) {
      return 'flyover';
    }
    return 'smooth';
  }

  private shouldEmitRange(firstVisible: number, newStart: number, newEnd: number): boolean {
    const { startBlock: lastStart, endBlock: lastEnd } = this.lastEmittedRange;
    if (lastStart === -1) return true;
    if (newStart === lastStart && newEnd === lastEnd) return false;

    const { startBlock: loadedStart, endBlock: loadedEnd } = this.loadedRange;
    if (loadedStart === 0 && loadedEnd === 0) return true;

    const topMargin = loadedStart === 0 ? HYSTERESIS_BLOCKS : firstVisible - loadedStart;
    const bottomMargin = loadedEnd >= this.blocks.length ? HYSTERESIS_BLOCKS : loadedEnd - (firstVisible + this.blocksPerViewport());

    return topMargin < HYSTERESIS_BLOCKS || bottomMargin < HYSTERESIS_BLOCKS;
  }

  private computeBlockRange(scrollTop: number): BlockRange {
    if (this.blocks.length === 0) return { startBlock: 0, endBlock: 0, firstVisible: 0, translateY: 0 };
    
    const firstVisible = this.binarySearchBlock(scrollTop);
    const bpv = this.blocksPerViewport();
    const startBlock = Math.max(0, firstVisible - BUFFER_BLOCKS);
    const rawEnd = Math.min(this.blocks.length, firstVisible + bpv + BUFFER_BLOCKS);
    const cappedEnd = rawEnd - startBlock > MAX_LOADED_BLOCKS ? startBlock + MAX_LOADED_BLOCKS : rawEnd;
    const translateY = this.cumulative[startBlock] ?? 0;

    return { startBlock, endBlock: cappedEnd, firstVisible, translateY };
  }

  private blocksPerViewport(): number {
    return Math.max(1, Math.ceil(this.viewportHeight / DEFAULT_BLOCK_HEIGHT));
  }

  private binarySearchBlock(scrollTop: number): number {
    if (this.cumulative.length <= 1) return 0;
    let lo = 0;
    let hi = this.cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.cumulative[mid] ?? 0) <= scrollTop) lo = mid;
      else hi = mid - 1;
    }
    const result = Math.max(0, Math.min(lo, this.blocks.length - 1));
    console.log(`[TELEMETRY] [VC] binarySearch | scrollTop=${scrollTop.toFixed(2)} -> block=${result} (cum[${result}]=${this.cumulative[result]})`);
    return result;
  }

  private computeCumulative(blocks: BlockMeta[]): number[] {
    const cum: number[] = [0];
    for (let i = 0; i < blocks.length; i++) {
      const h = getHeight(String(blocks[i]?.id)) ?? DEFAULT_BLOCK_HEIGHT;
      cum.push((cum[i] ?? 0) + h);
    }
    return cum;
  }
}
