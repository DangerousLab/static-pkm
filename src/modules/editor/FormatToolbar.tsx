/**
 * FormatToolbar
 * WYSIWYG formatting toolbar for Tiptap editor
 * Provides buttons for text formatting, headings, lists, and block elements
 *
 * @module FormatToolbar
 */

import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code2,
  Minus,
  Undo,
  Redo,
  Type,
} from 'lucide-react';

interface FormatToolbarProps {
  editor: Editor;
}

export const FormatToolbar: React.FC<FormatToolbarProps> = ({ editor }) => {
  const setHeading = (level: 1 | 2 | 3) => {
    editor.chain().focus().toggleHeading({ level }).run();
  };

  const setParagraph = () => {
    editor.chain().focus().setParagraph().run();
  };

  return (
    <div className="editor-format-toolbar">
      {/* Text Formatting */}
      <div className="editor-fmt-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Bold (Ctrl+B)"
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Italic (Ctrl+I)"
        >
          <Italic size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Strikethrough"
        >
          <Strikethrough size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={editor.isActive('code') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Inline Code"
        >
          <Code size={18} />
        </button>
      </div>

      <div className="editor-fmt-divider" />

      {/* Headings */}
      <div className="editor-fmt-group">
        <button
          type="button"
          onClick={setParagraph}
          className={editor.isActive('paragraph') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Paragraph"
        >
          <Type size={18} />
        </button>
        <button
          type="button"
          onClick={() => setHeading(1)}
          className={editor.isActive('heading', { level: 1 }) ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Heading 1"
        >
          <Heading1 size={18} />
        </button>
        <button
          type="button"
          onClick={() => setHeading(2)}
          className={editor.isActive('heading', { level: 2 }) ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Heading 2"
        >
          <Heading2 size={18} />
        </button>
        <button
          type="button"
          onClick={() => setHeading(3)}
          className={editor.isActive('heading', { level: 3 }) ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Heading 3"
        >
          <Heading3 size={18} />
        </button>
      </div>

      <div className="editor-fmt-divider" />

      {/* Lists */}
      <div className="editor-fmt-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Bullet List"
        >
          <List size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Numbered List"
        >
          <ListOrdered size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={editor.isActive('taskList') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Task List"
        >
          <CheckSquare size={18} />
        </button>
      </div>

      <div className="editor-fmt-divider" />

      {/* Block Elements */}
      <div className="editor-fmt-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Blockquote"
        >
          <Quote size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Code Block"
        >
          <Code2 size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="editor-fmt-btn"
          title="Horizontal Rule"
        >
          <Minus size={18} />
        </button>
      </div>

      <div className="editor-fmt-divider" />

      {/* History */}
      <div className="editor-fmt-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="editor-fmt-btn"
          title="Undo (Ctrl+Z)"
        >
          <Undo size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="editor-fmt-btn"
          title="Redo (Ctrl+Y)"
        >
          <Redo size={18} />
        </button>
      </div>
    </div>
  );
};
