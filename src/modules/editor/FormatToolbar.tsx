/**
 * FormatToolbar
 * WYSIWYG formatting toolbar for Tiptap editor.
 * Provides buttons for text formatting, headings, lists, block elements,
 * text align, colors, font family, subscript/superscript, and char count.
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  PaintBucket,
  RemoveFormatting,
} from 'lucide-react';

interface FormatToolbarProps {
  editor: Editor;
}

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Mono', value: 'var(--font-mono)' },
  { label: 'Courier', value: '"Courier New", monospace' },
];

const FONT_SIZES = [
  { label: 'Size', value: '' },
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '24px', value: '24px' },
  { label: '32px', value: '32px' },
];

const LINE_HEIGHTS = [
  { label: 'Line Height', value: '' },
  { label: '1.0', value: '1.0' },
  { label: '1.2', value: '1.2' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2.0' },
];

export const FormatToolbar: React.FC<FormatToolbarProps> = ({ editor }) => {
  const setHeading = (level: 1 | 2 | 3) => {
    editor.chain().focus().toggleHeading({ level }).run();
  };

  const setParagraph = () => {
    editor.chain().focus().setParagraph().run();
  };

  // Character count from extension storage
  const charCount = (editor.storage as { characterCount?: { characters: () => number; words: () => number } })
    .characterCount;
  const wordCount = charCount ? charCount.words() : 0;
  const characterCount = charCount ? charCount.characters() : 0;

  // Current text color
  const currentColor = (editor.getAttributes('textStyle').color as string | undefined) ?? '#000000';
  // Current highlight color
  const currentHighlight = (editor.getAttributes('highlight').color as string | undefined) ?? '#fef08a';
  // Current background color
  const currentBackgroundColor = (editor.getAttributes('textStyle').backgroundColor as string | undefined) ?? '#ffffff';

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
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          className={editor.isActive('subscript') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Subscript"
        >
          <SubscriptIcon size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          className={editor.isActive('superscript') ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Superscript"
        >
          <SuperscriptIcon size={18} />
        </button>
      </div>

      <div className="editor-fmt-divider" />

      {/* Color: Text + Highlight */}
      <div className="editor-fmt-group">
        <label className="editor-fmt-btn editor-fmt-color-btn" title="Text color">
          <span className="editor-fmt-color-icon" style={{ color: currentColor }}>
            <Type size={16} />
          </span>
          <input
            type="color"
            className="editor-fmt-color-input"
            value={currentColor}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
        <label className="editor-fmt-btn editor-fmt-color-btn" title="Highlight color">
          <span className="editor-fmt-color-icon" style={{ color: currentHighlight }}>
            <Highlighter size={16} />
          </span>
          <input
            type="color"
            className="editor-fmt-color-input"
            value={currentHighlight}
            onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          />
        </label>
        <label className="editor-fmt-btn editor-fmt-color-btn" title="Background color">
          <span className="editor-fmt-color-icon" style={{ color: currentBackgroundColor }}>
            <PaintBucket size={16} />
          </span>
          <input
            type="color"
            className="editor-fmt-color-input"
            value={currentBackgroundColor}
            onChange={(e) => editor.chain().focus().setBackgroundColor(e.target.value).run()}
          />
        </label>
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

      {/* Text Align */}
      <div className="editor-fmt-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={editor.isActive({ textAlign: 'left' }) ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Align Left"
        >
          <AlignLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={editor.isActive({ textAlign: 'center' }) ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Align Center"
        >
          <AlignCenter size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={editor.isActive({ textAlign: 'right' }) ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Align Right"
        >
          <AlignRight size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={editor.isActive({ textAlign: 'justify' }) ? 'editor-fmt-btn is-active' : 'editor-fmt-btn'}
          title="Justify"
        >
          <AlignJustify size={18} />
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

      {/* Fonts & Spacing */}
      <div className="editor-fmt-group">
        <select
          className="editor-fmt-select"
          title="Font family"
          onChange={(e) => {
            if (e.target.value === '') {
              editor.chain().focus().unsetFontFamily().run();
            } else {
              editor.chain().focus().setFontFamily(e.target.value).run();
            }
          }}
          value={
            FONT_FAMILIES.find(
              (f) => f.value === (editor.getAttributes('textStyle').fontFamily as string | undefined)
            )?.value ?? ''
          }
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          className="editor-fmt-select"
          title="Font size"
          onChange={(e) => {
            if (e.target.value === '') {
              editor.chain().focus().unsetFontSize().run();
            } else {
              editor.chain().focus().setFontSize(e.target.value).run();
            }
          }}
          value={
            FONT_SIZES.find(
              (f) => f.value === (editor.getAttributes('textStyle').fontSize as string | undefined)
            )?.value ?? ''
          }
        >
          {FONT_SIZES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          className="editor-fmt-select"
          title="Line height"
          onChange={(e) => {
            if (e.target.value === '') {
              editor.chain().focus().unsetLineHeight().run();
            } else {
              editor.chain().focus().setLineHeight(e.target.value).run();
            }
          }}
          value={
            LINE_HEIGHTS.find(
              (f) => f.value === (editor.getAttributes('paragraph').lineHeight as string | undefined) ||
                f.value === (editor.getAttributes('heading').lineHeight as string | undefined)
            )?.value ?? ''
          }
        >
          {LINE_HEIGHTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
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
        <div className="editor-fmt-divider" style={{ height: '18px', margin: '0 4px' }} />
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().clearNodes().unsetAllMarks().run();
          }}
          className="editor-fmt-btn"
          title="Clear formatting"
        >
          <RemoveFormatting size={18} />
        </button>
      </div>

      {/* Character count (passive, right-aligned) */}
      <div className="editor-fmt-char-count">
        {wordCount} w · {characterCount} c
      </div>
    </div>
  );
};
