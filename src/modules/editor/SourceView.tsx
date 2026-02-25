/**
 * SourceView
 * Raw markdown source editor using CodeMirror 6.
 * Simplified version with syntax highlighting only - no block widgets.
 *
 * @module SourceView
 */

import { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { foldGutter, foldKeymap } from '@codemirror/language';
import { useEditorStore } from '@core/state/editorStore';
import { unstablonSyntaxHighlighting } from '@/lib/syntax/cmHighlight';
interface SourceViewProps {
  content: string;
  onChange: (content: string) => void;
  nodeId: string;
  onReady?: () => void;
  onScrollRestored?: () => void;
  initialScrollPercentage?: number | null;
  osReadyPromise?: Promise<HTMLElement>;
  /** Incremented on every document switch to force this effect to re-run
   * even when initialScrollPercentage is numerically identical across docs. */
  restoreToken?: number;
}

export const SourceView: React.FC<SourceViewProps> = ({
  content,
  onChange,
  nodeId,
  onReady,
  onScrollRestored,
  initialScrollPercentage,
  osReadyPromise,
  restoreToken,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isExternalUpdateRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onScrollRestoredRef = useRef(onScrollRestored);
  onScrollRestoredRef.current = onScrollRestored;

  const lineNumbersEnabled = useEditorStore((s) => s.lineNumbersEnabled);

  // ── Initialize editor on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        markdown({ codeLanguages: languages }),
        unstablonSyntaxHighlighting,
        lineNumbers(),
        foldGutter(),  // Code folding gutter
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),  // Add fold keymap
        EditorView.updateListener.of((update) => {
          // Save content changes
          if (update.docChanged && !isExternalUpdateRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        // Plain source theme — monospace, syntax highlighting only
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '0.9rem',
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-main)',
            background: 'var(--bg-card)',
          },
          '.cm-scroller': {
            overflow: 'visible',  // Parent handles scroll
            padding: '1.5rem',
            lineHeight: '1.7',
            fontFamily: 'var(--font-mono, monospace)',
          },
          '.cm-content': {
            caretColor: 'var(--text-main)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--font-mono, monospace)',
          },
          '&.cm-focused': { outline: 'none' },
          // Line number gutter styling
          '.cm-gutters': {
            background: 'var(--bg-panel)',
            borderRight: '1px solid var(--border-subtle)',
            minWidth: '3em',
          },
          '.cm-lineNumbers .cm-gutterElement': {
            minWidth: '2.5em',
            textAlign: 'right',
            paddingRight: '0.5em',
            color: 'var(--text-muted)',
            fontSize: '0.8em',
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    console.log('[INFO] [SourceView] CodeMirror source editor mounted');

    // Call onReady callback after mount
    onReady?.();

    return () => {
      view.destroy();
      viewRef.current = null;
      console.log('[INFO] [SourceView] CodeMirror source editor destroyed');
    };
  }, [nodeId, onReady]);

  // Restore scroll position after OverlayScrollbars is ready
  useEffect(() => {
    if (initialScrollPercentage == null || initialScrollPercentage <= 0) {
      // No restoration needed - signal immediately
      onScrollRestoredRef.current?.();
      return;
    }

    let cancelled = false;

    const restoreScroll = async () => {
      let viewport: HTMLElement | null = null;

      if (osReadyPromise) {
        try {
          console.log('[DEBUG] [SourceView] Awaiting viewport ready...');
          viewport = await osReadyPromise;
          console.log('[DEBUG] [SourceView] Viewport ready via promise');
        } catch (err) {
          // Promise rejected (mode changed) - abort but still restore visibility
          console.log('[DEBUG] [SourceView] Viewport promise rejected (mode changed)');
          onScrollRestoredRef.current?.();
          return;
        }
      } else {
        // Non-OverlayScrollbars case - query DOM
        viewport = document.querySelector<HTMLElement>('.editor-source-view');
        console.log('[DEBUG] [SourceView] Viewport from DOM query');
      }

      if (cancelled) return;

      if (viewport) {
        // requestAnimationFrame ensures the browser has laid out new content
        // before we read scrollHeight. Without it, CodeMirror may not have
        // rendered the new document yet, giving scrollableHeight = 0.
        requestAnimationFrame(() => {
          if (cancelled || !viewport.isConnected) {
            onScrollRestoredRef.current?.();
            return;
          }
          const { scrollHeight, clientHeight } = viewport;
          const scrollableHeight = Math.max(0, scrollHeight - clientHeight);
          viewport.scrollTop = scrollableHeight * initialScrollPercentage;
          console.log('[DEBUG] [SourceView] Scroll restored:', {
            initialScrollPercentage,
            scrollableHeight,
            targetScrollTop: viewport.scrollTop,
          });
          onScrollRestoredRef.current?.();
        });
        return; // onScrollRestored called inside rAF
      }
    };

    restoreScroll();

    return () => {
      cancelled = true;
    };
  }, [initialScrollPercentage, osReadyPromise, restoreToken]);

  // ── Sync external content changes ─────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() === content) return;

    isExternalUpdateRef.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
    });
    isExternalUpdateRef.current = false;
  }, [content]);

  // ── Focus on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    const frameId = requestAnimationFrame(() => viewRef.current?.focus());
    return () => cancelAnimationFrame(frameId);
  }, []);

  // ── Toggle line numbers visibility via CSS class ──────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.dom.classList.toggle('hide-line-numbers', !lineNumbersEnabled);
    }
  }, [lineNumbersEnabled]);

  return (
    <div ref={containerRef} className="editor-source-view" aria-label="Raw markdown source" />
  );
};
