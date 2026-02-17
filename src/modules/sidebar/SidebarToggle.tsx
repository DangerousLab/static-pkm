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
      className="sidebar-toggle flex items-center gap-2 p-2 rounded-md hover:bg-bg-hover transition-colors duration-fast"
      type="button"
      aria-label="Toggle navigation"
      aria-expanded={isOpen}
    >
      {/* Hamburger icon */}
      <span className="sidebar-toggle-icon relative block w-5 h-0.5 bg-text-main">
        <span className="absolute w-full h-full bg-text-main -top-1.5" />
        <span className="absolute w-full h-full bg-text-main top-1.5" />
      </span>
      <span className="sidebar-toggle-label text-sm text-text-main hidden tablet:inline">
        Menu
      </span>
    </button>
  );
}

export default SidebarToggle;
