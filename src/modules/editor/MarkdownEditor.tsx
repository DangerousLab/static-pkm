/**
 * MarkdownEditor
 * Full-featured markdown editor with two modes: Edit (Tiptap WYSIWYG) and Source (CodeMirror).
 * Handles file loading, saving, and auto-save.
 *
 * @module MarkdownEditor
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { readFile } from '@core/ipc/commands';
import { useEditorStore } from '@core/state/editorStore';
import { useSave } from '@/hooks/useSave';
import { useAutoSave } from '@/hooks/useAutoSave';
import { OverlayScrollbarsComponent, getScrollbarOptions } from '@core/utils/scrollbar';
import { needsCustomScrollbar } from '@core/utils/platform';
import type { DocumentNode } from '@/types/navigation';
import { EditorToolbar } from './EditorToolbar';
import { TiptapEditor } from './TiptapEditor';
import { SourceView } from './SourceView';

interface MarkdownEditorProps {
  node: DocumentNode;
  absolutePath: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  node,
  absolutePath,
}) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mode = useEditorStore((s) => s.mode);

  // Stable getter for current content (avoids stale closures in hooks)
  const contentRef = useRef(content);
  contentRef.current = content;
  const getContent = useCallback(() => contentRef.current, []);

  const { save, isSaving, lastSaved, setLastSaved, isDirty, setIsDirty } = useSave(
    node.id,
    absolutePath,
    getContent
  );

  useAutoSave(node.id, absolutePath, getContent, isDirty, setIsDirty, setLastSaved);

  // ── Load file on mount / note switch ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setIsLoading(true);
      setLoadError(null);

      try {
        const text = await readFile(absolutePath);
        if (!cancelled) {
          setContent(text);
          setIsDirty(false);
          console.log('[INFO] [MarkdownEditor] Loaded:', node.id);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load document';
          setLoadError(msg);
          console.error('[ERROR] [MarkdownEditor] Load failed:', err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [node.id, absolutePath]);

  const handleChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      if (!isDirty) setIsDirty(true);
    },
    [isDirty, setIsDirty]
  );

  const osOptions = getScrollbarOptions();
  const useMacOSScrollbars = needsCustomScrollbar();

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="editor-container">
        <div className="editor-loading">Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="editor-container">
        <div className="p-4 text-sm text-red-600 dark:text-red-400">
          Error loading document: {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <EditorToolbar
        isSaving={isSaving}
        lastSaved={lastSaved}
        isDirty={isDirty}
        onSave={save}
      />

      {mode === 'edit' && (
        useMacOSScrollbars ? (
          <OverlayScrollbarsComponent
            element="div"
            className="editor-live-preview"
            options={osOptions}
            defer
          >
            <TiptapEditor
              content={content}
              onChange={handleChange}
            />
          </OverlayScrollbarsComponent>
        ) : (
          <div className="editor-live-preview">
            <TiptapEditor
              content={content}
              onChange={handleChange}
            />
          </div>
        )
      )}

      {mode === 'source' && (
        useMacOSScrollbars ? (
          <OverlayScrollbarsComponent
            element="div"
            className="editor-source-view"
            options={osOptions}
            defer
          >
            <SourceView
              content={content}
              onChange={handleChange}
            />
          </OverlayScrollbarsComponent>
        ) : (
          <div className="editor-source-view">
            <SourceView
              content={content}
              onChange={handleChange}
            />
          </div>
        )
      )}
    </div>
  );
};

export default MarkdownEditor;
