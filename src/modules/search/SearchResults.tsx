import type { SearchResultItem } from '@core/state/searchStore';
import type { ContentNode } from '@/types/navigation';

interface SearchResultsProps {
  results: SearchResultItem[];
  selectedIndex: number;
  onSelect: (node: ContentNode) => void;
}

/**
 * Search results dropdown component
 */
function SearchResults({
  results,
  selectedIndex,
  onSelect,
}: SearchResultsProps): React.JSX.Element {
  if (results.length === 0) {
    return (
      <div
        id="search-results"
        className="search-results"
        role="listbox"
      >
        <div className="search-no-results">
          No results found
        </div>
      </div>
    );
  }

  return (
    <div
      id="search-results"
      className="search-results"
      role="listbox"
    >
      {results.map((result, index) => (
        <div
          key={result.id}
          role="option"
          aria-selected={index === selectedIndex}
          className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent blur before click
            onSelect(result.node);
          }}
        >
          <div className="search-result-icon">
            {result.type === 'module' ? '⚡' : result.type === 'page' ? '📄' : '📝'}
          </div>
          <div>
            <div className="search-result-title">{result.title}</div>
            <div className="search-result-path">{result.path}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SearchResults;
