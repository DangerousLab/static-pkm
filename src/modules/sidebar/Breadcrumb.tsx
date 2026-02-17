import type { FolderNode } from '@/types/navigation';

interface BreadcrumbProps {
  /** Array of folder nodes from root to current */
  path: FolderNode[];
  /** Callback when a breadcrumb segment is clicked */
  onNavigate: (folder: FolderNode) => void;
  /** Callback for back button */
  onBack: () => void;
}

/**
 * Breadcrumb navigation component
 * Shows path from root to current folder with clickable segments
 */
function Breadcrumb({ path, onNavigate, onBack }: BreadcrumbProps): React.JSX.Element {
  const canGoBack = path.length > 1;

  return (
    <div className="sidebar-breadcrumb flex items-center gap-2">
      {/* Back button */}
      {canGoBack && (
        <button
          onClick={onBack}
          className="back-button p-1 rounded hover:bg-bg-hover transition-colors"
          type="button"
          aria-label="Go back"
        >
          <span className="text-text-muted">←</span>
        </button>
      )}

      {/* Breadcrumb path */}
      <div className="breadcrumb-path flex items-center gap-1 text-sm overflow-x-auto">
        {path.map((folder, index) => (
          <span key={folder.path} className="flex items-center">
            {index > 0 && <span className="text-text-muted mx-1">/</span>}
            <button
              onClick={() => onNavigate(folder)}
              className={`breadcrumb-segment hover:text-accent-gold transition-colors ${
                index === path.length - 1 ? 'text-text-main font-medium' : 'text-text-muted'
              }`}
              type="button"
            >
              {folder.name}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default Breadcrumb;
