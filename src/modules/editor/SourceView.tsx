/**
 * SourceView
 * CodeMirror 6-based markdown source editor.
 * Uses a purely functional approach with traditional event-based
 * architecture to align with Unstablon's 9-layer model.
 *
 * @module SourceView
 */

import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';

interface SourceViewProps {
  content: string;
  onChange: (content: string) => void;
  nodeId: string;
}

export const SourceView: React.FC<SourceViewProps> = ({
  content,
  onChange,
  nodeId,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Stable refs for callbacks
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Compartments for dynamic configuration
  const themeConfig = useRef(new Compartment());

  // ── Mount / unmount the Editor instance ───────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;

    console.log('[INFO] [SourceView] CodeMirror source editor mounted');

    // Initial state
    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        themeConfig.current.of(oneDark),
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    });

    // Create view
    const view = new EditorView({
      state,
      parent: mountRef.current,
    });

    viewRef.current = view;

    return () => {
      console.log('[INFO] [SourceView] CodeMirror source editor destroyed');
      view.destroy();
      viewRef.current = null;
    };
    // Re-mount when nodeId changes to ensure clean state per document
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  // ── Content sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (view && content !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    }
  }, [content]);

  return (
    <div className="source-view-wrapper scrollable-content">
      <div ref={mountRef} className="source-editor-container" />
    </div>
  );
};

export default SourceView;
