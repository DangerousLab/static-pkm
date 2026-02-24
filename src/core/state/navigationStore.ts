import { create } from 'zustand';
import type { NavigationNode, FolderNode, ContentNode } from '@/types/navigation';

/** Navigation store state interface */
interface NavigationState {
  /** Full navigation tree */
  navigationTree: FolderNode | null;
  /** Currently displayed folder */
  currentFolder: FolderNode | null;
  /** Currently active content node (module/page/document) */
  activeNode: ContentNode | null;
  /** Loading state (initial load, shows loading UI) */
  isLoading: boolean;
  /** Refreshing state (background update, silent) */
  isRefreshing: boolean;
  /** Error message */
  error: string | null;

  /** Actions */
  setNavigationTree: (tree: FolderNode) => void;
  setCurrentFolder: (folder: FolderNode) => void;
  setActiveNode: (node: ContentNode | null) => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setError: (error: string | null) => void;
  updateNodeTitle: (nodeId: string, newTitle: string) => void;
  reset: () => void;
}

/** Initial state */
const initialState = {
  navigationTree: null,
  currentFolder: null,
  activeNode: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
};

/**
 * Navigation store
 * Manages navigation tree, current folder, and active content
 */
export const useNavigationStore = create<NavigationState>()((set) => ({
  ...initialState,

  setNavigationTree: (tree: FolderNode) => {
    console.log('[INFO] [navigationStore] Navigation tree loaded:', tree.name);
    // Also set currentFolder to the root so sidebar displays content
    set({ navigationTree: tree, currentFolder: tree, error: null });
  },

  setCurrentFolder: (folder: FolderNode) => {
    console.log('[INFO] [navigationStore] Navigated to folder:', folder.path);
    set({ currentFolder: folder });
  },

  setActiveNode: (node: ContentNode | null) => {
    if (node) {
      console.log('[INFO] [navigationStore] Active node set:', node.id);
    } else {
      console.log('[INFO] [navigationStore] Active node cleared');
    }
    set({ activeNode: node });
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),

  setRefreshing: (isRefreshing: boolean) => set({ isRefreshing }),

  setError: (error: string | null) => {
    if (error) {
      console.error('[ERROR] [navigationStore]', error);
    }
    set({ error, isLoading: false, isRefreshing: false });
  },

  updateNodeTitle: (nodeId: string, newTitle: string) => {
    set((state) => {
      if (!state.navigationTree) return state;

      // Deep clone tree and update node title
      const updatedTree = updateNodeTitleInTree(state.navigationTree, nodeId, newTitle);

      // Update currentFolder reference to get fresh children (for sidebar display)
      // Find the folder with same path in the updated tree
      let updatedCurrentFolder = state.currentFolder;
      if (state.currentFolder) {
        updatedCurrentFolder = findFolderByPath(updatedTree, state.currentFolder.path);
      }

      // Also update activeNode title if it's the same node
      // This is safe now because Sidebar tracks ID changes, not reference changes
      let updatedActiveNode = state.activeNode;
      if (state.activeNode?.id === nodeId) {
        updatedActiveNode = { ...state.activeNode, title: newTitle };
      }

      console.log('[INFO] [navigationStore] Updated node title:', nodeId, '->', newTitle);

      return {
        navigationTree: updatedTree,
        currentFolder: updatedCurrentFolder ?? state.currentFolder,
        activeNode: updatedActiveNode,
      };
    });
  },

  reset: () => {
    console.log('[INFO] [navigationStore] State reset');
    set(initialState);
  },
}));

/**
 * Helper: Update title of a node in the tree (immutable)
 */
function updateNodeTitleInTree(
  node: FolderNode,
  targetId: string,
  newTitle: string
): FolderNode {
  return {
    ...node,
    children: node.children.map((child) => {
      if (child.type !== 'folder' && child.id === targetId) {
        return { ...child, title: newTitle };
      }
      if (child.type === 'folder') {
        return updateNodeTitleInTree(child, targetId, newTitle);
      }
      return child;
    }),
  };
}

/**
 * Helper: Find a folder by path in the tree
 */
function findFolderByPath(tree: FolderNode, targetPath: string): FolderNode | null {
  if (tree.path === targetPath) return tree;
  for (const child of tree.children) {
    if (child.type === 'folder') {
      const found = findFolderByPath(child, targetPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Selector: Get breadcrumb path from root to current folder
 */
export function selectBreadcrumbPath(
  tree: FolderNode | null,
  currentFolder: FolderNode | null
): FolderNode[] {
  if (!tree || !currentFolder) return [];

  const path: FolderNode[] = [];

  function findPath(node: NavigationNode, target: FolderNode): boolean {
    if (node.type !== 'folder') return false;

    if (node.path === target.path) {
      path.push(node);
      return true;
    }

    for (const child of node.children) {
      if (findPath(child, target)) {
        path.unshift(node);
        return true;
      }
    }

    return false;
  }

  findPath(tree, currentFolder);
  return path;
}

/**
 * Find the parent folder of a content node
 * Returns the folder that contains the given node
 */
export function findParentFolder(
  tree: FolderNode | null,
  node: ContentNode
): FolderNode | null {
  if (!tree || !node.file) return tree;

  // Get parent path from node's file path
  const pathParts = node.file.split('/');
  if (pathParts.length <= 1) return tree;

  const parentPath = pathParts.slice(0, -1).join('/');

  function findFolderByPath(folder: FolderNode, targetPath: string): FolderNode | null {
    if (folder.path === targetPath) return folder;

    for (const child of folder.children) {
      if (child.type === 'folder') {
        const found = findFolderByPath(child, targetPath);
        if (found) return found;
      }
    }

    return null;
  }

  return findFolderByPath(tree, parentPath) ?? tree;
}
