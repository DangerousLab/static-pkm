/**
 * EditorFloatingMenu
 * Floating menu that appears on empty lines with quick block-insert options.
 * Uses ProseMirror cursor position for placement.
 *
 * @module EditorFloatingMenu
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import { posToDOMRect } from '@tiptap/core';
import { createPortal } from 'react-dom';
import {
    Plus,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    CheckSquare,
    Code2,
    Quote,
    Minus,
} from 'lucide-react';

interface EditorFloatingMenuProps {
    editor: Editor;
}

interface MenuPosition {
    top: number;
    left: number;
}

export const EditorFloatingMenu: React.FC<EditorFloatingMenuProps> = ({ editor }) => {
    const [visible, setVisible] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [pos, setPos] = useState<MenuPosition>({ top: 0, left: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);

    const computeVisibility = useCallback(() => {
        const { state, view } = editor;
        const { selection } = state;

        // Show only when cursor is in an empty paragraph and editor is focused
        if (!editor.isFocused || !selection.empty) {
            setVisible(false);
            return;
        }

        const $pos = state.doc.resolve(selection.from);
        const parent = $pos.parent;
        const isEmpty = parent.type.name === 'paragraph' && parent.content.size === 0;

        if (!isEmpty) {
            setVisible(false);
            return;
        }

        // Position to the left of the cursor line
        const domRect = posToDOMRect(view, selection.from, selection.to);
        const editorEl = view.dom.closest('.tiptap-editor');
        const editorRect = editorEl?.getBoundingClientRect();

        const top = domRect.top + window.scrollY + (domRect.height - 22) / 2;
        const left = editorRect ? editorRect.left - 32 : domRect.left - 32;

        setPos({ top: Math.max(0, top), left: Math.max(0, left) });
        setVisible(true);
    }, [editor]);

    useEffect(() => {
        const handleUpdate = () => {
            computeVisibility();
            setIsOpen(false); // close panel on any move
        };
        const handleBlur = () => {
            setVisible(false);
            setIsOpen(false);
        };

        editor.on('selectionUpdate', handleUpdate);
        editor.on('transaction', handleUpdate);
        editor.on('focus', computeVisibility);
        editor.on('blur', handleBlur);

        return () => {
            editor.off('selectionUpdate', handleUpdate);
            editor.off('transaction', handleUpdate);
            editor.off('focus', computeVisibility);
            editor.off('blur', handleBlur);
        };
    }, [editor, computeVisibility]);

    const run = (command: () => void) => {
        command();
        setIsOpen(false);
        setVisible(false);
    };

    if (!visible) return null;

    const menu = (
        <div
            style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9998 }}
            onMouseDown={(e) => e.preventDefault()}
        >
            <button
                ref={btnRef}
                type="button"
                className={`floating-menu-trigger ${isOpen ? 'is-open' : ''}`}
                onClick={() => setIsOpen((v) => !v)}
                title="Insert block"
                aria-label="Insert block"
            >
                <Plus size={14} />
            </button>

            {isOpen && (
                <div className="floating-menu-panel">
                    <button type="button" className="floating-menu-item" onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}>
                        <Heading1 size={14} /><span>Heading 1</span>
                    </button>
                    <button type="button" className="floating-menu-item" onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}>
                        <Heading2 size={14} /><span>Heading 2</span>
                    </button>
                    <button type="button" className="floating-menu-item" onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}>
                        <Heading3 size={14} /><span>Heading 3</span>
                    </button>

                    <div className="floating-menu-separator" />

                    <button type="button" className="floating-menu-item" onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}>
                        <List size={14} /><span>Bullet List</span>
                    </button>
                    <button type="button" className="floating-menu-item" onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())}>
                        <ListOrdered size={14} /><span>Numbered List</span>
                    </button>
                    <button type="button" className="floating-menu-item" onClick={() => run(() => editor.chain().focus().toggleTaskList().run())}>
                        <CheckSquare size={14} /><span>Task List</span>
                    </button>

                    <div className="floating-menu-separator" />

                    <button type="button" className="floating-menu-item" onClick={() => run(() => editor.chain().focus().toggleCodeBlock().run())}>
                        <Code2 size={14} /><span>Code Block</span>
                    </button>
                    <button type="button" className="floating-menu-item" onClick={() => run(() => editor.chain().focus().toggleBlockquote().run())}>
                        <Quote size={14} /><span>Blockquote</span>
                    </button>
                    <button type="button" className="floating-menu-item" onClick={() => run(() => editor.chain().focus().setHorizontalRule().run())}>
                        <Minus size={14} /><span>Divider</span>
                    </button>
                </div>
            )}
        </div>
    );

    return createPortal(menu, document.body);
};
