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

  // Get display name using helper function
  const displayName = getNodeDisplayName(node);

  return (
    <button
      onClick={handleClick}
      className={`nav-item ${isActive ? 'active' : ''}`}
      type="button"
    >
      <span className="nav-icon">{getIcon()}</span>
      <span className="nav-label">{displayName}</span>
      {isFolderNode(node) && (
        <span className="nav-arrow">→</span>
      )}
    </button>
  );
}

export default NavItem;
