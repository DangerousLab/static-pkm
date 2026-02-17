import type { SearchResultItem } from '@core/state/searchStore';
import type { ContentNode } from '@/types/navigation';

interface SearchResultsProps {
  results: SearchResultItem[];
  selectedIndex: number;
  onSelect: (node: ContentNode) => void;
}

/**
 * Search results dropdown component
 * Displays filtered results with keyboard navigation support
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
        className="search-results absolute top-full left-0 right-0 mt-1 rounded-md bg-bg-card border border-border-subtle shadow-lg z-50"
        role="listbox"
      >
        <div className="p-3 text-text-muted text-sm">No results found</div>
      </div>
    );
  }

  return (
    <ul
      id="search-results"
      className="search-results absolute top-full left-0 right-0 mt-1 rounded-md bg-bg-card border border-border-subtle shadow-lg z-50 max-h-64 overflow-y-auto"
      role="listbox"
    >
      {results.map((result, index) => (
        <li
          key={result.id}
          role="option"
          aria-selected={index === selectedIndex}
          className={`search-result-item px-3 py-2 cursor-pointer transition-colors ${
            index === selectedIndex
              ? 'bg-bg-highlight text-accent-gold'
              : 'hover:bg-bg-hover text-text-main'
          }`}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent blur before click
            onSelect(result.node);
          }}
        >
          <div className="flex items-center gap-2">
            <span className="result-icon">
              {result.type === 'module' ? '⚡' : result.type === 'page' ? '📄' : '📝'}
            </span>
            <div className="result-content flex-1 min-w-0">
              <div className="result-title truncate font-medium">{result.title}</div>
              <div className="result-path text-xs text-text-muted truncate">{result.path}</div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default SearchResults;
