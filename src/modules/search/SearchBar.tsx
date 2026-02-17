import { useRef, useCallback } from 'react';
import { useSearchStore } from '@core/state/searchStore';
import { useNavigationStore } from '@core/state/navigationStore';
import SearchResults from './SearchResults';
import { useSearch } from '@hooks/useSearch';

/**
 * Search bar component
 * Input field with keyboard navigation and results dropdown
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

  const setActiveNode = useNavigationStore((state) => state.setActiveNode);

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
              setActiveNode(selectedResult.node);
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
    [results, selectedIndex, selectNext, selectPrevious, setActiveNode, clearSearch]
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

  return (
    <div className="search-container relative">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Search..."
        className="search-input w-full px-3 py-2 rounded-md bg-bg-panel border border-border-subtle text-text-main placeholder:text-text-muted focus:outline-none focus:border-accent-gold transition-colors"
        aria-label="Search"
        aria-expanded={isFocused && results.length > 0}
        aria-controls="search-results"
        role="combobox"
        autoComplete="off"
      />

      {/* Search results dropdown */}
      {isFocused && query && (
        <SearchResults
          results={results}
          selectedIndex={selectedIndex}
          onSelect={(node) => {
            setActiveNode(node);
            clearSearch();
          }}
        />
      )}
    </div>
  );
}

export default SearchBar;
