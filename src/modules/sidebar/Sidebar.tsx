import { useEffect, useCallback, useState, useRef } from 'react';
import { useSidebarStore } from '@core/state/sidebarStore';
import { useNavigationStore, selectBreadcrumbPath } from '@core/state/navigationStore';
import { useIsMobile, useShouldAutoCloseSidebar } from '@hooks/useWindowSize';
import { getNodeId } from '@/types/navigation';
import Breadcrumb from './Breadcrumb';
import NavItem from './NavItem';
import SearchBar from '@modules/search/SearchBar';

/**
 * Sidebar navigation component
 */
function Sidebar(): React.JSX.Element {
  const isOpen = useSidebarStore((state) => state.isOpen);
  const width = useSidebarStore((state) => state.width);
  const hoverNeeded = useSidebarStore((state) => state.hoverNeeded);
  const hoverWidth = useSidebarStore((state) => state.hoverWidth);
  const setWidth = useSidebarStore((state) => state.setWidth);
  const setHoverNeeded = useSidebarStore((state) => state.setHoverNeeded);
  const setHoverWidth = useSidebarStore((state) => state.setHoverWidth);
  const close = useSidebarStore((state) => state.close);

  const navigationTree = useNavigationStore((state) => state.navigationTree);
  const currentFolder = useNavigationStore((state) => state.currentFolder);
  const setCurrentFolder = useNavigationStore((state) => state.setCurrentFolder);
  const activeNode = useNavigationStore((state) => state.activeNode);

  const isMobile = useIsMobile();
  const shouldAutoClose = useShouldAutoCloseSidebar();
  const [isHovering, setIsHovering] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Get breadcrumb path
  const breadcrumbPath = selectBreadcrumbPath(navigationTree, currentFolder);

  // Handle back navigation
  const handleBack = useCallback((): void => {
    if (breadcrumbPath.length > 1) {
      const parentFolder = breadcrumbPath[breadcrumbPath.length - 2];
      if (parentFolder) {
        setCurrentFolder(parentFolder);
      }
    }
  }, [breadcrumbPath, setCurrentFolder]);

  // Auto-close sidebar when content changes (if viewport requires it)
  // This handles nav item clicks that select a module/page/document
  useEffect(() => {
    if (isOpen && shouldAutoClose && activeNode) {
      close();
    }
  }, [activeNode]); // Only depend on activeNode to avoid loops

  // Handle click outside to close (overlay for narrow viewports)
  // Note: This is defined but not currently used - preserved for future use
  // @ts-expect-error - Unused but preserved for future overlay click handling
  const handleOverlayClick = useCallback((): void => {
    if (isOpen && shouldAutoClose) {
      close();
    }
  }, [isOpen, shouldAutoClose, close]);

  // Current folder children
  const children = currentFolder?.children ?? [];

  // Calculate sidebar width based on content
  // Runs when folder changes OR when sidebar opens
  useEffect(() => {
    if (!sidebarRef.current || !navRef.current || isMobile || !isOpen) return;

    // Use requestAnimationFrame to ensure DOM is fully rendered before measuring
    const measureAndCalculate = (): void => {
      if (!navRef.current) return;

      const navItems = navRef.current.querySelectorAll('.nav-label');
      let maxScrollWidth = 0;

      navItems.forEach((item) => {
        const el = item as HTMLElement;
        if (el.scrollWidth > maxScrollWidth) {
          maxScrollWidth = el.scrollWidth;
        }
      });

      // Calculate widths: scrollWidth + icon (24px) + padding (56px) + buffer (20px)
      const calculatedWidth = maxScrollWidth + 100;
      const baseWidth = Math.min(Math.max(calculatedWidth, 240), 320);
      setWidth(baseWidth);

      // Check if content needs more space than base width allows
      const needsHover = calculatedWidth > baseWidth;

      if (needsHover) {
        // Calculate hover width to fit all content
        const expandedWidth = maxScrollWidth + 120;
        setHoverNeeded(true);
        setHoverWidth(expandedWidth);
      } else {
        setHoverNeeded(false);
      }
    };

    // Wait for next frame to ensure items are rendered
    const frameId = requestAnimationFrame(measureAndCalculate);
    return () => cancelAnimationFrame(frameId);
  }, [currentFolder, isMobile, isOpen, setWidth, setHoverNeeded, setHoverWidth]);

  // Handle mouse enter for hover expansion
  const handleMouseEnter = useCallback((): void => {
    if (!isMobile && isOpen) {
      setIsHovering(true);
    }
  }, [isMobile, isOpen]);

  // Handle mouse leave
  const handleMouseLeave = useCallback((): void => {
    setIsHovering(false);
  }, []);

  // Calculate current width (hover or base)
  // If hovering AND hoverNeeded, use hoverWidth; otherwise use base width
  const currentWidth = isHovering && hoverNeeded ? hoverWidth : width;

  return (
    <>
      <aside
        ref={sidebarRef}
        id="sidebar"
        className="sidebar"
        style={!isMobile ? { width: `${currentWidth}px` } : undefined}
        data-open={isOpen}
        aria-label="Main navigation"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Search Bar Section */}
        <div className="sidebar-search">
          <SearchBar />
        </div>

        {/* Breadcrumb Navigation */}
        <div className="sidebar-header">
          <Breadcrumb path={breadcrumbPath} onNavigate={setCurrentFolder} onBack={handleBack} />
        </div>

        {/* Navigation Menu */}
        <nav ref={navRef} id="sidebarNav" className="sidebar-nav">
          {children.length > 0 ? (
            children.map((node) => (
              <NavItem key={getNodeId(node)} node={node} />
            ))
          ) : (
            <p className="empty-folder-message">
              No items in this folder
            </p>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-content">
            <span>Unstablon PKM</span>
            <span className="version">v2.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
