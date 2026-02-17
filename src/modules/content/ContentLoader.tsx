import { useEffect, useRef, useState } from 'react';
import { useNavigationStore } from '@core/state/navigationStore';
import { useThemeStore } from '@core/state/themeStore';
import ModuleLoader from './ModuleLoader';
import type { ContentNode } from '@/types/navigation';

/**
 * Content loader component
 * Handles loading and rendering of modules, pages, and documents
 */
function ContentLoader(): React.JSX.Element {
  const activeNode = useNavigationStore((state) => state.activeNode);
  const isLoading = useNavigationStore((state) => state.isLoading);
  const setLoading = useNavigationStore((state) => state.setLoading);
  const theme = useThemeStore((state) => state.theme);

  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Clear error when active node changes
  useEffect(() => {
    setError(null);
  }, [activeNode]);

  if (!activeNode) {
    return (
      <div className="empty-state flex flex-col items-center justify-center min-h-[200px] text-text-muted">
        <p>Select a module from the sidebar to begin</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state p-4 rounded-md bg-danger/10 border border-danger/20">
        <h3 className="text-danger font-medium mb-2">Error Loading Content</h3>
        <p className="text-text-muted text-sm">{error}</p>
      </div>
    );
  }

  // Render based on content type
  switch (activeNode.type) {
    case 'module':
      return (
        <div ref={containerRef} className="module-container w-full">
          <ModuleLoader
            node={activeNode}
            container={containerRef}
            onError={setError}
          />
        </div>
      );

    case 'page':
      return (
        <div className="page-container w-full">
          <PageViewer node={activeNode} onError={setError} />
        </div>
      );

    case 'document':
      return (
        <div className="document-container w-full">
          <DocumentViewer node={activeNode} onError={setError} />
        </div>
      );

    default:
      return (
        <div className="text-text-muted">
          Unknown content type
        </div>
      );
  }
}

interface ViewerProps {
  node: ContentNode;
  onError: (error: string) => void;
}

/**
 * Page viewer component for HTML content
 */
function PageViewer({ node, onError }: ViewerProps): React.JSX.Element {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPage(): Promise<void> {
      try {
        setIsLoading(true);
        const response = await fetch(node.file);
        if (!response.ok) {
          throw new Error(`Failed to fetch page: ${response.statusText}`);
        }
        const html = await response.text();
        if (!cancelled) {
          setContent(html);
        }
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : 'Failed to load page');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [node.file, onError]);

  if (isLoading) {
    return <div className="text-text-muted">Loading page...</div>;
  }

  return (
    <div
      className="page-content prose prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

/**
 * Document viewer component for markdown/text content
 */
function DocumentViewer({ node, onError }: ViewerProps): React.JSX.Element {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDocument(): Promise<void> {
      try {
        setIsLoading(true);
        const response = await fetch(node.file);
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`);
        }
        const text = await response.text();
        if (!cancelled) {
          setContent(text);
        }
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : 'Failed to load document');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDocument();

    return () => {
      cancelled = true;
    };
  }, [node.file, onError]);

  if (isLoading) {
    return <div className="text-text-muted">Loading document...</div>;
  }

  // For now, render as preformatted text
  // TODO: Add markdown rendering
  return (
    <pre className="document-content whitespace-pre-wrap font-mono text-sm text-text-main bg-bg-panel p-4 rounded-md overflow-auto">
      {content}
    </pre>
  );
}

export default ContentLoader;
