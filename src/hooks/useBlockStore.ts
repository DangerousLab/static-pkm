/**
 * useBlockStore hook
 *
 * Manages the lifecycle of a document in the Rust block store.
 * Documents are closed automatically when the path changes or on unmount.
 *
 * @module useBlockStore
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { openDocument, closeDocument } from '@core/ipc/blockstore';
import type { DocumentHandle, BlockMeta } from '@/types/blockstore';
import type { NodeManifest, HeightCacheEntry } from '@/types/layout';
import { computeAll, applyDomCorrection, initLayoutDictator } from '@core/layout/layoutDictator';
import { setCurrentNoteContext, clearCurrentManifests } from '@core/layout/dictatorCoordinator';
import { getCachedGeometry } from '@hooks/useLayoutEngine';
import { invoke } from '@tauri-apps/api/core';
import { isTauriContext } from '@core/ipc/commands';

interface UseBlockStoreResult {
  /** Full document metadata (block count, estimated heights) after loading. */
  docHandle: DocumentHandle | null;
  isLoading: boolean;
  error: string | null;
  /** Imperatively close the document (e.g. before switching to source mode). */
  closeDoc: () => Promise<void>;
}

// Convert backend BlockMeta to Dictator NodeManifest
function blockMetaToManifest(block: BlockMeta): NodeManifest {
  return {
    nodeId: String(block.id),
    nodeType: block.blockType as any, // Simple cast for now
    textContent: block.textContent || '',
    lineCount: block.lineCount,
    rowCount: block.rowCount || undefined,
    colCount: block.colCount || undefined,
  };
}

/**
 * useBlockStore
 *
 * @param absolutePath - Absolute filesystem path to open. Pass `null` to skip.
 */
export function useBlockStore(absolutePath: string | null): UseBlockStoreResult {
  const [docHandle, setDocHandle] = useState<DocumentHandle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the currently open docId so the cleanup can close it without
  // re-reading potentially stale state.
  const openDocIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!absolutePath) return;

    let cancelled = false;

    async function open(): Promise<void> {
      setIsLoading(true);
      setError(null);
      setDocHandle(null);

      // Ensure Dictator is initialized (idempotent)
      initLayoutDictator();

      try {
        const handle = await openDocument(absolutePath!);
        if (!cancelled) {
          // 1. Get container width
          const containerWidth = getCachedGeometry()?.editorWidth ?? window.innerWidth - 240;

          // 2. Convert to manifests and store in coordinator
          const manifests = handle.blocks.map(b => blockMetaToManifest(b));
          setCurrentNoteContext(handle.docId, manifests);

          // 3. Compute base heights with Dictator
          const heightMap = computeAll(manifests, containerWidth, handle.docId);

          // 4. Try loading cached DOM corrections from SQLite
          if (isTauriContext()) {
            try {
              const cached = await invoke<HeightCacheEntry[]>('get_height_cache', { noteId: handle.docId });
              for (const entry of cached) {
                applyDomCorrection(handle.docId, entry.nodeId, entry.height);
                heightMap.set(entry.nodeId, entry.height);
              }
            } catch (e) {
              console.warn('[WARN] [useBlockStore] Failed to load height cache:', e);
            }
          }

          // 5. Enrich BlockMeta with calculated heights
          for (const block of handle.blocks) {
            block.estimatedHeight = heightMap.get(String(block.id)) ?? 28;
          }

          openDocIdRef.current = handle.docId;
          setDocHandle(handle);
          console.log(
            '[INFO] [useBlockStore] Opened:',
            handle.docId,
            `(${handle.totalBlocks} blocks)`,
          );
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          console.error('[ERROR] [useBlockStore] Failed to open document:', msg);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    open();

    return () => {
      cancelled = true;
      clearCurrentManifests();
      // Close using the ref so we always have the correct docId, even if
      // state hasn't re-rendered yet.
      const docId = openDocIdRef.current;
      if (docId) {
        openDocIdRef.current = null;
        closeDocument(docId).catch((err) => {
          console.warn('[WARN] [useBlockStore] Cleanup close failed:', err);
        });
      }
    };
  }, [absolutePath]);

  const closeDoc = useCallback(async (): Promise<void> => {
    const docId = openDocIdRef.current;
    if (docId) {
      openDocIdRef.current = null;
      await closeDocument(docId);
      setDocHandle(null);
      console.log('[INFO] [useBlockStore] Closed:', docId);
    }
  }, []);

  return { docHandle, isLoading, error, closeDoc };
}
