import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigationStore } from '@core/state/navigationStore';
import { useSidebarStore } from '@core/state/sidebarStore';
import { useShouldAutoCloseSidebar } from '@hooks/useWindowSize';
import ContentLoader from '@modules/content/ContentLoader';
import ErrorBoundary from '@components/ErrorBoundary';

/**
 * Main content area component
 */
function MainContent(): React.JSX.Element {
  const isLoading = useNavigationStore((state) => state.isLoading);
  const navigationTree = useNavigationStore((state) => state.navigationTree);
  const activeNode = useNavigationStore((state) => state.activeNode);
  const isOpen = useSidebarStore((state) => state.isOpen);
  const close = useSidebarStore((state) => state.close);
  const shouldAutoClose = useShouldAutoCloseSidebar();

  // Track content switching animation
  const [isAnimating, setIsAnimating] = useState(false);
  const previousNodeIdRef = useRef<string | null>(null);

  // Trigger animation only when node ID actually changes
  useEffect(() => {
    if (activeNode && activeNode.id !== previousNodeIdRef.current) {
      setIsAnimating(true);
      previousNodeIdRef.current = activeNode.id;
      // Brief delay before switching to loaded to trigger animation
      const timer = requestAnimationFrame(() => {
        setIsAnimating(false);
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [activeNode]);

  // Close sidebar when clicking on content area (if viewport requires it)
  const handleContentClick = useCallback((): void => {
    if (isOpen && shouldAutoClose) {
      close();
    }
  }, [isOpen, shouldAutoClose, close]);

  return (
    <main className="main-content" onClick={handleContentClick}>
      <div className={['page-root', activeNode?.type === 'document' ? 'has-editor' : ''].filter(Boolean).join(' ')}>
        <section
          id="contentCard"
          className={[
            'card',
            (isLoading && !navigationTree) || isAnimating ? 'preload' : 'loaded',
            activeNode?.type === 'document' ? 'editor-card' : '',
          ].filter(Boolean).join(' ')}
        >
          {!navigationTree ? (
            <div className="loading-message">
              Loading navigation...
            </div>
          ) : (
            <ErrorBoundary>
              <ContentLoader />
            </ErrorBoundary>
          )}
        </section>
      </div>
    </main>
  );
}

export default MainContent;
