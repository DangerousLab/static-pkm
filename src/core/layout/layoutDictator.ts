/**
 * layoutDictator.ts
 *
 * The Singleton Layout Dictator.
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
 * 4. Injects exact geometric constants into the DOM for CSS to consume.
 */

import type { NodeManifest, HeightCacheEntry, LayoutDictatorConfig } from '../../types/layout';
import { invoke } from '@tauri-apps/api/core';
import { measureNode } from './nodeMeasurers';
import { warmupFonts } from './fontMetricsCache';
import { isTauriContext } from '../ipc/commands';

// ── State ──────────────────────────────────────────────────────────────────────

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

let dictatorConfig: LayoutDictatorConfig = {
  defaultFont: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  codeFont: '"SF Mono", "Fira Code", Consolas, monospace',
  containerPadding: 16,
  
  paragraph: { fontSize: 16, lineHeight: 28, marginTop: 0, marginBottom: 0 },
  heading1: { fontSize: 32, lineHeight: 40, marginTop: 48, marginBottom: 16 },
  heading2: { fontSize: 24, lineHeight: 32, marginTop: 36, marginBottom: 12 },
  heading3: { fontSize: 20, lineHeight: 28, marginTop: 30, marginBottom: 10 },
  heading4: { fontSize: 16, lineHeight: 24, marginTop: 24, marginBottom: 8 },
  heading5: { fontSize: 14, lineHeight: 20, marginTop: 20, marginBottom: 6 },
  heading6: { fontSize: 13.6, lineHeight: 20, marginTop: 20, marginBottom: 6 },
  codeBlock: { fontSize: 14, lineHeight: 24, marginTop: 16, marginBottom: 16, paddingTop: 12, paddingBottom: 12, borderWidth: 1 },
  blockquote: { fontSize: 16, lineHeight: 28, marginTop: 16, marginBottom: 16 },
  list: { fontSize: 16, lineHeight: 28, marginTop: 8, marginBottom: 8 },
  table: { rowHeight: 36, margins: 32 }
};

/** The single source of truth for heights in the current document. */
const heightCache = new Map<string, HeightCacheEntry>();

/** Batched DOM corrections waiting to be sent to Rust. */
let pendingDomCorrections: HeightCacheEntry[] = [];
let flushTimeoutId: number | null = null;

// ── Initialization ─────────────────────────────────────────────────────────────

/**
 * Initialize the Dictator. Should be called once during app startup.
 */
export function initLayoutDictator(config?: Partial<LayoutDictatorConfig>): void {
  if (typeof document === 'undefined') return; // Protect against SSR

  if (config) {
    dictatorConfig = { ...dictatorConfig, ...config };
  }

  injectTypographyVariables(dictatorConfig);

  if (!canvas) {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (ctx) {
      const fontString = `${dictatorConfig.paragraph.fontSize}px ${dictatorConfig.defaultFont}`;
      warmupFonts([fontString], ctx);
    }
  }
}

export function updateConfig(partial: Partial<LayoutDictatorConfig>): void {
  dictatorConfig = { ...dictatorConfig, ...partial };
  injectTypographyVariables(dictatorConfig);
}

function injectTypographyVariables(config: LayoutDictatorConfig) {
  const root = document.documentElement;
  const prefix = '--dictator';
  
  const inject = (key: string, block: any) => {
    if (block.fontSize) root.style.setProperty(`${prefix}-${key}-fs`, `${block.fontSize}px`);
    if (block.lineHeight) root.style.setProperty(`${prefix}-${key}-lh`, `${block.lineHeight}px`);
    if (block.marginTop !== undefined) root.style.setProperty(`${prefix}-${key}-mt`, `${block.marginTop}px`);
    if (block.marginBottom !== undefined) root.style.setProperty(`${prefix}-${key}-mb`, `${block.marginBottom}px`);
    if (block.paddingTop !== undefined) root.style.setProperty(`${prefix}-${key}-pt`, `${block.paddingTop}px`);
    if (block.paddingBottom !== undefined) root.style.setProperty(`${prefix}-${key}-pb`, `${block.paddingBottom}px`);
    if (block.borderWidth !== undefined) root.style.setProperty(`${prefix}-${key}-bw`, `${block.borderWidth}px`);
  };

  inject('p', config.paragraph);
  inject('h1', config.heading1);
  inject('h2', config.heading2);
  inject('h3', config.heading3);
  inject('h4', config.heading4);
  inject('h5', config.heading5);
  inject('h6', config.heading6);
  inject('code', config.codeBlock);
  inject('quote', config.blockquote);
  inject('list', config.list);
  
  console.log('[DEBUG] [LayoutDictator] Geometric constants injected to CSS variables');
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function computeAll(manifests: NodeManifest[], containerWidth: number, noteId: string): Map<string, number> {
  if (!ctx) {
    console.warn('[WARN] [LayoutDictator] Canvas context not initialized.');
    const fallbackMap = new Map<string, number>();
    for (const m of manifests) fallbackMap.set(m.nodeId, 28);
    return fallbackMap;
  }

  const textWrapWidth = Math.max(containerWidth - (dictatorConfig.containerPadding * 2), 100);
  const result = new Map<string, number>();
  const now = Date.now();

  for (let i = 0; i < manifests.length; i++) {
    const manifest = manifests[i];
    if (!manifest) continue;
    
    const existing = heightCache.get(manifest.nodeId);
    
    if (existing && existing.source === 'dom') {
      result.set(manifest.nodeId, existing.height);
      continue;
    }

    // Collapse margin logic: first block in document loses top margin
    let height = measureNode(manifest, dictatorConfig, textWrapWidth, ctx);
    
    // Very naive margin collapse: if it's the very first block, subtract its top margin
    if (i === 0 && manifest.nodeType !== 'frontmatter') {
       if (manifest.nodeType === 'heading') {
          const level = manifest.level || 1;
          const typeKey = `heading${Math.min(Math.max(level, 1), 6)}` as keyof LayoutDictatorConfig;
          height -= (dictatorConfig[typeKey] as any).marginTop;
       } else if (manifest.nodeType === 'paragraph') {
          height -= dictatorConfig.paragraph.marginTop;
       }
    }

    heightCache.set(manifest.nodeId, {
      noteId,
      nodeId: manifest.nodeId,
      height,
      source: 'dictator',
      timestamp: now,
    });
    
    result.set(manifest.nodeId, height);
  }

  return result;
}

export function getHeight(nodeId: string): number | undefined {
  return heightCache.get(nodeId)?.height;
}

export function clearDictatorCache(): void {
  heightCache.clear();
  pendingDomCorrections = [];
  if (flushTimeoutId) {
    window.clearTimeout(flushTimeoutId);
    flushTimeoutId = null;
  }
}

export function applyDomCorrection(noteId: string, nodeId: string, height: number): void {
  const current = heightCache.get(nodeId);
  
  if (current && Math.abs(current.height - height) < 2.0) {
    return;
  }

  const entry: HeightCacheEntry = {
    noteId,
    nodeId,
    height,
    source: 'dom',
    timestamp: Date.now(),
  };

  heightCache.set(nodeId, entry);
  pendingDomCorrections.push(entry);
  scheduleFlush();
}

export function invalidateDictator(): void {
  for (const nodeId of Array.from(heightCache.keys())) {
    heightCache.delete(nodeId); 
  }
}

// ── Internal ───────────────────────────────────────────────────────────────────

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
      console.error('[ERROR] [LayoutDictator] Failed to persist height corrections:', e);
      pendingDomCorrections.push(...toFlush);
    }
  }, 200);
}
