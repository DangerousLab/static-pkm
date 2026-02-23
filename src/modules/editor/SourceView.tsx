/**
 * SourceView
 * Raw markdown source editor using CodeMirror 6.
 * Unlike EditView, this shows plain source with no live preview.
 *
 * @module SourceView
 */

import { useEffect, useRef } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { useEditorStore } from '@core/state/editorStore';

interface SourceViewProps {
  content: string;
  onChange: (content: string) => void;
  onViewReady?: (getView: () => EditorView | null) => void;
}

export const SourceView: React.FC<SourceViewProps> = ({ content, onChange, onViewReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isExternalUpdateRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const mode = useEditorStore((s) => s.mode);

  // ── Initialize editor on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        markdown(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalUpdateRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        // Plain source theme — monospace, no live preview
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
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    // Expose the view getter to the parent for scroll tracking
    if (onViewReady) {
      onViewReady(() => viewRef.current);
    }

    console.log('[INFO] [SourceView] CodeMirror source editor mounted');

    return () => {
      view.destroy();
      viewRef.current = null;
      console.log('[INFO] [SourceView] CodeMirror source editor destroyed');
    };
  }, []);

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

  // ── Focus when switching into Source mode ─────────────────────────────────
  useEffect(() => {
    if (mode === 'source') {
      let frameId: number;
      const outer = requestAnimationFrame(() => {
        frameId = requestAnimationFrame(() => viewRef.current?.focus());
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(frameId);
      };
    }
  }, [mode]);

  return <div ref={containerRef} className="editor-source-view" aria-label="Raw markdown source" />;
};
