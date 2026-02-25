/**
 * TiptapEditor
 * Tiptap-based WYSIWYG markdown editor with Typora-like experience.
 * Uses @tiptap/core directly (no @tiptap/react) — editor instance is managed
 * via useRef/useEffect for maximum performance. React owns the container div;
 * ProseMirror/TipTap own everything inside it.
 *
 * @module TiptapEditor
 */

import { useRef, useEffect, useState } from 'react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
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
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import FontFamily from '@tiptap/extension-font-family';
import { CharacterCount, Focus, TrailingNode } from '@tiptap/extensions';
import { common, createLowlight } from 'lowlight';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { EditorFloatingMenu } from './EditorFloatingMenu';
import { FontSize } from './extensions/FontSize';
import { BackgroundColor } from './extensions/BackgroundColor';
import { LineHeight } from './extensions/LineHeight';
import InvisibleCharacters from '@tiptap/extension-invisible-characters';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  onReady?: () => void;
  onScrollRestored?: () => void;
  initialScrollPercentage?: number | null;
  osReadyPromise?: Promise<HTMLElement>;
  /** Incremented on every document switch to force this effect to re-run
   * even when initialScrollPercentage is numerically identical across docs. */
  restoreToken?: number;
}

const lowlight = createLowlight(common);

const CustomParagraph = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          if (node.attrs.textAlign || node.attrs.lineHeight) {
            const style = [];
            if (node.attrs.textAlign) style.push(`text-align: ${node.attrs.textAlign}`);
            if (node.attrs.lineHeight) style.push(`line-height: ${node.attrs.lineHeight}`);

            state.write(`<p style="${style.join('; ')}">\n\n`);
            state.renderInline(node);
            state.write('\n\n</p>');
            state.closeBlock(node);
          } else {
            state.renderInline(node);
            state.closeBlock(node);
          }
        },
        parse: { setup() { } }
      }
    };
  }
});

const CustomHeading = Heading.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          if (node.attrs.textAlign || node.attrs.lineHeight) {
            const style = [];
            if (node.attrs.textAlign) style.push(`text-align: ${node.attrs.textAlign}`);
            if (node.attrs.lineHeight) style.push(`line-height: ${node.attrs.lineHeight}`);

            state.write(`<h${node.attrs.level} style="${style.join('; ')}">\n\n`);
            state.renderInline(node);
            state.write(`\n\n</h${node.attrs.level}>`);
            state.closeBlock(node);
          } else {
            state.write(state.repeat('#', node.attrs.level) + ' ');
            state.renderInline(node);
            state.closeBlock(node);
          }
        },
        parse: { setup() { } }
      }
    };
  }
});

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  onEditorReady,
  onReady,
  onScrollRestored,
  initialScrollPercentage,
  osReadyPromise,
  restoreToken,
}) => {
  // Stable refs for callbacks — avoids stale closure captures in effects
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  const onScrollRestoredRef = useRef(onScrollRestored);
  onScrollRestoredRef.current = onScrollRestored;

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
          codeBlock: false,    // Use CodeBlockLowlight instead
          paragraph: false,    // Use CustomParagraph instead
          heading: false,      // Use CustomHeading instead
          dropcursor: {
            color: 'var(--accent)',
            width: 2,
          },
        }),
        CustomParagraph,
        CustomHeading,
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
        Link.configure({
          openOnClick: false,
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
        TrailingNode,
      ],
      content,
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

    editorRef.current = editor;

    // Notify parent that editor is ready
    onEditorReadyRef.current?.(editor);
    onReady?.();

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

  // ── Scroll restoration ─────────────────────────────────────────────────────
  // Depends on initialScrollPercentage + restoreToken so it re-runs on each
  // document switch and mode change, but NOT on every content change.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (initialScrollPercentage != null && initialScrollPercentage > 0) {
      let cancelled = false;

      const restoreScroll = async () => {
        let viewport: HTMLElement | null = null;

        if (osReadyPromise) {
          try {
            console.log('[DEBUG] [TiptapEditor] Awaiting OS viewport ready...');
            viewport = await osReadyPromise;
            console.log('[DEBUG] [TiptapEditor] Viewport ready via OS promise');
          } catch (err) {
            // Promise rejected (mode changed or doc changed) — abort but ungate visibility
            console.log('[DEBUG] [TiptapEditor] Viewport promise rejected:', err);
            onScrollRestoredRef.current?.();
            return;
          }
        } else {
          // Non-OverlayScrollbars path — query DOM directly
          viewport = document.querySelector<HTMLElement>('.editor-live-preview');
          console.log('[DEBUG] [TiptapEditor] Viewport from DOM query');
        }

        if (cancelled) return;

        if (viewport) {
          // rAF ensures browser has laid out new content before reading scrollHeight.
          // Without it the content-sync effect may not have fired yet → scrollableHeight = 0.
          requestAnimationFrame(() => {
            if (cancelled || !viewport!.isConnected) {
              // Viewport detached (Strict Mode teardown or mode/doc change) —
              // still ungate visibility so the UI doesn't stay hidden.
              onScrollRestoredRef.current?.();
              return;
            }
            const { scrollHeight, clientHeight } = viewport!;
            const scrollableHeight = Math.max(0, scrollHeight - clientHeight);
            viewport!.scrollTop = scrollableHeight * initialScrollPercentage;
            console.log('[DEBUG] [TiptapEditor] Scroll restored:', { scrollTop: viewport!.scrollTop });
            onScrollRestoredRef.current?.();
          });
        }
      };

      restoreScroll();
      return () => { cancelled = true; };
    } else {
      // No restoration needed — ungate visibility immediately
      onScrollRestoredRef.current?.();
    }
  }, [initialScrollPercentage, osReadyPromise, restoreToken]);
  // NOTE: editorRef is intentionally excluded — editor readiness is handled by
  // the mount effect above, not here. onReady fires synchronously in the mount
  // effect, which triggers the parent to set initialScrollPercentage, which
  // then triggers this effect via restoreToken.

  // ── Content sync ───────────────────────────────────────────────────────────
  // Sync content prop to editor when it changes externally (e.g. cache restore,
  // external file modification via file:modified IPC event).
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;

    // Get current editor markdown content
    const currentContent = (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown?.() ?? '';

    // Only update if content actually differs (avoids cursor jump)
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
  }, [content]);

  // React owns this container div. TipTap/ProseMirror mount inside it via new Editor({ element }).
  // Do NOT render children here — the editor manages its own DOM subtree.
  return (
    <>
      {editorReady && editorRef.current && <EditorBubbleMenu editor={editorRef.current} />}
      {editorReady && editorRef.current && <EditorFloatingMenu editor={editorRef.current} />}
      <div ref={mountRef} className="tiptap-editor" />
    </>
  );
};
