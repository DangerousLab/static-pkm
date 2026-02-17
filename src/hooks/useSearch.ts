import { useEffect, useMemo } from 'react';
import { useSearchStore, type SearchIndexItem, type SearchResultItem } from '@core/state/searchStore';
import { useNavigationStore } from '@core/state/navigationStore';
import type { NavigationNode, ContentNode, FolderNode } from '@/types/navigation';
import { isContentNode, isFolderNode } from '@/types/navigation';

/**
 * Score a match between text and query
 * Returns higher scores for better matches
 */
function scoreMatch(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match (highest)
  if (lowerText === lowerQuery) return 100;

  // Starts with query
  if (lowerText.startsWith(lowerQuery)) return 80;

  // Word boundary match
  const words = lowerText.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(lowerQuery)) return 60;
  }

  // Contains query
  if (lowerText.includes(lowerQuery)) return 40;

  return 0;
}

/**
 * Build search index from navigation tree
 */
function buildSearchIndex(tree: FolderNode): SearchIndexItem[] {
  const items: SearchIndexItem[] = [];

  function traverse(node: NavigationNode): void {
    if (isContentNode(node)) {
      items.push({
        id: node.id,
        title: node.title,
        path: node.path,
        type: node.type as 'module' | 'page' | 'document',
        tags: 'tags' in node && Array.isArray(node.tags) ? node.tags : [],
        node: node,
      });
    } else if (isFolderNode(node)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(tree);
  return items;
}

/**
 * Search hook
 * Builds index from navigation tree and filters based on query
 */
export function useSearch(query: string): void {
  const navigationTree = useNavigationStore((state) => state.navigationTree);
  const index = useSearchStore((state) => state.index);
  const setIndex = useSearchStore((state) => state.setIndex);
  const setResults = useSearchStore((state) => state.setResults);

  // Rebuild index when navigation tree changes
  useEffect(() => {
    if (navigationTree) {
      const newIndex = buildSearchIndex(navigationTree);
      setIndex(newIndex);
      console.log('[INFO] [useSearch] Index built with', newIndex.length, 'items');
    }
  }, [navigationTree, setIndex]);

  // Filter results when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const queryLower = query.toLowerCase().trim();
    const scored: SearchResultItem[] = [];

    for (const item of index) {
      // Score title match
      let score = scoreMatch(item.title, queryLower);

      // Boost for tag matches
      for (const tag of item.tags) {
        const tagScore = scoreMatch(tag, queryLower);
        if (tagScore > 0) {
          score = Math.max(score, tagScore - 10); // Tags slightly lower priority
        }
      }

      // Include path in search
      const pathScore = scoreMatch(item.path, queryLower);
      if (pathScore > 0) {
        score = Math.max(score, pathScore - 20); // Path lowest priority
      }

      if (score > 0) {
        scored.push({ ...item, score });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Limit results
    const results = scored.slice(0, 10);
    setResults(results);

    console.log('[INFO] [useSearch] Found', results.length, 'results for:', query);
  }, [query, index, setResults]);
}
