import { useEffect } from 'react';
import AppShell from '@components/layout/AppShell';
import { useThemeStore } from '@core/state/themeStore';
import { useNavigation } from '@hooks/useNavigation';

/**
 * Root application component
 * Sets up theme, loads navigation tree, and renders the main app shell
 */
function App(): React.JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  const { loadNavigationTree, error } = useNavigation();

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    // Update meta theme-color for mobile
    const metaThemeColor = document.getElementById('theme-color-meta');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#1f1f1f' : '#f3f4f6');
    }

    console.log('[INFO] [App] Theme applied:', theme);
  }, [theme]);

  // Load navigation tree on mount
  useEffect(() => {
    loadNavigationTree();
  }, [loadNavigationTree]);

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

  return <AppShell />;
}

export default App;
