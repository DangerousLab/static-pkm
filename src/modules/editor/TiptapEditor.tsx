/**
 * TiptapEditor
 * Tiptap-based WYSIWYG markdown editor with Typora-like experience.
 * Provides fast rendering with shouldRerenderOnTransaction optimization.
 *
 * @module TiptapEditor
 */

import { useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { common, createLowlight } from 'lowlight';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
}

const lowlight = createLowlight(common);

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
}) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
        breaks: false,
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
    return () => {
      console.log('[INFO] [TiptapEditor] Editor destroyed');
    };
  }, []);

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
