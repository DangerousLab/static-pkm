import { useEffect } from 'react';
import AppShell from '@components/layout/AppShell';
import { useNavigation } from '@hooks/useNavigation';
import { useKeyboardShortcuts } from '@hooks/useKeyboardShortcuts';
import { useThemeEffect } from '@modules/theme';
import { useThemeImages } from '@modules/theme/useThemeImages';
import { usePWA } from '@modules/pwa/usePWA';
import { CacheProgressOverlay } from '@modules/pwa/CacheProgressOverlay';
import { useFontAwesome } from '@/loaders';

/**
 * Root application component
 * Sets up theme, keyboard shortcuts, loads navigation tree, and renders the main app shell
 */
function App(): React.JSX.Element {
  const { loadNavigationTree, error } = useNavigation();
  const pwaState = usePWA();

  // Load FontAwesome icons (lazy - won't block render)
  useFontAwesome();

  // Apply theme effects (document attribute, meta color, events)
  useThemeEffect();

  // Preload theme images
  useThemeImages();

  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

  // Load navigation tree on mount
  useEffect(() => {
    loadNavigationTree();
  }, [loadNavigationTree]);

  // Conditionally inject manifest (prevent Opera GX bug)
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile || pwaState.isInstalled) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = './manifest.json';
      document.head.appendChild(link);
      console.log('[App] Manifest injected');

      return () => {
        // Cleanup on unmount
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      };
    }
  }, [pwaState.isInstalled]);

  // Show error if navigation tree fails to load
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text-main">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4 text-danger">Error Loading Application</h1>
          <p className="text-text-muted">{error}</p>
          <button
            onClick={() => loadNavigationTree()}
            className="mt-4 px-4 py-2 bg-accent-gold text-bg rounded-md hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Show cache progress overlay during PWA first install */}
      {pwaState.cacheProgress > 0 && pwaState.cacheProgress < 100 && (
        <CacheProgressOverlay
          progress={pwaState.cacheProgress}
          current={pwaState.cacheCurrent}
          total={pwaState.cacheTotal}
          url={pwaState.cacheUrl}
        />
      )}

      {/* Main app shell */}
      <AppShell />
    </>
  );
}

export default App;
