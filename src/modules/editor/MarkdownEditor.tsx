/**
 * MarkdownEditor
 * Full-featured markdown editor with two modes: Edit (Tiptap WYSIWYG) and Source (CodeMirror).
 * Obsidian-style always-auto-save approach with event-based saves.
 *
 * @module MarkdownEditor
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { readFile, writeFile, isTauriContext } from '@core/ipc/commands';
import { listen } from '@tauri-apps/api/event';
import { useEditorStore } from '@core/state/editorStore';
import { useNavigationStore } from '@core/state/navigationStore';
import { useSave } from '@/hooks/useSave';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useFocusSave } from '@/hooks/useFocusSave';
import { OverlayScrollbarsComponent, getScrollbarOptions } from '@core/utils/scrollbar';
import { needsCustomScrollbar } from '@core/utils/platform';
import type { OverlayScrollbarsComponentRef } from 'overlayscrollbars-react';
import type { OverlayScrollbars } from 'overlayscrollbars';
import type { DocumentNode } from '@/types/navigation';
import type { Editor } from '@tiptap/react';
import { EditorToolbar } from './EditorToolbar';
import { TiptapEditor } from './TiptapEditor';
import { SourceView } from './SourceView';
import { FormatToolbar } from './FormatToolbar';
import { DeletedFileModal } from '@components/DeletedFileModal';

interface MarkdownEditorProps {
  node: DocumentNode;
  absolutePath: string;
}

/**
 * Extract title from markdown content (first # heading)
 * Normalizes CRLF to LF to handle Windows line endings
 */
function extractTitleFromContent(content: string): string {
  // Normalize CRLF to LF
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? '';
}

/**
 * Extract node ID (filename) from absolute path
 */
function extractNodeIdFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] ?? '';
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  node,
  absolutePath,
}) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tiptapEditor, setTiptapEditor] = useState<Editor | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  // Internal path state for rename handling (updated on file:renamed without remount)
  const [currentPath, setCurrentPath] = useState(absolutePath);
  // Track whether scroll position has been restored (controls visibility)
  const [isScrollRestored, setIsScrollRestored] = useState(false);
  // Increments on every document switch to force scroll restoration re-runs
  // even when initialScrollPercentage is numerically identical across docs.
  const [restoreToken, setRestoreToken] = useState(0);

  const mode = useEditorStore((s) => s.mode);
  const { updateDocumentState, getDocumentState } = useEditorStore();

  // ── State machine for position restoration ────────────────────────────────
  const editorPhaseRef = useRef<'idle' | 'loading' | 'ready' | 'restoring' | 'active'>('idle');
  const isRestoringRef = useRef(false);

  // FIX 2: Cache the most recently computed scroll percentage here on every
  // scroll event. The mode-switch effect reads this ref instead of querying
  // the old mode's OS instance, which may already be destroyed by the time
  // effects run in production builds.
  const lastScrollPercentageRef = useRef<number>(0);

  // Track previous mode for synchronous scroll state reset
  const prevModeForScrollRef = useRef<'edit' | 'source'>(mode);

  // Synchronous reset: When mode changes, hide content BEFORE first render of new view
  // This prevents the flash where the new view is briefly visible at scrollTop=0
  if (prevModeForScrollRef.current !== mode) {
    if (isScrollRestored) {
      setIsScrollRestored(false);
    }
    prevModeForScrollRef.current = mode;
  }

  // Guard: only save position when active
  const canSavePosition = () => !isRestoringRef.current && editorPhaseRef.current === 'active';

  // Ref to editor container for click-outside detection
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Synchronous flag: document-change effect sets this BEFORE the load effect's
  // setIsLoading(true) can flush.  The scroll-percentage effect checks this ref
  // to avoid setting initialScrollPercentage while content is stale.
  const pendingDocLoadRef = useRef(false);

  // Refs for OverlayScrollbars instances
  const editOsRef = useRef<OverlayScrollbarsComponentRef>(null);
  const sourceOsRef = useRef<OverlayScrollbarsComponentRef>(null);

  // Extended interface with reject for cleanup
  interface ViewportPromise {
    promise: Promise<HTMLElement>;
    resolve: (viewport: HTMLElement) => void;
    reject: (reason?: unknown) => void;
  }

  // Ref-based promise storage (survives re-renders)
  const editViewportRef = useRef<ViewportPromise | null>(null);
  const sourceViewportRef = useRef<ViewportPromise | null>(null);
  const prevModeForPromiseRef = useRef<'edit' | 'source' | null>(null);

  // FIX 1: Viewport buffer refs — always store the latest OS viewport element.
  // These are updated unconditionally in the `initialized` / `destroyed` callbacks
  // so that if the promise is created AFTER `initialized` fires, it can resolve
  // immediately from a buffered viewport rather than waiting forever.
  const editViewportElementRef = useRef<HTMLElement | null>(null);
  const sourceViewportElementRef = useRef<HTMLElement | null>(null);

  // State for synchronous access (scroll tracking)
  const [editOsInstance, setEditOsInstance] = useState<OverlayScrollbars | null>(null);
  const [sourceOsInstance, setSourceOsInstance] = useState<OverlayScrollbars | null>(null);

  const useMacOSScrollbars = needsCustomScrollbar();

  // Create promise only on actual mode change (not re-renders)
  const createViewportPromise = useCallback((forMode: 'edit' | 'source'): Promise<HTMLElement> => {
    let resolve: (viewport: HTMLElement) => void;
    let reject: (reason?: unknown) => void;
    const promise = new Promise<HTMLElement>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const promiseObj = { promise, resolve: resolve!, reject: reject! };

    if (forMode === 'edit') {
      editViewportRef.current = promiseObj;
    } else {
      sourceViewportRef.current = promiseObj;
    }

    // FIX 1: If the viewport is already available (initialized fired before the
    // promise was created), resolve immediately — UNLESS a doc-load is pending.
    // During a doc switch, the buffered viewport is the old document's element and
    // will be detached when React destroys/recreates the OS component. Resolving
    // with it produces scrollableHeight=0 and scrollTop=0.
    const elementRef = forMode === 'edit' ? editViewportElementRef : sourceViewportElementRef;
    if (elementRef.current && !pendingDocLoadRef.current) {
      console.log(`[DEBUG] [MarkdownEditor] ${forMode} viewport already available — resolving immediately`);
      promiseObj.resolve(elementRef.current);
    }

    console.log(`[DEBUG] [MarkdownEditor] ${forMode} viewport promise created`);
    return promise;
  }, []);

  // Get stable promise for current mode - only create if mode changed
  const getStablePromise = useCallback((forMode: 'edit' | 'source'): Promise<HTMLElement> | undefined => {
    if (!useMacOSScrollbars) return undefined;

    const ref = forMode === 'edit' ? editViewportRef : sourceViewportRef;

    // Only create new promise if none exists for this mode
    if (!ref.current) {
      return createViewportPromise(forMode);
    }
    return ref.current.promise;
  }, [useMacOSScrollbars, createViewportPromise]);

  // Compute promises - stable references
  const editOsPromise = mode === 'edit' ? getStablePromise('edit') : undefined;
  const sourceOsPromise = mode === 'source' ? getStablePromise('source') : undefined;

  // Helper to get the actual scrollable viewport (OverlayScrollbars or plain div)
  const getScrollViewport = useCallback((forMode: 'edit' | 'source'): HTMLElement | null => {
    if (useMacOSScrollbars) {
      // OverlayScrollbars: get viewport from OS instance
      const osRef = forMode === 'edit' ? editOsRef : sourceOsRef;
      const instance = osRef.current?.osInstance();
      const viewport = instance?.elements().viewport ?? null;

      console.log('[DEBUG] [MarkdownEditor] getScrollViewport (OverlayScrollbars):', {
        forMode,
        viewport: viewport ? 'found' : 'null',
        scrollHeight: viewport?.scrollHeight,
        clientHeight: viewport?.clientHeight,
      });

      return viewport;
    } else {
      // Plain div: query directly
      const selector = forMode === 'edit' ? '.editor-live-preview' : '.editor-source-view';
      const viewport = document.querySelector<HTMLElement>(selector);

      console.log('[DEBUG] [MarkdownEditor] getScrollViewport (plain div):', {
        forMode,
        selector,
        viewport: viewport ? 'found' : 'null',
        scrollHeight: viewport?.scrollHeight,
      });

      return viewport;
    }
  }, [useMacOSScrollbars]);

  // Stable getter for current content (avoids stale closures in hooks)
  const contentRef = useRef(content);
  contentRef.current = content;
  const getContent = useCallback(() => contentRef.current, []);

  // Stable ref for current path (avoids stale closure in save)
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  // Track path for unmount save - ONLY update after content is loaded
  const unmountPathRef = useRef<string | null>(null);
  const unmountContentRef = useRef<string>('');
  const hasLoadedRef = useRef(false);

  // Track previous node title for title update detection
  const prevNodeTitleRef = useRef<string>(node.title);

  // Universal post-save handler - updates title when changed
  const handleSaveComplete = useCallback(async (savedPath: string, savedContent: string) => {
    const nodeId = extractNodeIdFromPath(savedPath);
    const newTitle = extractTitleFromContent(savedContent);
    const prevTitle = prevNodeTitleRef.current;

    if (newTitle && newTitle !== prevTitle) {
      useNavigationStore.getState().updateNodeTitle(nodeId, newTitle);
      console.log('[INFO] [MarkdownEditor] Title updated:', prevTitle, '->', newTitle);
      prevNodeTitleRef.current = newTitle;
    }
  }, []);

  // useSave with post-save callback for title updates
  const { save, isSaving } = useSave(currentPath, getContent, handleSaveComplete);

  const { flushPendingSave, markClean, isDirty } = useAutoSave(content, save);
  useFocusSave(flushPendingSave, isDirty, editorContainerRef as React.RefObject<HTMLDivElement>);

  // Track previous node ID to detect document changes
  const prevNodeIdRef = useRef<string | null>(null);
  // Track rename to skip save on rename-triggered document switch
  const isRenamingRef = useRef(false);
  // Track previous node for viewport promise cleanup
  const prevNodeIdForPromiseRef = useRef<string | null>(null);


  // Clear viewport promises on document change
  useEffect(() => {
    const prevNodeId = prevNodeIdForPromiseRef.current;

    if (prevNodeId !== null && prevNodeId !== node.id) {
      // Document changed - clear viewport promises (they'll be recreated)
      if (editViewportRef.current) {
        console.log('[DEBUG] [MarkdownEditor] Clearing edit viewport promise (document changed)');
        editViewportRef.current.reject(new Error('Document changed'));
        editViewportRef.current = null;
      }
      if (sourceViewportRef.current) {
        console.log('[DEBUG] [MarkdownEditor] Clearing source viewport promise (document changed)');
        sourceViewportRef.current.reject(new Error('Document changed'));
        sourceViewportRef.current = null;
      }
    }

    prevNodeIdForPromiseRef.current = node.id;
  }, [node.id]);

  // Listen for file:renamed events
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistenPromise = listen<{ old_path: string; new_path: string }>('file:renamed', (event) => {
      const oldNorm = event.payload.old_path.replace(/\\/g, '/').toLowerCase();
      const currentNorm = currentPath.replace(/\\/g, '/').toLowerCase();

      if (oldNorm === currentNorm) {
        console.log('[INFO] [MarkdownEditor] File renamed - updating path silently');
        isRenamingRef.current = true;

        // Update path without triggering reload
        const normalizedNewPath = event.payload.new_path.replace(/\\/g, '/');
        setCurrentPath(normalizedNewPath);
        unmountPathRef.current = normalizedNewPath;

        // Content is unchanged - no need to reload
        console.log('[DEBUG] [MarkdownEditor] Updated path on rename:', oldNorm, '->', normalizedNewPath);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [currentPath]);

  // CRITICAL: Save and reset refs when document changes
  useEffect(() => {
    // If node.id changed, flush pending save and save previous document
    if (prevNodeIdRef.current !== null && prevNodeIdRef.current !== node.id) {
      console.log('[DEBUG] [MarkdownEditor] Document changed, flushing save:', prevNodeIdRef.current);

      // Capture scroll position for the OLD document before switching.
      // Same pattern as the mode-switch capture — uses the ref-cached value
      // because the OS viewport may already be in flux at this point.
      const scrollPercentage = lastScrollPercentageRef.current;
      if (scrollPercentage > 0) {
        updateDocumentState(prevNodeIdRef.current, { scrollPercentage });
        console.log('[DEBUG] [MarkdownEditor] Document switch - saved scroll for old doc:', {
          oldNodeId: prevNodeIdRef.current,
          savedPercentage: scrollPercentage,
        });
      }

      // Signal that content for the new document hasn't loaded yet.
      // This ref is visible to the scroll-percentage effect within the same
      // effects batch, unlike batched state updates (isLoading).
      pendingDocLoadRef.current = true;

      // Increment restore token so child editors always re-run their scroll
      // restoration effect, even if the cached percentage is numerically
      // identical to the previous document.
      setRestoreToken((t) => t + 1);

      // Reset the ref for the incoming document
      lastScrollPercentageRef.current = 0;

      // Skip save if this is a rename (not a user navigation)
      if (isRenamingRef.current) {
        console.log('[INFO] [MarkdownEditor] Skipping save on rename');
        // Just reset refs, don't save
        hasLoadedRef.current = false;
        unmountContentRef.current = '';
        unmountPathRef.current = null;
      } else {
        // Normal document switch - flush pending auto-save (includes title update via callback)
        flushPendingSave();

        // Reset refs for new document
        hasLoadedRef.current = false;
        unmountContentRef.current = '';
        unmountPathRef.current = null;
      }

      // Reset scroll percentage for new document
      setInitialScrollPercentage(null);
    }

    // Update previous node ID and title
    prevNodeIdRef.current = node.id;
    prevNodeTitleRef.current = node.title;
  }, [node.id, flushPendingSave, updateDocumentState]);

  // Keep content ref synced for unmount save (only after THIS document loads)
  useEffect(() => {
    // Only sync if: loaded flag is set AND we're not in loading state AND content is not empty
    if (hasLoadedRef.current && !isLoading && content) {
      unmountContentRef.current = content;
    }
  }, [content, isLoading]);

  // Update path ref AFTER content loads, not on mount
  useEffect(() => {
    if (!isLoading && content) {
      unmountPathRef.current = currentPath;
      hasLoadedRef.current = true;
      console.log('[DEBUG] [MarkdownEditor] Refs updated:', { path: currentPath, contentLen: content.length });
    }
  }, [isLoading, content, currentPath]);

  // Save on unmount only
  useEffect(() => {
    return () => {
      // Only save if we actually loaded content AND have valid refs
      if (hasLoadedRef.current && unmountContentRef.current && unmountPathRef.current) {
        const pathToSave = unmountPathRef.current;
        const contentToSave = unmountContentRef.current;
        const prevTitle = prevNodeTitleRef.current;

        console.log('[DEBUG] [MarkdownEditor] Unmount save:', {
          path: pathToSave,
          contentLen: contentToSave.length
        });

        writeFile(pathToSave, contentToSave)
          .then(() => {
            console.log('[INFO] [MarkdownEditor] Saved on unmount');

            // Update title (same logic as handleSaveComplete)
            const nodeId = extractNodeIdFromPath(pathToSave);
            const newTitle = extractTitleFromContent(contentToSave);
            if (newTitle && newTitle !== prevTitle) {
              useNavigationStore.getState().updateNodeTitle(nodeId, newTitle);
              console.log('[INFO] [MarkdownEditor] Title updated on unmount:', prevTitle, '->', newTitle);
            }
          })
          .catch((err) => console.error('[ERROR] [MarkdownEditor] Save on unmount failed:', err));
      }
    };
  }, []); // Empty deps - runs only on unmount

  // ── Load file on mount / note switch ───────────────────────────────────────
  useEffect(() => {
    // If renaming, don't reload - content is already in editor
    if (isRenamingRef.current) {
      isRenamingRef.current = false;
      pendingDocLoadRef.current = false; // No load needed for rename
      console.log('[INFO] [MarkdownEditor] Skipping reload on rename');
      return;
    }

    let cancelled = false;

    async function load(): Promise<void> {
      setIsLoading(true);
      setLoadError(null);
      setIsDeleted(false);
      setShowDeletedModal(false);

      // Retry logic for file rename transitions (3 attempts, 100ms delay)
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const text = await readFile(absolutePath);  // Use prop, not state

          if (!cancelled) {
            setContent(text);
            setCurrentPath(absolutePath);  // Sync state after successful load
            setIsLoading(false);
            pendingDocLoadRef.current = false; // Content loaded
            markClean(text); // Mark as clean - prevents auto-save
            console.log('[INFO] [MarkdownEditor] Loaded:', node.id);

            // Production path: OS stays mounted across doc switches and
            // `initialized` won't re-fire.  Manually resolve the pending
            // promise from the live instance so TiptapEditor/SourceView can
            // restore scroll with correct content dimensions.
            const activeViewportRef = mode === 'edit' ? editViewportRef : sourceViewportRef;
            const activeOsRef = mode === 'edit' ? editOsRef : sourceOsRef;
            const liveViewport = activeOsRef.current?.osInstance()?.elements().viewport;
            if (liveViewport && activeViewportRef.current) {
              console.log(`[DEBUG] [MarkdownEditor] Resolving ${mode} viewport promise after content load`);
              activeViewportRef.current.resolve(liveViewport);
            }
          }
          return; // Success, exit retry loop
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Failed to load document');

          if (attempt < maxRetries) {
            console.log(`[WARN] [MarkdownEditor] Load attempt ${attempt} failed, retrying...`);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      // All retries failed
      if (!cancelled && lastError) {
        setLoadError(lastError.message);
        console.error('[ERROR] [MarkdownEditor] Load failed after retries:', lastError);
      }

      if (!cancelled) {
        setIsLoading(false);
        pendingDocLoadRef.current = false; // Clear even on error
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [node.id, absolutePath, markClean]);  // Depend on absolutePath

  const handleChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
    },
    []
  );

  // Handle mode changes: reject and clear previous mode's promise
  useEffect(() => {
    const prevMode = prevModeForPromiseRef.current;

    if (prevMode !== null && prevMode !== mode) {
      // Mode actually changed - reject and clear the old mode's promise
      const oldRef = prevMode === 'edit' ? editViewportRef : sourceViewportRef;
      if (oldRef.current) {
        console.log(`[DEBUG] [MarkdownEditor] Rejecting ${prevMode} viewport promise (mode changed)`);
        oldRef.current.reject(new Error('Mode changed'));
        oldRef.current = null;
      }
    }

    prevModeForPromiseRef.current = mode;
  }, [mode]);

  // Track previous mode to detect mode changes
  const prevModeRef = useRef(mode);

  // Capture scroll position BEFORE mode switch
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      // FIX 2: Use the ref-cached scroll percentage instead of querying the
      // OS viewport — in production builds the old OS instance is already
      // destroyed by the time this effect runs, so getScrollViewport returns null.
      const scrollPercentage = lastScrollPercentageRef.current;
      if (scrollPercentage > 0) {
        updateDocumentState(node.id, { scrollPercentage });
        console.log('[DEBUG] [MarkdownEditor] Mode switch - saved scroll (ref cache):', {
          from: prevModeRef.current,
          to: mode,
          savedPercentage: scrollPercentage,
        });
      }
    }
    prevModeRef.current = mode;
  }, [mode, node.id, updateDocumentState]);

  // Track scroll position continuously
  useEffect(() => {
    if (!canSavePosition()) return;

    const viewport = getScrollViewport(mode);
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const scrollableHeight = Math.max(1, scrollHeight - clientHeight);
      const scrollPercentage = Math.min(1, Math.max(0, scrollTop / scrollableHeight));

      // FIX 2: Keep a ref-cached copy so mode-switch capture doesn't need the live viewport.
      lastScrollPercentageRef.current = scrollPercentage;
      updateDocumentState(node.id, { scrollPercentage });
      console.log('[DEBUG] [MarkdownEditor] Scroll tracked:', { scrollTop, percentage: scrollPercentage });
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [mode, node.id, updateDocumentState, getScrollViewport, editOsInstance, sourceOsInstance]);

  // ── Scroll restoration callback ───────────────────────────────────────────
  const handleScrollRestored = useCallback(() => {
    setIsScrollRestored(true);
    isRestoringRef.current = false;
    editorPhaseRef.current = 'active';
    console.log('[INFO] [MarkdownEditor] Scroll restored, position saves enabled');
  }, []);

  // FIX 3: Safety net — if scroll restoration stalls for any reason, force the
  // content visible after 300 ms. This is a defensive fallback that prevents a
  // permanent state lock; the primary mechanism is the promise chain above.
  useEffect(() => {
    if (isScrollRestored) return;
    const timer = setTimeout(() => {
      console.log('[WARN] [MarkdownEditor] Scroll restoration timeout — forcing visible');
      setIsScrollRestored(true);
      isRestoringRef.current = false;
      editorPhaseRef.current = 'active';
    }, 300);
    return () => clearTimeout(timer);
  }, [isScrollRestored]);

  // ── Editor ready handler ───────────────────────────────────────────────────
  const handleEditorReady = useCallback(() => {
    const cached = getDocumentState(node.id);
    if (!cached || cached.scrollPercentage <= 0) {
      // No restoration needed - immediately active
      setIsScrollRestored(true);
      isRestoringRef.current = false;
      editorPhaseRef.current = 'active';
      console.log('[INFO] [MarkdownEditor] No scroll restoration needed');
    } else {
      // Restoration will happen - wait for callback
      isRestoringRef.current = true;
      editorPhaseRef.current = 'restoring';
      console.log('[INFO] [MarkdownEditor] Waiting for scroll restoration');
    }
  }, [node.id, getDocumentState]);

  // Use state for initial scroll percentage (triggers re-render)
  const [initialScrollPercentage, setInitialScrollPercentage] = useState<number | null>(null);

  // When mode changes, compute initial position from cached state
  // CRITICAL: Wait for content to load before setting scroll percentage
  useEffect(() => {
    // Wait for content to load before setting scroll percentage.
    // pendingDocLoadRef bridges the gap where React's batched state updates
    // haven't flushed isLoading=true yet — without it, this effect would
    // run with stale isLoading=false and restore scroll with wrong content.
    if (isLoading || pendingDocLoadRef.current) {
      console.log('[DEBUG] [MarkdownEditor] Deferring scroll percentage (still loading)');
      return;
    }

    editorPhaseRef.current = 'ready';
    setIsScrollRestored(false); // Reset visibility on mode change
    const cached = getDocumentState(node.id);

    if (cached && cached.scrollPercentage > 0) {
      setInitialScrollPercentage(cached.scrollPercentage);
      console.log('[DEBUG] [MarkdownEditor] Initial scroll percentage set:', {
        nodeId: node.id,
        mode,
        cached: cached.scrollPercentage,
        newValue: cached.scrollPercentage,
      });
    } else {
      setInitialScrollPercentage(null);
    }
  }, [mode, node.id, getDocumentState, isLoading]);

  // Note: reloadContent is handled inline in the file:modified event listener below

  // Listen for external file modifications - backend already filtered our own saves
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistenPromise = listen<{ path: string; mtime: number }>('file:modified', async (event) => {
      const normalizedEventPath = event.payload.path.replace(/\\/g, '/').toLowerCase();
      const normalizedCurrentPath = currentPath.replace(/\\/g, '/').toLowerCase();

      if (normalizedEventPath === normalizedCurrentPath) {
        // External modification detected - reload
        console.log('[INFO] [MarkdownEditor] External modification detected - reloading');

        try {
          const diskContent = await readFile(currentPath);
          setContent(diskContent);
          markClean(diskContent);

          // Update title if changed
          const nodeId = extractNodeIdFromPath(currentPath);
          const newTitle = extractTitleFromContent(diskContent);
          const prevTitle = prevNodeTitleRef.current;
          if (newTitle && newTitle !== prevTitle) {
            useNavigationStore.getState().updateNodeTitle(nodeId, newTitle);
            console.log('[INFO] [MarkdownEditor] Title updated from external change:', prevTitle, '->', newTitle);
            prevNodeTitleRef.current = newTitle;
          }

          // Update Tiptap editor if active
          if (tiptapEditor && !tiptapEditor.isDestroyed) {
            const cursorPos = tiptapEditor.state.selection.anchor;
            tiptapEditor.commands.setContent(diskContent);
            const maxPos = tiptapEditor.state.doc.content.size;
            tiptapEditor.commands.setTextSelection(Math.min(cursorPos, maxPos));
          }
        } catch (err) {
          console.error('[ERROR] [MarkdownEditor] Failed to reload:', err);
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [currentPath, markClean, tiptapEditor]);

  // Listen for file deletion events - show immediate restore prompt
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistenPromise = listen<{ path: string; note_id: string }>('file:deleted', (event) => {
      if (event.payload.note_id === node.id) {
        console.log('[INFO] [MarkdownEditor] File deleted on disk:', node.id);
        setIsDeleted(true);
        setShowDeletedModal(true);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [node.id]);

  // Handle deleted file modal actions
  const handleRestore = useCallback(() => {
    setIsDeleted(false);
    setShowDeletedModal(false);
    console.log('[INFO] [MarkdownEditor] File restored:', absolutePath);
  }, [absolutePath]);

  const handleDiscard = useCallback(() => {
    // Return to initial page (no active document)
    useNavigationStore.getState().setActiveNode(null);
    console.log('[INFO] [MarkdownEditor] Deleted file discarded, returning to initial page');
  }, []);

  const osOptions = getScrollbarOptions();

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="editor-container">
        <div className="editor-loading">Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="editor-container">
        <div className="p-4 text-sm text-red-600 dark:text-red-400">
          Error loading document: {loadError}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="editor-container" ref={editorContainerRef}>
        <EditorToolbar
          isSaving={isSaving}
          isDeleted={isDeleted}
        />

        {mode === 'edit' && tiptapEditor && <FormatToolbar editor={tiptapEditor} />}

        {mode === 'edit' && (
          useMacOSScrollbars ? (
            <OverlayScrollbarsComponent
              ref={editOsRef}
              element="div"
              className={`editor-live-preview ${isScrollRestored ? '' : 'scroll-restoring'}`}
              options={osOptions}
              defer
              events={{
                initialized: (instance) => {
                  console.log('[DEBUG] [MarkdownEditor] Edit OS initialized');
                  setEditOsInstance(instance);
                  const viewport = instance.elements().viewport;
                  // FIX 1: Always buffer the viewport element so the promise can
                  // auto-resolve even if it hasn't been created yet.
                  editViewportElementRef.current = viewport;
                  if (viewport && editViewportRef.current) {
                    editViewportRef.current.resolve(viewport);
                  }
                },
                destroyed: () => {
                  console.log('[DEBUG] [MarkdownEditor] Edit OS destroyed');
                  // FIX 1: Clear the buffer so stale viewports don't resolve future promises.
                  editViewportElementRef.current = null;
                  setEditOsInstance(null);
                },
              }}
            >
              <TiptapEditor
                content={content}
                onChange={handleChange}
                onEditorReady={setTiptapEditor}
                onReady={handleEditorReady}
                onScrollRestored={handleScrollRestored}
                initialScrollPercentage={initialScrollPercentage}
                osReadyPromise={editOsPromise}
                restoreToken={restoreToken}
              />
            </OverlayScrollbarsComponent>
          ) : (
            <div className={`editor-live-preview ${isScrollRestored ? '' : 'scroll-restoring'}`}>
              <TiptapEditor
                content={content}
                onChange={handleChange}
                onEditorReady={setTiptapEditor}
                onReady={handleEditorReady}
                onScrollRestored={handleScrollRestored}
                initialScrollPercentage={initialScrollPercentage}
                restoreToken={restoreToken}
              />
            </div>
          )
        )}

        {mode === 'source' && (
          useMacOSScrollbars ? (
            <OverlayScrollbarsComponent
              ref={sourceOsRef}
              element="div"
              className={`editor-source-view ${isScrollRestored ? '' : 'scroll-restoring'}`}
              options={osOptions}
              defer
              events={{
                initialized: (instance) => {
                  console.log('[DEBUG] [MarkdownEditor] Source OS initialized');
                  setSourceOsInstance(instance);
                  const viewport = instance.elements().viewport;
                  // FIX 1: Always buffer the viewport element so the promise can
                  // auto-resolve even if it hasn't been created yet.
                  sourceViewportElementRef.current = viewport;
                  if (viewport && sourceViewportRef.current) {
                    sourceViewportRef.current.resolve(viewport);
                  }
                },
                destroyed: () => {
                  console.log('[DEBUG] [MarkdownEditor] Source OS destroyed');
                  // FIX 1: Clear the buffer so stale viewports don't resolve future promises.
                  sourceViewportElementRef.current = null;
                  setSourceOsInstance(null);
                },
              }}
            >
              <SourceView
                content={content}
                onChange={handleChange}
                nodeId={node.id}
                onReady={handleEditorReady}
                onScrollRestored={handleScrollRestored}
                initialScrollPercentage={initialScrollPercentage}
                osReadyPromise={sourceOsPromise}
                restoreToken={restoreToken}
              />
            </OverlayScrollbarsComponent>
          ) : (
            <div className={`editor-source-view ${isScrollRestored ? '' : 'scroll-restoring'}`}>
              <SourceView
                content={content}
                onChange={handleChange}
                nodeId={node.id}
                onReady={handleEditorReady}
                onScrollRestored={handleScrollRestored}
                initialScrollPercentage={initialScrollPercentage}
                restoreToken={restoreToken}
              />
            </div>
          )
        )}
      </div>

      {/* Deleted file modal */}
      {showDeletedModal && (
        <DeletedFileModal
          absolutePath={absolutePath}
          content={content}
          onRestore={handleRestore}
          onDiscard={handleDiscard}
        />
      )}
    </>
  );
};

export default MarkdownEditor;
