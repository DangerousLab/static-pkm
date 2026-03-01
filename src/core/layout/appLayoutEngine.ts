import type { PlatformInfo, LayoutGeometry, UserLayoutPrefs } from '../../types/layout';

export function computeLayout(
  platform: PlatformInfo,
  config: {
    defaultSidebarWidth: number;
    minSidebarWidth: number;
    maxSidebarWidth: number;
    headerHeight: number;
    statusBarHeight: number;
    rightPanelDefaultWidth: number;
    landscapeLeftBarWidth: number;
  },
  windowSize: { width: number; height: number },
  prefs: UserLayoutPrefs
): LayoutGeometry {
  const isMobile = windowSize.width <= 600;
  const isLandscape = windowSize.height <= 600 && windowSize.width > windowSize.height;

  // 1. Header height is the raw height of the app header element (excluding safe area)
  // In landscape, the header is hidden (height 0).
  const headerHeight = isLandscape ? 0 : (isMobile ? 60 : config.headerHeight);
  
  // 2. Landscape Left Bar
  const landscapeLeftBarWidth = isLandscape ? config.landscapeLeftBarWidth : 0;

  // 3. Resolve actual sidebar width
  const scaledSidebarWidth = prefs.sidebarWidth * platform.fontScale;
  const clampedSidebarWidth = Math.min(
    Math.max(scaledSidebarWidth, config.minSidebarWidth),
    config.maxSidebarWidth
  );
  const sidebarWidth = prefs.sidebarCollapsed ? 0 : clampedSidebarWidth;

  // 4. Resolve right panel
  const rightPanelWidth = (isMobile || isLandscape) ? 0 : (prefs.rightPanelOpen ? prefs.rightPanelWidth : 0);

  // 5. Compute safe areas
  // safeTop is the Y-coordinate where the content area (and sidebar) begins.
  // In landscape, it's just the OS top inset (notch).
  const safeTop = headerHeight + platform.safeAreaInsets.top;
  
  const aestheticGap = 8;
  const safeBottom = platform.safeAreaInsets.bottom + aestheticGap;

  // 6. Compute editor pane
  // In landscape, content starts after the landscape left bar and safe area left (notch).
  const editorLeft = isLandscape ? (landscapeLeftBarWidth + platform.safeAreaInsets.left) : 0;
  
  // editorWidth is total width minus horizontal safe areas and panels.
  const editorWidth = Math.max(
    windowSize.width - editorLeft - rightPanelWidth - (isLandscape ? platform.safeAreaInsets.right : 0),
    320
  );

  // 7. Build cssVariables map
  const prefix = '--layout';
  const cssVariables: Record<string, string> = {
    [`${prefix}-header-height`]: `${headerHeight}px`,
    [`${prefix}-sidebar-width`]: `${sidebarWidth}px`,
    [`${prefix}-sidebar-collapsed`]: prefs.sidebarCollapsed ? '1' : '0',
    [`${prefix}-editor-left`]: `${editorLeft}px`,
    [`${prefix}-editor-width`]: `${editorWidth}px`,
    [`${prefix}-right-panel-width`]: `${rightPanelWidth}px`,
    [`${prefix}-landscape-leftbar-width`]: `${landscapeLeftBarWidth}px`,
    [`${prefix}-safe-top`]: `${safeTop}px`,
    [`${prefix}-safe-bottom`]: `${safeBottom}px`,
    [`${prefix}-status-bar-height`]: `${config.statusBarHeight}px`,
    [`${prefix}-is-mobile`]: isMobile ? '1' : '0',
    [`${prefix}-is-landscape`]: isLandscape ? '1' : '0',
  };

  // 8. Return LayoutGeometry
  return {
    headerHeight,
    sidebarWidth,
    sidebarCollapsed: prefs.sidebarCollapsed,
    editorLeft,
    editorWidth,
    rightPanelWidth,
    landscapeLeftBarWidth,
    isMobile,
    isLandscape,
    safeTop,
    safeBottom,
    statusBarHeight: config.statusBarHeight,
    cssVariables,
  };
}
