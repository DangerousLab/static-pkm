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
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
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
// Custom extensions
import { BackgroundColor } from './extensions/BackgroundColor';
import { FontSize } from './extensions/FontSize';
import { LineHeight } from './extensions/LineHeight';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { EditorFloatingMenu } from './EditorFloatingMenu';
// Utils
import { detectRequiredExtensions } from './utils/extensionScanner';
import { loadExtensions } from './utils/extensionLoader';

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

    let isCancelled = false;
    let editorInstance: Editor | null = null;

    console.log('[INFO] [TiptapEditor] Mounting editor instance');

    async function initEditor() {
      if (!mountRef.current) return;

      const tInitStart = performance.now();
      console.log(`[PERF] [Tiptap] 1. initEditor started: 0ms`);

      const requirements = detectRequiredExtensions(content);
      const tAfterScan = performance.now();
      console.log(`[PERF] [Tiptap] 2. detectRequiredExtensions took: ${(tAfterScan - tInitStart).toFixed(2)}ms`, requirements);

      const dynamicExtensions = await loadExtensions(requirements);
      const tAfterLoad = performance.now();
      console.log(`[PERF] [Tiptap] 3. loadExtensions await took: ${(tAfterLoad - tAfterScan).toFixed(2)}ms`);

      if (isCancelled) {
        console.log(`[PERF] [Tiptap] cancelled before mount`);
        return;
      }

      const tBeforeMount = performance.now();
      editorInstance = new Editor({
        element: mountRef.current,
        extensions: [
          StarterKit.configure({
            codeBlock: false, // Disable default to use CodeBlockLowlight
            dropcursor: {
              color: 'var(--accent)',
              width: 2,
            },
          }),
          Placeholder.configure({
            placeholder: 'Start writing...',
          }),
          Typography,
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
          ...dynamicExtensions,
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

      const tAfterMount = performance.now();
      console.log(`[PERF] [Tiptap] 4. new Editor() constructor took: ${(tAfterMount - tBeforeMount).toFixed(2)}ms`);

      // Explicitly set the content here to guarantee that tiptap-markdown intercepts and parses it.
      editorInstance.commands.setContent(content);

      const tAfterSetContent = performance.now();
      console.log(`[PERF] [Tiptap] 5. setContent(markdown) parsing took: ${(tAfterSetContent - tAfterMount).toFixed(2)}ms`);

      editorRef.current = editorInstance;

      // Notify parent that editor instance is available
      onEditorReadyRef.current?.(editorInstance);

      // Trigger one re-render so bubble/floating menus mount with the editor instance
      setEditorReady(true);

      const tEnd = performance.now();
      console.log(`[PERF] [Tiptap] 6. Total async init flow took: ${(tEnd - tInitStart).toFixed(2)}ms`);
    }

    initEditor().catch(err => console.error('[ERROR] [TiptapEditor] Initialization failed:', err));

    return () => {
      isCancelled = true;
      console.log('[INFO] [TiptapEditor] Destroying editor instance');
      if (editorInstance) {
        editorInstance.destroy();
      }
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
