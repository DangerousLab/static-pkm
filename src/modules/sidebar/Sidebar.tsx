import { useSidebarStore } from '@core/state/sidebarStore';
import { useNavigationStore, selectBreadcrumbPath } from '@core/state/navigationStore';
import Breadcrumb from './Breadcrumb';
import NavItem from './NavItem';
import SearchBar from '@modules/search/SearchBar';
import type { NavigationNode, FolderNode } from '@/types/navigation';

/**
 * Sidebar navigation component
 * Contains search, breadcrumb, navigation items, and footer
 */
function Sidebar(): React.JSX.Element {
  const isOpen = useSidebarStore((state) => state.isOpen);
  const width = useSidebarStore((state) => state.width);
  const close = useSidebarStore((state) => state.close);

  const navigationTree = useNavigationStore((state) => state.navigationTree);
  const currentFolder = useNavigationStore((state) => state.currentFolder);
  const setCurrentFolder = useNavigationStore((state) => state.setCurrentFolder);

  // Get breadcrumb path
  const breadcrumbPath = selectBreadcrumbPath(navigationTree, currentFolder);

  // Handle back navigation
  const handleBack = (): void => {
    if (breadcrumbPath.length > 1) {
      const parentFolder = breadcrumbPath[breadcrumbPath.length - 2];
      if (parentFolder) {
        setCurrentFolder(parentFolder);
      }
    }
  };

  // Current folder children
  const children = currentFolder?.children ?? [];

  return (
    <aside
      id="sidebar"
      className={`sidebar fixed top-header-height left-0 bottom-0 z-40 flex flex-col bg-gradient-sidebar transition-transform duration-normal ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } sidebar:relative sidebar:translate-x-0 sidebar:top-0`}
      style={{ width: `${width}px` }}
      data-open={isOpen}
      aria-label="Main navigation"
    >
      {/* Search Bar */}
      <div className="sidebar-search p-3 border-b border-border-subtle">
        <SearchBar />
      </div>

      {/* Breadcrumb Navigation */}
      <div className="sidebar-header p-3 border-b border-border-subtle">
        <Breadcrumb path={breadcrumbPath} onNavigate={setCurrentFolder} onBack={handleBack} />
      </div>

      {/* Navigation Menu */}
      <nav id="sidebarNav" className="sidebar-nav flex-1 overflow-y-auto p-2">
        {children.length > 0 ? (
          <ul className="space-y-1">
            {children.map((node) => (
              <NavItem key={node.path} node={node} />
            ))}
          </ul>
        ) : (
          <p className="text-text-muted text-sm p-2">No items in this folder</p>
        )}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer p-3 border-t border-border-subtle text-text-muted text-xs">
        <div>Unstablon PKM</div>
      </div>
    </aside>
  );
}

export default Sidebar;
