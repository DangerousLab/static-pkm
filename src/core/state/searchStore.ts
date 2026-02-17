import { create } from 'zustand';
import type { ContentNode } from '@/types/navigation';

/** Search index item */
export interface SearchIndexItem {
  id: string;
  title: string;
  path: string;
  type: 'module' | 'page' | 'document';
  tags: string[];
  node: ContentNode;
}

/** Search result with score */
export interface SearchResultItem extends SearchIndexItem {
  score: number;
}

/** Search store state interface */
interface SearchState {
  /** Search query */
  query: string;
  /** Search index (built from navigation tree) */
  index: SearchIndexItem[];
  /** Search results */
  results: SearchResultItem[];
  /** Selected result index for keyboard navigation */
  selectedIndex: number;
  /** Whether search is focused */
  isFocused: boolean;

  /** Actions */
  setQuery: (query: string) => void;
  setIndex: (index: SearchIndexItem[]) => void;
  setResults: (results: SearchResultItem[]) => void;
  setSelectedIndex: (index: number) => void;
  setFocused: (focused: boolean) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  clearSearch: () => void;
}

/**
 * Search store
 * Manages search query, index, and results
 */
export const useSearchStore = create<SearchState>()((set, get) => ({
  query: '',
  index: [],
  results: [],
  selectedIndex: -1,
  isFocused: false,

  setQuery: (query: string) => {
    console.log('[INFO] [searchStore] Query updated:', query);
    set({ query, selectedIndex: query ? 0 : -1 });
  },

  setIndex: (index: SearchIndexItem[]) => {
    console.log('[INFO] [searchStore] Index rebuilt:', index.length, 'items');
    set({ index });
  },

  setResults: (results: SearchResultItem[]) => {
    set({ results, selectedIndex: results.length > 0 ? 0 : -1 });
  },

  setSelectedIndex: (selectedIndex: number) => set({ selectedIndex }),

  setFocused: (isFocused: boolean) => set({ isFocused }),

  selectNext: () => {
    const { results, selectedIndex } = get();
    if (results.length === 0) return;
    const newIndex = selectedIndex < results.length - 1 ? selectedIndex + 1 : 0;
    set({ selectedIndex: newIndex });
  },

  selectPrevious: () => {
    const { results, selectedIndex } = get();
    if (results.length === 0) return;
    const newIndex = selectedIndex > 0 ? selectedIndex - 1 : results.length - 1;
    set({ selectedIndex: newIndex });
  },

  clearSearch: () => {
    console.log('[INFO] [searchStore] Search cleared');
    set({ query: '', results: [], selectedIndex: -1 });
  },
}));
