import { useEffect, useState, useRef } from 'react';
import { useNavigationStore } from '@core/state/navigationStore';
import { useMathJax } from '@/loaders';
import ModuleLoader from './ModuleLoader';
import { MarkdownRenderer } from '@components/markdown/MarkdownRenderer';
import type { ContentNode } from '@/types/navigation';
import { isTauriContext, readFile } from '@core/ipc/commands';
import { useVaultStore } from '@core/state/vaultStore';

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
  const currentVault = useVaultStore((state) => state.currentVault);

  // Load page content
  useEffect(() => {
    let cancelled = false;

    async function loadPage(): Promise<void> {
      try {
        setIsLoading(true);

        let html: string;
        if (isTauriContext() && currentVault) {
          // Tauri mode: construct absolute path from vault root + relative file path
          const absolutePath = currentVault.path + '/' + node.file;
          console.log('[DEBUG] [PageViewer] Tauri mode - Loading from:', absolutePath);
          html = await readFile(absolutePath);
        } else {
          // PWA mode: use relative path from public directory
          const url = './' + node.file;
          console.log('[DEBUG] [PageViewer] PWA mode - Loading from:', url);
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch page: ${response.statusText}`);
          }
          html = await response.text();
        }

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
  }, [node.file, currentVault, onError]);

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
  const currentVault = useVaultStore((state) => state.currentVault);

  useEffect(() => {
    let cancelled = false;

    async function loadDocument(): Promise<void> {
      try {
        setIsLoading(true);

        let text: string;
        if (isTauriContext() && currentVault) {
          // Tauri mode: construct absolute path from vault root + relative file path
          const absolutePath = currentVault.path + '/' + node.file;
          console.log('[DEBUG] [DocumentViewer] Tauri mode - Loading from:', absolutePath);
          text = await readFile(absolutePath);
        } else {
          // PWA mode: use relative path from public directory
          const url = './' + node.file;
          console.log('[DEBUG] [DocumentViewer] PWA mode - Loading from:', url);
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.statusText}`);
          }
          text = await response.text();
        }

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
  }, [node.file, currentVault, onError]);

  if (isLoading) {
    return <div className="text-text-muted">Loading document...</div>;
  }

  return <MarkdownRenderer content={content} />;
}

export default ContentLoader;
