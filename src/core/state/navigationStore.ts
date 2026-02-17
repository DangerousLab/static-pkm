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
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;

  /** Actions */
  setNavigationTree: (tree: FolderNode) => void;
  setCurrentFolder: (folder: FolderNode) => void;
  setActiveNode: (node: ContentNode | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/** Initial state */
const initialState = {
  navigationTree: null,
  currentFolder: null,
  activeNode: null,
  isLoading: false,
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
    set({ navigationTree: tree, error: null });
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

  setError: (error: string | null) => {
    if (error) {
      console.error('[ERROR] [navigationStore]', error);
    }
    set({ error, isLoading: false });
  },

  reset: () => {
    console.log('[INFO] [navigationStore] State reset');
    set(initialState);
  },
}));

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
