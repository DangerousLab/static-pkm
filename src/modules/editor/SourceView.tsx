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
}

export const SourceView: React.FC<SourceViewProps> = ({ content, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isExternalUpdateRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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

    console.log('[INFO] [SourceView] CodeMirror source editor mounted (simplified, no block widgets)');

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
