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
import type { DocumentHandle } from '@/types/blockstore';

interface UseBlockStoreResult {
  /** Full document metadata (block count, estimated heights) after loading. */
  docHandle: DocumentHandle | null;
  isLoading: boolean;
  error: string | null;
  /** Imperatively close the document (e.g. before switching to source mode). */
  closeDoc: () => Promise<void>;
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

      try {
        const handle = await openDocument(absolutePath!);
        if (!cancelled) {
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
