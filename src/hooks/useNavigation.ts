import { useEffect, useCallback } from 'react';
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
   * Uses Tauri IPC in native mode, fetches tree.json in PWA mode
   */
  const loadNavigationTree = useCallback(async (): Promise<void> => {
    setLoading(true);
    console.log('[INFO] [useNavigation] Loading navigation tree...');

    try {
      let tree: FolderNode;

      if (isTauriContext()) {
        // Native mode: Use Tauri IPC
        const { getNavigationTree } = await import('@core/ipc/commands');
        tree = await getNavigationTree('./Home');
      } else {
        // PWA mode: Fetch tree.json
        const response = await fetch('./javascript/tree.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch tree.json: ${response.statusText}`);
        }
        tree = await response.json() as FolderNode;
      }

      setNavigationTree(tree);
      setCurrentFolder(tree);

      // Open first content node if available
      const firstContent = findFirstContent(tree);
      if (firstContent) {
        setActiveNode(firstContent);
      }

      console.log('[INFO] [useNavigation] Navigation tree loaded successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load navigation tree';
      console.error('[ERROR] [useNavigation]', message);
      setError(message);
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
