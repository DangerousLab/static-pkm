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
    <div className="sidebar-breadcrumb">
      {/* Back button */}
      {canGoBack && (
        <button
          onClick={onBack}
          className="breadcrumb-back"
          type="button"
          aria-label="Go back"
        >
          ←
        </button>
      )}

      {/* Breadcrumb path */}
      {path.map((folder, index) => (
        <span key={folder.path}>
          {index > 0 && <span className="sidebar-breadcrumb-separator">/</span>}
          <button
            onClick={() => onNavigate(folder)}
            className={`sidebar-breadcrumb-part ${index === path.length - 1 ? 'current' : ''}`}
            type="button"
          >
            {folder.name}
          </button>
        </span>
      ))}
    </div>
  );
}

export default Breadcrumb;
