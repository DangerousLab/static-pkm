/**
 * TiptapEditor
 * Tiptap-based WYSIWYG markdown editor with Typora-like experience.
 * Provides fast rendering with shouldRerenderOnTransaction optimization.
 *
 * @module TiptapEditor
 */

import { useRef, useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { common, createLowlight } from 'lowlight';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
}

const lowlight = createLowlight(common);

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  onEditorReady,
}) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Use CodeBlockLowlight instead
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: '-',
        linkify: true,
        breaks: true, // Changed from false - preserves single newlines as <br>
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Link.configure({
        openOnClick: false, // Handle clicks ourselves
        autolink: true,
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
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TextStyle,
      Color,
    ],
    content,
    immediatelyRender: false, // SSR safety
    shouldRerenderOnTransaction: false, // Critical performance optimization
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown();
      onChangeRef.current(markdown);
    },
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
  });

  useEffect(() => {
    console.log('[INFO] [TiptapEditor] Editor mounted');
    if (editor && onEditorReadyRef.current) {
      onEditorReadyRef.current(editor);
    }
    return () => {
      console.log('[INFO] [TiptapEditor] Editor destroyed');
    };
  }, [editor]);

  // Sync content prop to editor when it changes externally (e.g., cache restore)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    // Get current editor markdown content
    const currentContent = editor.storage.markdown?.getMarkdown?.() ?? '';

    // Only update if content actually differs (avoid cursor jump)
    if (content && content !== currentContent) {
      // Preserve cursor position
      const { from, to } = editor.state.selection;
      editor.commands.setContent(content);

      // Restore cursor (clamped to new content length)
      requestAnimationFrame(() => {
        if (!editor.isDestroyed) {
          const maxPos = editor.state.doc.content.size;
          editor.commands.setTextSelection({
            from: Math.min(from, maxPos),
            to: Math.min(to, maxPos),
          });
        }
      });
    }
  }, [editor, content]);

  if (!editor) {
    return <div className="tiptap-loading">Loading editor...</div>;
  }

  return (
    <EditorContent
      editor={editor}
      className="tiptap-editor"
    />
  );
};
