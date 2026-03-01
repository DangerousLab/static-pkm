/**
 * layoutOracle.ts
 *
 * The Singleton Layout Oracle.
 * 
 * Computes deterministic pixel heights for WYSIWYG blocks before they are 
 * painted, allowing the virtual scroll container to accurately size its 
 * scrollbar and position elements without layout thrashing.
 *
 * Responsibilities:
 * 1. Owns the single off-screen <canvas> used for text measurement.
 * 2. Maintains an in-memory cache of block heights (Map<nodeId, HeightCacheEntry>).
 * 3. Batches actual DOM measurements (ResizeObserver corrections from NodeViews)
 *    and flushes them to the Rust backend (SQLite) to persist across sessions.
 */

import type { NodeManifest, HeightCacheEntry, LayoutOracleConfig } from '../../types/layout';
import { invoke } from '@tauri-apps/api/core';
import { measureNode } from './nodeMeasurers';
import { warmupFonts } from './fontMetricsCache';
import { isTauriContext } from '../ipc/commands';

// ── State ──────────────────────────────────────────────────────────────────────

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

let oracleConfig: LayoutOracleConfig = {
  defaultFont: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  baseFontSize: 16,
  baseLineHeight: 1.75, // Matches CSS --line-height-relaxed
  containerPadding: 16, // Default padding inside the editor container
  codeFont: '"SF Mono", "Fira Code", Consolas, monospace',
  codeLineHeight: 1.5,
  headingScales: [2.0, 1.5, 1.25, 1.0, 0.875, 0.85], // H1-H6 multipliers relative to base
};

/** The single source of truth for heights in the current document. */
const heightCache = new Map<string, HeightCacheEntry>();

/** Batched DOM corrections waiting to be sent to Rust. */
let pendingDomCorrections: HeightCacheEntry[] = [];
let flushTimeoutId: number | null = null;

// ── Initialization ─────────────────────────────────────────────────────────────

/**
 * Initialize the Oracle. Should be called once during app startup.
 */
export function initLayoutOracle(config?: Partial<LayoutOracleConfig>): void {
  if (typeof document === 'undefined') return; // Protect against SSR

  if (config) {
    oracleConfig = { ...oracleConfig, ...config };
  }

  if (!canvas) {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (ctx) {
      // Warm up the font cache with the base UI font to prevent jank on first render
      const fontString = `${oracleConfig.baseFontSize}px ${oracleConfig.defaultFont}`;
      warmupFonts([fontString], ctx);
    }
  }
}

export function updateConfig(partial: Partial<LayoutOracleConfig>): void {
  oracleConfig = { ...oracleConfig, ...partial };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Calculate estimated heights for an entire document manifest.
 * Used when opening a note or when the container width changes (resize).
 *
 * @param manifests The array of blocks parsed by the Rust backend.
 * @param containerWidth The available horizontal space for text wrapping.
 * @returns A Map of nodeId to pixel height.
 */
export function computeAll(manifests: NodeManifest[], containerWidth: number): Map<string, number> {
  if (!ctx) {
    console.warn('[WARN] [LayoutOracle] Canvas context not initialized. Falling back to default block height.');
    const fallbackMap = new Map<string, number>();
    for (const m of manifests) fallbackMap.set(m.nodeId, 28);
    return fallbackMap;
  }

  // Calculate actual width available for text (excluding container padding)
  const textWrapWidth = Math.max(containerWidth - (oracleConfig.containerPadding * 2), 100);

  const result = new Map<string, number>();
  const now = Date.now();

  for (const manifest of manifests) {
    const existing = heightCache.get(manifest.nodeId);
    
    // If we already have a DOM-measured height, DO NOT overwrite it with an estimate.
    // Exception: If the width changed drastically, text might reflow, so we'd invalidate
    // text blocks in `invalidateOracle`, but for now, trust the DOM.
    if (existing && existing.source === 'dom') {
      result.set(manifest.nodeId, existing.height);
      continue;
    }

    // Compute new estimate
    const height = measureNode(manifest, oracleConfig, textWrapWidth, ctx);
    
    heightCache.set(manifest.nodeId, {
      nodeId: manifest.nodeId,
      height,
      source: 'estimated',
      timestamp: now,
    });
    
    result.set(manifest.nodeId, height);
  }

  return result;
}

/**
 * Retrieve the currently cached height for a specific node.
 */
export function getHeight(nodeId: string): number | undefined {
  return heightCache.get(nodeId)?.height;
}

/**
 * Called by TipTap NodeViews (via ResizeObserver) when the actual painted DOM 
 * height differs from the Oracle's estimate.
 * 
 * Updates the in-memory cache and schedules a batched IPC write to SQLite.
 */
export function applyDomCorrection(nodeId: string, height: number): void {
  const current = heightCache.get(nodeId);
  
  // If the height is practically identical, don't thrash the cache
  if (current && Math.abs(current.height - height) < 2.0) {
    return;
  }

  const entry: HeightCacheEntry = {
    nodeId,
    height,
    source: 'dom',
    timestamp: Date.now(),
  };

  // Update memory immediately for Virtual Scroll
  heightCache.set(nodeId, entry);

  // Queue for persistence
  pendingDomCorrections.push(entry);
  scheduleFlush();
}

/**
 * Invalidate estimated heights when the container width changes significantly.
 * DOM measurements for images are preserved (aspect ratio), but text blocks
 * must be re-estimated because they will reflow.
 */
export function invalidateOracle(): void {
  // We don't wipe the cache completely, we selectively downgrade 'dom' entries
  // to 'estimated' (or remove them) so they are recalculated on the next computeAll.
  // In a more complex implementation, we'd only invalidate text-heavy nodes.
  
  for (const [nodeId, entry] of Array.from(heightCache.entries())) {
    // Keep image heights as they scale predictably with width
    if (entry.source === 'dom') {
      // Very naive heuristic: if it's DOM, downgrade it to force re-calc.
      // A more robust system would check the manifest type here.
      heightCache.delete(nodeId); 
    }
  }
}

// ── Internal ───────────────────────────────────────────────────────────────────

/**
 * Debounces and flushes DOM corrections to the Rust backend.
 * Uses a 200ms window to batch rapidly firing ResizeObservers.
 */
function scheduleFlush(): void {
  if (!isTauriContext()) return;
  if (flushTimeoutId !== null) return;

  flushTimeoutId = window.setTimeout(async () => {
    const toFlush = [...pendingDomCorrections];
    pendingDomCorrections = [];
    flushTimeoutId = null;

    if (toFlush.length === 0) return;

    try {
      await invoke('update_height_cache', { entries: toFlush });
    } catch (e) {
      console.error('[ERROR] [LayoutOracle] Failed to persist height corrections:', e);
      // Re-queue on failure
      pendingDomCorrections.push(...toFlush);
    }
  }, 200);
}
