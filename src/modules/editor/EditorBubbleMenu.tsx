/**
 * EditorBubbleMenu
 * Floating inline toolbar that appears on text selection.
 * Uses ProseMirror selection state and posToDOMRect for positioning.
 *
 * @module EditorBubbleMenu
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import { posToDOMRect } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { createPortal } from 'react-dom';
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    Code,
    Highlighter,
    Link as LinkIcon,
    Subscript as SubscriptIcon,
    Superscript as SuperscriptIcon,
    RemoveFormatting,
} from 'lucide-react';

interface EditorBubbleMenuProps {
    editor: Editor;
}

interface MenuPosition {
    top: number;
    left: number;
}

export const EditorBubbleMenu: React.FC<EditorBubbleMenuProps> = ({ editor }) => {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState<MenuPosition>({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement>(null);

    const updatePosition = useCallback(() => {
        const { state, view } = editor;
        const { selection } = state;

        // Only show when there's a non-empty selection and editor is focused
        if (selection.empty || !editor.isFocused) {
            setVisible(false);
            return;
        }

        const { from, to } = selection;
        const start = posToDOMRect(view, from, to);
        const menuEl = menuRef.current;

        if (!menuEl) {
            setVisible(true); // will position on next render
            return;
        }

        const menuWidth = menuEl.offsetWidth;
        const viewportWidth = window.innerWidth;

        const left = Math.min(
            Math.max(8, start.left + (start.width - menuWidth) / 2),
            viewportWidth - menuWidth - 8
        );
        const top = start.top - menuEl.offsetHeight - 8 + window.scrollY;

        setPos({ top, left });
        setVisible(true);
    }, [editor]);

    useEffect(() => {
        // Skip position updates during viewport-shift transactions — they are
        // non-undoable structural changes that do not affect the user's selection.
        // Firing posToDOMRect() + offsetWidth/offsetHeight during every dispatch
        // forces synchronous reflows and is the main source of dispatch latency.
        const handleUpdate = ({ transaction }: { transaction: Transaction }) => {
            if (transaction.getMeta('viewportShift')) return;
            updatePosition();
        };
        const handleBlur = () => setVisible(false);

        editor.on('selectionUpdate', handleUpdate);
        editor.on('transaction', handleUpdate);
        editor.on('blur', handleBlur);

        return () => {
            editor.off('selectionUpdate', handleUpdate);
            editor.off('transaction', handleUpdate);
            editor.off('blur', handleBlur);
        };
    }, [editor, updatePosition]);

    // Re-position once menu is visible and has a real size
    useEffect(() => {
        if (visible) updatePosition();
    }, [visible, updatePosition]);

    if (!visible) return null;

    const currentColor = (editor.getAttributes('textStyle').color as string | undefined) ?? '#000000';
    const currentHighlight = (editor.getAttributes('highlight').color as string | undefined) ?? '#fef08a';
    const currentBackgroundColor = (editor.getAttributes('textStyle').backgroundColor as string | undefined) ?? '#ffffff';

    const menu = (
        <div
            ref={menuRef}
            className="bubble-menu"
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            onMouseDown={(e) => e.preventDefault()} // prevent editor blur
        >
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'bubble-menu-btn is-active' : 'bubble-menu-btn'}
                title="Bold"
            >
                <Bold size={14} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'bubble-menu-btn is-active' : 'bubble-menu-btn'}
                title="Italic"
            >
                <Italic size={14} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={editor.isActive('underline') ? 'bubble-menu-btn is-active' : 'bubble-menu-btn'}
                title="Underline"
            >
                <UnderlineIcon size={14} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={editor.isActive('strike') ? 'bubble-menu-btn is-active' : 'bubble-menu-btn'}
                title="Strikethrough"
            >
                <Strikethrough size={14} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={editor.isActive('code') ? 'bubble-menu-btn is-active' : 'bubble-menu-btn'}
                title="Inline Code"
            >
                <Code size={14} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleSubscript().run()}
                className={editor.isActive('subscript') ? 'bubble-menu-btn is-active' : 'bubble-menu-btn'}
                title="Subscript"
            >
                <SubscriptIcon size={14} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
                className={editor.isActive('superscript') ? 'bubble-menu-btn is-active' : 'bubble-menu-btn'}
                title="Superscript"
            >
                <SuperscriptIcon size={14} />
            </button>

            <div className="bubble-menu-divider" />

            {/* Highlight color picker */}
            <label className="bubble-menu-btn bubble-menu-color-btn" title="Highlight color">
                <Highlighter size={14} style={{ color: currentHighlight !== '#fef08a' ? currentHighlight : undefined }} />
                <input
                    type="color"
                    className="bubble-menu-color-input"
                    value={currentHighlight}
                    onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                />
            </label>

            {/* Text color picker */}
            <label className="bubble-menu-btn bubble-menu-color-btn" title="Text color">
                <span className="bubble-menu-color-swatch" style={{ color: currentColor }}>A</span>
                <input
                    type="color"
                    className="bubble-menu-color-input"
                    value={currentColor}
                    onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                />
            </label>

            {/* Background color picker */}
            <label className="bubble-menu-btn bubble-menu-color-btn" title="Background color">
                <span className="bubble-menu-color-swatch" style={{ backgroundColor: currentBackgroundColor, color: '#000', padding: '0 2px' }}>A</span>
                <input
                    type="color"
                    className="bubble-menu-color-input"
                    value={currentBackgroundColor}
                    onChange={(e) => editor.chain().focus().setBackgroundColor(e.target.value).run()}
                />
            </label>

            <div className="bubble-menu-divider" />

            {/* Link toggle */}
            <button
                type="button"
                onClick={() => {
                    if (editor.isActive('link')) {
                        editor.chain().focus().unsetLink().run();
                    } else {
                        const url = window.prompt('URL:');
                        if (url) editor.chain().focus().setLink({ href: url }).run();
                    }
                }}
                className={editor.isActive('link') ? 'bubble-menu-btn is-active' : 'bubble-menu-btn'}
                title="Link"
            >
                <LinkIcon size={14} />
            </button>

            {/* Clear formatting */}
            <button
                type="button"
                onClick={() => {
                    editor.chain().focus().clearNodes().unsetAllMarks().run();
                }}
                className="bubble-menu-btn"
                title="Clear formatting"
            >
                <RemoveFormatting size={14} />
            </button>
        </div>
    );

    return createPortal(menu, document.body);
};
