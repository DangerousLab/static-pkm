import { useNavigationStore } from '@core/state/navigationStore';
import ContentLoader from '@modules/content/ContentLoader';

/**
 * Main content area component
 * Displays the currently active content (module/page/document)
 */
function MainContent(): React.JSX.Element {
  const isLoading = useNavigationStore((state) => state.isLoading);

  return (
    <main className="main-content flex justify-center px-4 py-6">
      <div className="page-root w-full max-w-[980px]">
        <section
          id="contentCard"
          className={`card rounded-lg bg-gradient-card p-6 shadow-lg transition-opacity duration-slow ${
            isLoading ? 'card-preload opacity-0' : 'card-loaded opacity-100'
          }`}
        >
          <ContentLoader />
        </section>
      </div>
    </main>
  );
}

export default MainContent;
