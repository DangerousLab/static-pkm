import { useCallback } from 'react';
import { useNavigationStore } from '@core/state/navigationStore';
import { useVaultStore } from '@core/state/vaultStore';
import { isTauriContext, getNavigationTree } from '@core/ipc/commands';
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
  const setRefreshing = useNavigationStore((state) => state.setRefreshing);
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
   * In Tauri mode: Always regenerate from filesystem via IPC
   * In PWA mode: Fetch pre-generated tree.json
   * Preserves activeNode if it still exists in the new tree
   */
  const loadNavigationTree = useCallback(async (): Promise<void> => {
    // Determine if this is initial load or background refresh
    const isInitialLoad = useNavigationStore.getState().navigationTree === null;

    if (isInitialLoad) {
      setLoading(true);
      console.log('[INFO] [useNavigation] Initial navigation tree load...');
    } else {
      setRefreshing(true);
      console.log('[INFO] [useNavigation] Refreshing navigation tree (silent)...');
    }

    // Capture current activeNode BEFORE loading
    const previousActiveNode = useNavigationStore.getState().activeNode;

    try {
      let tree: FolderNode;

      if (isTauriContext()) {
        // TAURI MODE: Always regenerate from filesystem via IPC
        const currentVault = useVaultStore.getState().currentVault;
        if (!currentVault?.path) {
          throw new Error('No vault path configured');
        }
        tree = await getNavigationTree(currentVault.path);
        console.log('[INFO] [useNavigation] Generated tree from filesystem');
      } else {
        // PWA MODE: Fetch pre-generated tree.json (read-only)
        const response = await fetch('./data/tree.json');
        if (!response.ok) {
          throw new Error('Failed to load navigation tree');
        }
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error('tree.json returned non-JSON response');
        }
        tree = (await response.json()) as FolderNode;
        console.log('[INFO] [useNavigation] Loaded tree.json for PWA');
      }

      setNavigationTree(tree);
      setCurrentFolder(tree);

      // Preserve activeNode if it still exists in new tree
      if (previousActiveNode) {
        const preserved = findNodeById(tree, previousActiveNode.id);
        if (preserved) {
          console.log('[INFO] [useNavigation] Preserved activeNode:', preserved.id);
          // Only update if node ID changed (prevents animation trigger)
          // Skip setActiveNode - the previous reference is still valid for rendering
          // The tree update will re-render sidebar, but editor stays stable
          if (isInitialLoad) {
            setLoading(false);
          } else {
            setRefreshing(false);
          }
          return;
        }
        console.log('[WARN] [useNavigation] Previous activeNode no longer exists');
      }

      // Fallback: Open first content node (only on initial load)
      if (isInitialLoad) {
        const firstContent = findFirstContent(tree);
        if (firstContent) {
          setActiveNode(firstContent);
        }
      }

      if (isInitialLoad) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load navigation tree';
      console.error('[ERROR] [useNavigation]', message);
      setError(message);
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, [setNavigationTree, setCurrentFolder, setActiveNode, setLoading, setRefreshing, setError]);

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
 * Find a content node by ID in the tree
 */
function findNodeById(node: NavigationNode, targetId: string): ContentNode | null {
  if (isContentNode(node) && node.id === targetId) {
    return node;
  }

  if (isFolderNode(node)) {
    for (const child of node.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }

  return null;
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
