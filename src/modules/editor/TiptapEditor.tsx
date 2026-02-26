/**
 * TiptapEditor
 * WYSIWYG editor component based on @tiptap/core.
 * Uses a purely functional approach with traditional event-based
 * architecture to align with Unstablon's 9-layer model.
 *
 * @module TiptapEditor
 */

import { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import FontFamily from '@tiptap/extension-font-family';
import InvisibleCharacters from '@tiptap/extension-invisible-characters';
import CharacterCount from '@tiptap/extension-character-count';
import Focus from '@tiptap/extension-focus';
import { common, createLowlight } from 'lowlight';
// Custom extensions
import { BackgroundColor } from './extensions/BackgroundColor';
import { FontSize } from './extensions/FontSize';
import { LineHeight } from './extensions/LineHeight';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { EditorFloatingMenu } from './EditorFloatingMenu';

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  onEditorReady,
}) => {
  // Stable refs for callbacks — avoids stale closure captures in effects
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  // Mount container — React owns this div, TipTap/ProseMirror own everything inside
  const mountRef = useRef<HTMLDivElement>(null);

  // Stable ref to the Editor instance — never stored in React state to avoid re-renders
  const editorRef = useRef<Editor | null>(null);

  // Single boolean state — triggers one re-render after mount so the bubble/floating
  // menus can receive the editor instance. Does NOT fire on transactions.
  const [editorReady, setEditorReady] = useState(false);

  // ── Mount / unmount the Editor instance ───────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;

    console.log('[INFO] [TiptapEditor] Mounting editor instance');

    const editor = new Editor({
      element: mountRef.current,
      extensions: [
        StarterKit.configure({
          codeBlock: false, // Disable default to use CodeBlockLowlight
          dropcursor: {
            color: 'var(--accent)',
            width: 2,
          },
        }),
        Markdown.configure({
          html: true,
          tightLists: true,
          bulletListMarker: '-',
          linkify: true,
          breaks: true,
          transformPastedText: true,
          transformCopiedText: true,
        }),
        Placeholder.configure({
          placeholder: 'Start writing...',
        }),
        Typography,
        CodeBlockLowlight.configure({
          lowlight,
        }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableCell,
        TableHeader,
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Highlight.configure({
          multicolor: true,
        }),
        TextStyle,
        Color,
        Subscript,
        Superscript,
        FontFamily,
        FontSize,
        BackgroundColor,
        LineHeight,
        InvisibleCharacters.configure({
          injectCSS: false, // We provide custom styling
        }),
        CharacterCount,
        Focus.configure({
          className: 'is-focused',
          mode: 'all',
        }),
      ],
      content: '', // Initialize empty! tiptap-markdown requires setContent to parse initial load.
      editorProps: {
        handleClick: (view, pos, event) => {
          // Handle internal link clicks
          const { doc } = view.state;
          const $pos = doc.resolve(pos);
          const marks = $pos.marks();
          const linkMark = marks.find(m => m.type.name === 'link');

          if (linkMark) {
            const href = linkMark.attrs.href;
            // Check for wikilinks or internal links
            if (href.startsWith('[[') || (!href.startsWith('http') && !href.startsWith('mailto:'))) {
              event.preventDefault();
              // TODO: Dispatch navigation event
              console.log('[INFO] [TiptapEditor] Internal link clicked:', href);
              return true;
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        const markdown = (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() ?? '';
        onChangeRef.current(markdown);
      },
    });

    // Explicitly set the content here to guarantee that tiptap-markdown intercepts and parses it.
    editor.commands.setContent(content);

    editorRef.current = editor;

    // Notify parent that editor instance is available
    onEditorReadyRef.current?.(editor);

    // Trigger one re-render so bubble/floating menus mount with the editor instance
    setEditorReady(true);

    return () => {
      console.log('[INFO] [TiptapEditor] Destroying editor instance');
      editor.destroy();
      editorRef.current = null;
      setEditorReady(false);
    };
    // Empty deps: mount once per component lifetime. Content synced via separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Content sync ───────────────────────────────────────────────────────────
  // Handles incoming content updates after the editor has mounted.
  // This is how we support document switches or external modifications.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editorReady && !editor.isDestroyed) {
      const currentMarkdown = (editor.storage as any).markdown?.getMarkdown() ?? '';
      if (content !== currentMarkdown) {
        // tiptap-markdown hooks into setContent when passed as the primary argument
        editor.commands.setContent(content);
      }
    }
  }, [content, editorReady]);

  return (
    <>
      {editorReady && editorRef.current && <EditorBubbleMenu editor={editorRef.current} />}
      {editorReady && editorRef.current && <EditorFloatingMenu editor={editorRef.current} />}
      <div ref={mountRef} className="tiptap-editor" />
    </>
  );
};

export default TiptapEditor;
