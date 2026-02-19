import { useRef, useCallback } from 'react';
import { useSearchStore } from '@core/state/searchStore';
import { useNavigationStore, findParentFolder } from '@core/state/navigationStore';
import SearchResults from './SearchResults';
import { useSearch } from '@hooks/useSearch';
import type { ContentNode } from '@/types/navigation';

/**
 * Search bar component
 */
function SearchBar(): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useSearchStore((state) => state.query);
  const setQuery = useSearchStore((state) => state.setQuery);
  const results = useSearchStore((state) => state.results);
  const selectedIndex = useSearchStore((state) => state.selectedIndex);
  const selectNext = useSearchStore((state) => state.selectNext);
  const selectPrevious = useSearchStore((state) => state.selectPrevious);
  const clearSearch = useSearchStore((state) => state.clearSearch);
  const isFocused = useSearchStore((state) => state.isFocused);
  const setFocused = useSearchStore((state) => state.setFocused);

  const navigationTree = useNavigationStore((state) => state.navigationTree);
  const setActiveNode = useNavigationStore((state) => state.setActiveNode);
  const setCurrentFolder = useNavigationStore((state) => state.setCurrentFolder);

  // Navigate to a search result - sets active node AND navigates to its parent folder
  const navigateToResult = useCallback(
    (node: ContentNode): void => {
      // Find and navigate to parent folder
      const parentFolder = findParentFolder(navigationTree, node);
      if (parentFolder) {
        setCurrentFolder(parentFolder);
      }
      // Set the active node
      setActiveNode(node);
    },
    [navigationTree, setCurrentFolder, setActiveNode]
  );

  // Use search hook for filtering
  useSearch(query);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectPrevious();
          break;
        case 'Enter':
          e.preventDefault();
          if (results.length > 0 && selectedIndex >= 0) {
            const selectedResult = results[selectedIndex];
            if (selectedResult) {
              navigateToResult(selectedResult.node);
              clearSearch();
              inputRef.current?.blur();
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          clearSearch();
          inputRef.current?.blur();
          break;
      }
    },
    [results, selectedIndex, selectNext, selectPrevious, navigateToResult, clearSearch]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setQuery(e.target.value);
  };

  const handleFocus = (): void => {
    setFocused(true);
  };

  const handleBlur = (): void => {
    // Delay blur to allow click on results
    requestAnimationFrame(() => {
      setFocused(false);
    });
  };

  const handleClear = (): void => {
    clearSearch();
    inputRef.current?.focus();
  };

  return (
    <div>
      <div className="search-input-wrapper">
        <span className="search-icon">
          <i className="fa-solid fa-magnifying-glass" />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search..."
          className="search-input"
          aria-label="Search"
          aria-expanded={isFocused && results.length > 0}
          aria-controls="search-results"
          role="combobox"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {/* Search results dropdown */}
      {isFocused && query && (
        <SearchResults
          results={results}
          selectedIndex={selectedIndex}
          onSelect={(node) => {
            navigateToResult(node);
            clearSearch();
          }}
        />
      )}
    </div>
  );
}

export default SearchBar;
