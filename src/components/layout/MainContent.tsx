import { useCallback } from 'react';
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
  const isOpen = useSidebarStore((state) => state.isOpen);
  const close = useSidebarStore((state) => state.close);
  const shouldAutoClose = useShouldAutoCloseSidebar();

  // Close sidebar when clicking on content area (if viewport requires it)
  const handleContentClick = useCallback((): void => {
    if (isOpen && shouldAutoClose) {
      close();
    }
  }, [isOpen, shouldAutoClose, close]);

  return (
    <main className="main-content" onClick={handleContentClick}>
      <div className="page-root">
        <section
          id="contentCard"
          className={`card ${isLoading ? 'preload' : 'loaded'}`}
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
