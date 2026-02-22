/**
 * MarkdownEditor
 * Full-featured markdown editor with three modes: Read, Edit (live preview),
 * Source. Handles file loading, saving, and auto-save.
 *
 * @module MarkdownEditor
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import { readFile } from '@core/ipc/commands';
import { useEditorStore } from '@core/state/editorStore';
import type { EditorMode } from '@core/state/editorStore';
import { useSave } from '@/hooks/useSave';
import { useAutoSave } from '@/hooks/useAutoSave';
import { OverlayScrollbarsComponent, getScrollbarOptions, needsCustomScrollbar } from '@/hooks/useCustomScrollbar';
import type { DocumentNode } from '@/types/navigation';
import { EditorToolbar } from './EditorToolbar';
import { ReadView } from './ReadView';
import { EditView } from './EditView';
import { SourceView } from './SourceView';

interface MarkdownEditorProps {
  node: DocumentNode;
  absolutePath: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  node,
  absolutePath,
}) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mode = useEditorStore((s) => s.mode);

  // Stable getter for current content (avoids stale closures in hooks)
  const contentRef = useRef(content);
  contentRef.current = content;
  const getContent = useCallback(() => contentRef.current, []);

  // Stable getter for the CodeMirror EditorView (updated by EditView on mount)
  const getViewRef = useRef<(() => EditorView | null) | null>(null);
  const handleViewReady = useCallback((getter: () => EditorView | null) => {
    getViewRef.current = getter;
  }, []);

  const { save, isSaving, lastSaved, setLastSaved, isDirty, setIsDirty } = useSave(
    node.id,
    absolutePath,
    getContent
  );

  useAutoSave(node.id, absolutePath, getContent, isDirty, setIsDirty, setLastSaved);

  // ── Scroll position preservation ──────────────────────────────────────────

  const readScrollRef = useRef<HTMLDivElement | null>(null);
  const sourceScrollRef = useRef<HTMLTextAreaElement | null>(null);

  /** Fractional scroll position [0–1] captured before the last mode switch. */
  const scrollFractionRef = useRef<number>(0);
  /** Tracks previous mode so useEffect can detect the transition. */
  const prevModeRef = useRef<EditorMode>(mode);

  /**
   * Capture the current fractional scroll position before changing mode.
   * Called by EditorToolbar via onBeforeModeChange — synchronously, before
   * the Zustand setMode() call.
   *
   * On macOS with OverlayScrollbars, the OS viewport element is the actual
   * scroller. We read scrollTop from the OS viewport if available, otherwise
   * fall back to the direct ref element.
   */
  const captureScroll = useCallback(() => {
    const getScrollEl = (el: HTMLElement | null): HTMLElement | null => {
      if (!el) return null;
      // When OS is active the viewport div inside is the real scroller
      const osViewport = el.querySelector('.os-viewport') as HTMLElement | null;
      return osViewport ?? el;
    };

    if (mode === 'read') {
      const el = getScrollEl(readScrollRef.current);
      if (el) {
        const max = el.scrollHeight - el.clientHeight;
        scrollFractionRef.current = max > 0 ? el.scrollTop / max : 0;
      }
    } else if (mode === 'edit') {
      const view = getViewRef.current?.();
      if (view) {
        const el = view.scrollDOM;
        const max = el.scrollHeight - el.clientHeight;
        scrollFractionRef.current = max > 0 ? el.scrollTop / max : 0;
      }
    } else if (mode === 'source') {
      const el = sourceScrollRef.current;
      if (el) {
        const max = el.scrollHeight - el.clientHeight;
        scrollFractionRef.current = max > 0 ? el.scrollTop / max : 0;
      }
    }
  }, [mode]);

  /**
   * Restore scroll to the captured fractional position after the new view mounts.
   * Uses requestAnimationFrame to wait for layout; CM6 needs a double rAF.
   */
  const restoreScroll = useCallback((newMode: EditorMode) => {
    const fraction = scrollFractionRef.current;
    const getScrollEl = (el: HTMLElement | null): HTMLElement | null => {
      if (!el) return null;
      const osViewport = el.querySelector('.os-viewport') as HTMLElement | null;
      return osViewport ?? el;
    };

    requestAnimationFrame(() => {
      if (newMode === 'read') {
        const el = getScrollEl(readScrollRef.current);
        if (el) el.scrollTop = fraction * (el.scrollHeight - el.clientHeight);
      } else if (newMode === 'edit') {
        // CM6 needs an extra frame to finish internal layout
        requestAnimationFrame(() => {
          const view = getViewRef.current?.();
          if (view) {
            const el = view.scrollDOM;
            el.scrollTop = fraction * (el.scrollHeight - el.clientHeight);
          }
        });
      } else if (newMode === 'source') {
        const el = sourceScrollRef.current;
        if (el) el.scrollTop = fraction * (el.scrollHeight - el.clientHeight);
      }
    });
  }, []);

  // Detect mode changes and restore scroll position
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      restoreScroll(mode);
      prevModeRef.current = mode;
    }
  }, [mode, restoreScroll]);

  // ── Load file on mount / note switch ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setIsLoading(true);
      setLoadError(null);

      try {
        const text = await readFile(absolutePath);
        if (!cancelled) {
          setContent(text);
          setIsDirty(false);
          console.log('[INFO] [MarkdownEditor] Loaded:', node.id);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load document';
          setLoadError(msg);
          console.error('[ERROR] [MarkdownEditor] Load failed:', err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [node.id, absolutePath]);

  const handleChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      if (!isDirty) setIsDirty(true);
    },
    [isDirty, setIsDirty]
  );

  const osOptions = getScrollbarOptions();
  const useMacOSScrollbars = needsCustomScrollbar();

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
    <div className="editor-container">
      <EditorToolbar
        isSaving={isSaving}
        lastSaved={lastSaved}
        isDirty={isDirty}
        onSave={save}
        getView={() => getViewRef.current?.() ?? null}
        onBeforeModeChange={captureScroll}
      />

      {mode === 'read' && (
        useMacOSScrollbars ? (
          <OverlayScrollbarsComponent
            element="div"
            className="editor-read-view"
            options={osOptions}
            defer
            ref={(osRef) => {
              // Point readScrollRef at the OS wrapper div for scroll tracking
              if (osRef) {
                const el = osRef.getElement();
                (readScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el as HTMLDivElement;
              }
            }}
          >
            <ReadView content={content} />
          </OverlayScrollbarsComponent>
        ) : (
          <ReadView content={content} scrollRef={readScrollRef} />
        )
      )}

      {mode === 'edit' && (
        <EditView
          content={content}
          onChange={handleChange}
          onViewReady={handleViewReady}
        />
      )}

      {mode === 'source' && (
        useMacOSScrollbars ? (
          <OverlayScrollbarsComponent
            element="div"
            className="editor-source-view"
            options={osOptions}
            defer
          >
            <SourceView content={content} onChange={handleChange} scrollRef={sourceScrollRef} />
          </OverlayScrollbarsComponent>
        ) : (
          <SourceView content={content} onChange={handleChange} scrollRef={sourceScrollRef} />
        )
      )}
    </div>
  );
};

export default MarkdownEditor;
