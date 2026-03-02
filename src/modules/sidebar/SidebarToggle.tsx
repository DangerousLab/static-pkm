import { useSidebarStore } from '@core/state/sidebarStore';

/**
 * Sidebar toggle button component
 * Hamburger menu button that opens/closes the sidebar
 */
function SidebarToggle(): React.JSX.Element {
  const toggle = useSidebarStore((state) => state.toggle);
  const isOpen = useSidebarStore((state) => state.isOpen);

  return (
    <button
      onClick={toggle}
      className="sidebar-toggle"
      type="button"
      aria-label="Toggle navigation"
      aria-expanded={isOpen}
      data-open={isOpen}
    >
      {/* Hamburger icon */}
      <span className="sidebar-toggle-icon" />
      <span className="sidebar-toggle-label">
        Menu
      </span>
    </button>
  );
}

export default SidebarToggle;
