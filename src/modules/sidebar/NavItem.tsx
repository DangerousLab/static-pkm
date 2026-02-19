import { useNavigationStore } from '@core/state/navigationStore';
import type { NavigationNode } from '@/types/navigation';
import { isFolderNode, isContentNode, getNodeDisplayName } from '@/types/navigation';

interface NavItemProps {
  node: NavigationNode;
}

/**
 * Individual navigation item component
 * Uses original CSS class names for consistent styling
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

  // Get FontAwesome icon class based on node type
  const getIconClass = (): string => {
    switch (node.type) {
      case 'folder':
        return 'fa-solid fa-folder';
      case 'module':
        return 'fa-solid fa-bolt';
      case 'page':
        return 'fa-solid fa-file';
      case 'document':
        return 'fa-solid fa-file-lines';
      default:
        return 'fa-solid fa-file';
    }
  };

  // Get display name using helper function
  const displayName = getNodeDisplayName(node);

  return (
    <button
      onClick={handleClick}
      className={`nav-item ${isActive ? 'active' : ''}`}
      type="button"
    >
      <span className="nav-icon">
        <i className={getIconClass()} />
      </span>
      <span className="nav-label">{displayName}</span>
      {isFolderNode(node) && (
        <span className="nav-arrow">→</span>
      )}
    </button>
  );
}

export default NavItem;
