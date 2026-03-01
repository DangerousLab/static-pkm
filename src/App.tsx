import { useEffect } from 'react';
import AppShell from '@components/layout/AppShell';
import { useNavigation } from '@hooks/useNavigation';
import { useVault } from '@hooks/useVault';
import { useKeyboardShortcuts } from '@hooks/useKeyboardShortcuts';
import { useThemeEffect } from '@modules/theme';
import { useThemeImages } from '@modules/theme/useThemeImages';
import { usePWA } from '@modules/pwa/usePWA';
import { CacheProgressOverlay } from '@modules/pwa/CacheProgressOverlay';
import { useFontAwesome } from '@/loaders';
import { isTauriContext } from '@core/ipc/commands';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useNavigationStore } from '@core/state/navigationStore';
import { useSidebarStore } from '@core/state/sidebarStore';
import { useLayoutEngine } from '@hooks/useLayoutEngine';

/**
 * Root application component
 * Sets up theme, keyboard shortcuts, loads navigation tree, and renders the main app shell
 */
function App(): React.JSX.Element {
  const { loadNavigationTree, error } = useNavigation();
  const { initializeFromPersistedVault } = useVault();
  const pwaState = usePWA();

  const sidebarWidth = useSidebarStore((state) => state.width);
  const sidebarIsOpen = useSidebarStore((state) => state.isOpen);
  
  const { isReady: isLayoutReady } = useLayoutEngine({
    sidebarWidth,
    sidebarCollapsed: !sidebarIsOpen,
    rightPanelOpen: false,
    rightPanelWidth: 280,
  });

  // Load FontAwesome icons (lazy - won't block render)
  useFontAwesome();

  // Apply theme effects (document attribute, meta color, events)
  useThemeEffect();

  // Preload theme images
  useThemeImages();

  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

  // Listen for OS window close button in Tauri mode
  // With always-auto-save, we just close immediately (content is already saved)
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistenPromise = listen('close-requested', async () => {
      // Always allow close - auto-save handles persistence
      await invoke('force_close_window');
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Listen for file renames and update activeNode BEFORE tree refresh
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistenPromise = listen<{
      old_path: string;
      new_path: string;
      old_note_id: string;
      new_note_id: string;
    }>('file:renamed', (event) => {
      const { old_note_id, new_note_id, new_path } = event.payload;
      const { activeNode, setActiveNode } = useNavigationStore.getState();

      if (activeNode?.id === old_note_id) {
        console.log('[INFO] [App] Active file renamed:', old_note_id, '->', new_note_id);
        // Content is already saved (auto-save), just update references
        // Normalize path separators to forward slashes
        const normalizedPath = new_path.replace(/\\/g, '/');
        const homeIndex = normalizedPath.indexOf('/Home/');
        const relativePath = homeIndex >= 0 ? normalizedPath.substring(homeIndex + '/Home/'.length) : new_path;

        setActiveNode({
          ...activeNode,
          id: new_note_id,
          file: relativePath,
        });
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Listen for vault file changes and auto-refresh navigation tree
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistenPromise = listen('vault:changed', () => {
      console.log('[INFO] [App] Vault changed, refreshing navigation...');
      loadNavigationTree();
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [loadNavigationTree]);

  // Load navigation tree on mount
  // In Tauri mode: Initialize from persisted vault (if any)
  // In PWA mode: Load static tree.json
  useEffect(() => {
    if (isTauriContext()) {
      // Tauri mode - try to restore persisted vault
      initializeFromPersistedVault();
    } else {
      // PWA mode - load static tree.json
      loadNavigationTree();
    }
  }, [initializeFromPersistedVault, loadNavigationTree]);

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
