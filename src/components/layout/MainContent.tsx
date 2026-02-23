import { useCallback, useEffect, useState } from 'react';
import { useNavigationStore } from '@core/state/navigationStore';
import { useSidebarStore } from '@core/state/sidebarStore';
import { useShouldAutoCloseSidebar } from '@hooks/useWindowSize';
import { OverlayScrollbarsComponent, getScrollbarOptions } from '@core/utils/scrollbar';
import { needsCustomScrollbar } from '@core/utils/platform';
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

  // Trigger animation on activeNode change
  useEffect(() => {
    if (activeNode) {
      setIsAnimating(true);
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

  const useCustomScrollbar = needsCustomScrollbar();

  return useCustomScrollbar ? (
    <OverlayScrollbarsComponent
      element="main"
      className="main-content"
      options={getScrollbarOptions()}
      defer
      onClick={handleContentClick}
    >
      <div className="page-root">
        <section
          id="contentCard"
          className={[
            'card',
            isLoading || isAnimating ? 'preload' : 'loaded',
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
    </OverlayScrollbarsComponent>
  ) : (
    <main className="main-content" onClick={handleContentClick}>
      <div className="page-root">
        <section
          id="contentCard"
          className={[
            'card',
            isLoading || isAnimating ? 'preload' : 'loaded',
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
