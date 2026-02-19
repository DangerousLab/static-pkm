import { useEffect, useState, useRef } from 'react';
import { useNavigationStore } from '@core/state/navigationStore';
import { useMathJax } from '@/loaders';
import ModuleLoader from './ModuleLoader';
import type { ContentNode } from '@/types/navigation';

/**
 * Content loader component
 * Handles loading and rendering of modules, pages, and documents
 */
function ContentLoader(): React.JSX.Element {
  const activeNode = useNavigationStore((state) => state.activeNode);

  const [error, setError] = useState<string | null>(null);

  // Clear error when active node changes
  useEffect(() => {
    setError(null);
  }, [activeNode]);

  if (!activeNode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-text-muted">
        <p>Select a module from the sidebar to begin</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-sm bg-danger/10 border border-danger/20">
        <h3 className="text-danger font-medium mb-2">
          Error Loading Content
        </h3>
        <p className="text-text-muted text-sm">{error}</p>
      </div>
    );
  }

  // Render based on content type
  switch (activeNode.type) {
    case 'module':
      return (
        <ModuleLoader
          key={activeNode.id}
          node={activeNode}
          onError={setError}
        />
      );

    case 'page':
      return (
        <div className="page-container">
          <PageViewer node={activeNode} onError={setError} />
        </div>
      );

    case 'document':
      return (
        <div className="document-container">
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
  const contentRef = useRef<HTMLDivElement>(null);
  const { isLoaded: mathJaxLoaded, typeset } = useMathJax();

  // Load page content
  useEffect(() => {
    let cancelled = false;

    async function loadPage(): Promise<void> {
      try {
        setIsLoading(true);
        const url = './' + node.file;
        const response = await fetch(url);
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

  // Typeset MathJax after content loads
  useEffect(() => {
    if (!isLoading && mathJaxLoaded && contentRef.current && content) {
      typeset(contentRef.current);
    }
  }, [isLoading, mathJaxLoaded, content, typeset]);

  if (isLoading) {
    return <div className="text-text-muted">Loading page...</div>;
  }

  return (
    <div
      ref={contentRef}
      className="page-content"
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
        const url = './' + node.file;
        const response = await fetch(url);
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
    <pre className="whitespace-pre-wrap font-mono text-sm text-text-main bg-bg-panel p-4 rounded-sm overflow-auto">
      {content}
    </pre>
  );
}

export default ContentLoader;
