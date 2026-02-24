/**
 * LivePreviewEditor
 * Milkdown Crepe-based WYSIWYG markdown editor with live preview.
 * Provides a Typora-like editing experience with rendered content.
 *
 * @module LivePreviewEditor
 */

import { useRef, useEffect } from 'react';
import { Crepe } from '@milkdown/crepe';
// Import Crepe styles (includes ProseMirror base + all feature CSS)
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

interface LivePreviewEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export const LivePreviewEditor: React.FC<LivePreviewEditorProps> = ({
  content,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);
  const initialContentRef = useRef(content);

  // Keep onChange reference current
  onChangeRef.current = onChange;

  // Initialize Crepe editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: initialContentRef.current,
    });

    // Set up markdown change listener
    crepe.on((listener) => {
      listener.markdownUpdated((_, markdown) => {
        onChangeRef.current(markdown);
      });
    });

    crepe.create().then(() => {
      crepeRef.current = crepe;
      console.log('[INFO] [LivePreviewEditor] Crepe editor mounted');
    }).catch((err) => {
      console.error('[ERROR] [LivePreviewEditor] Failed to create Crepe editor:', err);
    });

    return () => {
      crepe.destroy();
      crepeRef.current = null;
      console.log('[INFO] [LivePreviewEditor] Crepe editor destroyed');
    };
  }, []); // Only run on mount - content changes handled via onChange

  return (
    <div
      ref={containerRef}
      className="milkdown-editor"
      aria-label="Markdown live preview editor"
    />
  );
};
