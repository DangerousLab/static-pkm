/**
 * Block store IPC wrappers for the Persistent Window Architecture.
 *
 * All commands invoke the Rust backend via Tauri. These functions are
 * Tauri-only — callers must guard with `isTauriContext()` before use.
 *
 * @module ipc/blockstore
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  BlockContent,
  BlockMeta,
  BlockSearchMatch,
  DocumentHandle,
  WindowUpdateResult,
} from '@/types/blockstore';

// Re-export types callers commonly need alongside these wrappers
export type { DocumentHandle, BlockContent, BlockMeta, BlockSearchMatch, WindowUpdateResult };

// ── Document lifecycle ─────────────────────────────────────────────────────────

/**
 * Open a document: read from disk, scan into blocks, cache in the Rust backend.
 * Returns full block metadata (no content) for scrollbar initialisation.
 */
export async function openDocument(path: string): Promise<DocumentHandle> {
  console.log('[INFO] [IPC/blockstore] openDocument:', path);
  return invoke<DocumentHandle>('open_document', { path });
}

/**
 * Remove a document from the Rust in-memory store.
 * Call before switching documents or switching to source mode.
 */
export async function closeDocument(docId: string): Promise<void> {
  console.log('[INFO] [IPC/blockstore] closeDocument:', docId);
  return invoke<void>('close_document', { docId });
}

// ── Block reads ────────────────────────────────────────────────────────────────

/**
 * Fetch markdown content for blocks `[start, end)`.
 * Typical viewport window: ~200 blocks with a ±20 block buffer.
 */
export async function getBlocks(
  docId: string,
  start: number,
  end: number,
): Promise<BlockContent[]> {
  return invoke<BlockContent[]>('get_blocks', { docId, start, end });
}

// ── Block writes ───────────────────────────────────────────────────────────────

/**
 * Replace the visible block range with a re-scan of `windowMarkdown`.
 *
 * Handles block splits (user added a blank line) and merges (user deleted a
 * blank line) transparently. Returns updated full block metadata so the
 * frontend can recalibrate the synthetic scrollbar.
 */
export async function updateVisibleWindow(
  docId: string,
  startBlock: number,
  endBlock: number,
  windowMarkdown: string,
): Promise<WindowUpdateResult> {
  console.log('[INFO] [IPC/blockstore] updateVisibleWindow:', docId, startBlock, endBlock);
  return invoke<WindowUpdateResult>('update_visible_window', {
    docId,
    startBlock,
    endBlock,
    windowMarkdown,
  });
}

/**
 * Refine the estimated render height of a single block with a DOM measurement.
 * Called by PersistentWindow's ResizeObserver after a block is rendered.
 */
export async function updateBlockHeight(
  docId: string,
  blockId: number,
  height: number,
): Promise<void> {
  return invoke<void>('update_block_height', { docId, blockId, height });
}

// ── Save ───────────────────────────────────────────────────────────────────────

/**
 * Reassemble all blocks and write the document to disk.
 * Skips the write if the document is not dirty.
 */
export async function saveDocument(docId: string): Promise<void> {
  console.log('[INFO] [IPC/blockstore] saveDocument:', docId);
  return invoke<void>('save_document', { docId });
}

// ── Search ─────────────────────────────────────────────────────────────────────

/**
 * Case-insensitive search across all blocks in a document.
 * Returns one match per block (first occurrence only).
 */
export async function searchBlocks(
  docId: string,
  query: string,
): Promise<BlockSearchMatch[]> {
  console.log('[INFO] [IPC/blockstore] searchBlocks:', docId, query);
  return invoke<BlockSearchMatch[]>('search_blocks', { docId, query });
}
