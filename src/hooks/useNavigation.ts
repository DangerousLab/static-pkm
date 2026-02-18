import { useCallback } from 'react';
import { useNavigationStore } from '@core/state/navigationStore';
import { isTauriContext } from '@core/ipc/commands';
import type { FolderNode, ContentNode, NavigationNode } from '@/types/navigation';
import { isFolderNode, isContentNode } from '@/types/navigation';

/**
 * Hook for managing navigation state and loading navigation tree
 */
export function useNavigation(): {
  navigationTree: FolderNode | null;
  currentFolder: FolderNode | null;
  activeNode: ContentNode | null;
  isLoading: boolean;
  error: string | null;
  navigateToFolder: (folder: FolderNode) => void;
  openContent: (node: ContentNode) => void;
  loadNavigationTree: () => Promise<void>;
} {
  const navigationTree = useNavigationStore((state) => state.navigationTree);
  const currentFolder = useNavigationStore((state) => state.currentFolder);
  const activeNode = useNavigationStore((state) => state.activeNode);
  const isLoading = useNavigationStore((state) => state.isLoading);
  const error = useNavigationStore((state) => state.error);
  const setNavigationTree = useNavigationStore((state) => state.setNavigationTree);
  const setCurrentFolder = useNavigationStore((state) => state.setCurrentFolder);
  const setActiveNode = useNavigationStore((state) => state.setActiveNode);
  const setLoading = useNavigationStore((state) => state.setLoading);
  const setError = useNavigationStore((state) => state.setError);

  /**
   * Navigate to a folder
   */
  const navigateToFolder = useCallback(
    (folder: FolderNode): void => {
      console.log('[INFO] [useNavigation] Navigating to folder:', folder.path);
      setCurrentFolder(folder);
    },
    [setCurrentFolder]
  );

  /**
   * Open a content node (module/page/document)
   */
  const openContent = useCallback(
    (node: ContentNode): void => {
      console.log('[INFO] [useNavigation] Opening content:', node.id);
      setActiveNode(node);
    },
    [setActiveNode]
  );

  /**
   * Load navigation tree from source
   * Always uses tree.json which has proper titles from build step
   */
  const loadNavigationTree = useCallback(async (): Promise<void> => {
    setLoading(true);
    console.log('[INFO] [useNavigation] Loading navigation tree...');

    try {
      let tree: FolderNode;

      // Try to fetch tree.json - it has correct displayNames from build step
      // Tauri build has it at ./javascript/tree.json
      // PWA build has it at ./tree.json
      // Try both locations with fallback
      let response = await fetch('./javascript/tree.json');

      if (!response.ok) {
        // Try PWA location
        response = await fetch('./tree.json');
      }

      if (response.ok) {
        // Check if response is actually JSON (not HTML fallback)
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          tree = (await response.json()) as FolderNode;
          console.log('[INFO] [useNavigation] Loaded tree.json successfully');
        } else {
          throw new Error('tree.json returned non-JSON response (likely HTML fallback)');
        }
      } else {
        console.warn('[WARN] [useNavigation] tree.json not available at either location');

        // Fall back to dynamic generation in Tauri mode
        if (isTauriContext()) {
          console.log('[INFO] [useNavigation] Falling back to Tauri IPC for tree');
          const { getNavigationTree } = await import('@core/ipc/commands');
          tree = await getNavigationTree('./Home');
        } else {
          throw new Error('Failed to load navigation tree: tree.json not available');
        }
      }

      setNavigationTree(tree);
      setCurrentFolder(tree);

      // Open first content node if available
      const firstContent = findFirstContent(tree);
      if (firstContent) {
        setActiveNode(firstContent);
      }

      setLoading(false);
      console.log('[INFO] [useNavigation] Navigation tree loaded successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load navigation tree';
      console.error('[ERROR] [useNavigation]', message);
      setError(message);
      setLoading(false);
    }
  }, [setNavigationTree, setCurrentFolder, setActiveNode, setLoading, setError]);

  return {
    navigationTree,
    currentFolder,
    activeNode,
    isLoading,
    error,
    navigateToFolder,
    openContent,
    loadNavigationTree,
  };
}

/**
 * Find the first content node in a tree
 */
function findFirstContent(node: NavigationNode): ContentNode | null {
  if (isContentNode(node)) {
    return node;
  }

  if (isFolderNode(node)) {
    for (const child of node.children) {
      const found = findFirstContent(child);
      if (found) return found;
    }
  }

  return null;
}
