/**
 * EditView — Obsidian-style Live Preview editor
 *
 * Mounts a CodeMirror 6 EditorView with the custom livePreviewPlugin.
 * The active (cursor) line shows raw markdown; all other lines render inline.
 *
 * Exposes a `getView()` callback via the `onViewReady` prop so the parent
 * (MarkdownEditor → EditorToolbar) can issue formatting commands.
 *
 * @module EditView
 */

import { useEffect, useRef } from 'react';
import { EditorView, keymap, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
import { livePreviewPlugin, livePreviewTheme } from './livePreviewPlugin';
import { useEditorStore } from '@core/state/editorStore';

interface EditViewProps {
  /** Current document content (controlled) */
  content: string;
  /** Called whenever the user modifies the document */
  onChange: (content: string) => void;
  /**
   * Called once the EditorView is mounted (and again on re-mount).
   * Passes a stable getter so the toolbar can issue CM6 dispatch() calls.
   */
  onViewReady: (getView: () => EditorView | null) => void;
}

export const EditView: React.FC<EditViewProps> = ({ content, onChange, onViewReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  /** Prevent feedback loop when we push external content into the editor */
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
        // Markdown language (Lezer) — required by livePreviewPlugin for parse tree
        markdown(),
        // Live preview: inactive lines render as HTML widgets
        livePreviewPlugin,
        // Base theme for widget styles
        livePreviewTheme,
        // Undo/redo history
        history(),
        // Highlight the active line
        highlightActiveLine(),
        // Key bindings (default + history)
        keymap.of([...defaultKeymap, ...historyKeymap]),
        // Propagate doc changes up to React
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalUpdateRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        // Editor visual theme — uses project CSS variables
        EditorView.theme({
          '&': {
            // height:100% fills the .editor-edit-view flex container so CM6
            // participates in the card's fixed-height flex layout (same as the
            // textarea in Source mode fills its container)
            height: '100%',
            fontSize: '15px',
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            color: 'var(--text-main)',
            background: 'var(--bg-card)',
          },
          '.cm-scroller': {
            // overflow:auto — CM6 manages its own internal scroll, matching
            // the textarea behaviour in Source mode
            overflow: 'auto',
            overflowX: 'hidden',  // no horizontal scroll — text wraps
            padding: '1.5rem',
            lineHeight: '1.75',
            // Explicitly set font here so CM6's own base theme (monospace) cannot
            // bleed through via inheritance when fontFamily:'inherit' is on cm-content
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          },
          '.cm-content': {
            maxWidth: '760px',
            margin: '0 auto',
            caretColor: 'var(--text-main)',
            paddingBottom: '4rem',
            whiteSpace: 'pre-wrap',   // wrap long lines (was: default nowrap)
            wordBreak: 'break-word',  // break words that overflow
            // Explicit value (not 'inherit') so CM6's monospace base theme cannot win
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          },
          '.cm-line': {
            padding: '0.05em 0',
          },
          '.cm-activeLine': {
            background: 'var(--bg-hover, rgba(0,0,0,0.04))',
            borderRadius: '3px',
          },
          '.cm-cursor': {
            borderLeftColor: 'var(--text-main)',
            borderLeftWidth: '2px',
          },
          '&.cm-focused': {
            outline: 'none',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Expose the view getter to the parent for toolbar formatting
    onViewReady(() => viewRef.current);

    console.log('[INFO] [EditView] CodeMirror editor mounted');

    return () => {
      view.destroy();
      viewRef.current = null;
      console.log('[INFO] [EditView] CodeMirror editor destroyed');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once only

  // ── Sync external content changes (e.g. switching notes) ─────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc === content) return;

    isExternalUpdateRef.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
    });
    isExternalUpdateRef.current = false;
  }, [content]);

  // ── Focus when switching into Edit mode ───────────────────────────────────
  useEffect(() => {
    if (mode === 'edit') {
      const id = setTimeout(() => viewRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [mode]);

  return (
    <div
      ref={containerRef}
      className="editor-edit-view"
      aria-label="Markdown live preview editor"
    />
  );
};
