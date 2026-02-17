import { useNavigationStore } from '@core/state/navigationStore';
import type { NavigationNode, FolderNode, ContentNode } from '@/types/navigation';
import { isFolderNode, isContentNode } from '@/types/navigation';

interface NavItemProps {
  node: NavigationNode;
}

/**
 * Individual navigation item component
 * Renders folder or content item with appropriate icon and click handler
 */
function NavItem({ node }: NavItemProps): React.JSX.Element {
  const setCurrentFolder = useNavigationStore((state) => state.setCurrentFolder);
  const setActiveNode = useNavigationStore((state) => state.setActiveNode);
  const activeNode = useNavigationStore((state) => state.activeNode);

  const isActive = activeNode && isContentNode(node) && activeNode.id === node.id;

  const handleClick = (): void => {
    if (isFolderNode(node)) {
      setCurrentFolder(node);
    } else if (isContentNode(node)) {
      setActiveNode(node);
    }
  };

  // Get icon based on node type
  const getIcon = (): string => {
    switch (node.type) {
      case 'folder':
        return '📁';
      case 'module':
        return '⚡';
      case 'page':
        return '📄';
      case 'document':
        return '📝';
      default:
        return '📄';
    }
  };

  // Get display name
  const displayName = isFolderNode(node) ? node.name : node.title;

  return (
    <li>
      <button
        onClick={handleClick}
        className={`nav-item w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors duration-fast ${
          isActive
            ? 'bg-bg-highlight text-accent-gold'
            : 'text-text-main hover:bg-bg-hover'
        }`}
        type="button"
      >
        <span className="nav-item-icon">{getIcon()}</span>
        <span className="nav-item-label truncate">{displayName}</span>
        {isFolderNode(node) && (
          <span className="nav-item-arrow ml-auto text-text-muted">→</span>
        )}
      </button>
    </li>
  );
}

export default NavItem;
