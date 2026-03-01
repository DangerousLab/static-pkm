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
    contentMaxWidth: number;
  },
  windowSize: { width: number; height: number },
  prefs: UserLayoutPrefs
): LayoutGeometry {
  const isMobile = windowSize.width <= 600;
  const isLandscape = windowSize.height <= 600 && windowSize.width > windowSize.height;

  // 1. Header height is the raw height of the app header element (excluding safe area)
  const headerHeight = isLandscape ? 0 : (isMobile ? 60 : config.headerHeight);
  
  // 2. Resolve actual sidebar width
  const scaledSidebarWidth = prefs.sidebarWidth * platform.fontScale;
  const clampedSidebarWidth = Math.min(
    Math.max(scaledSidebarWidth, config.minSidebarWidth),
    config.maxSidebarWidth
  );
  const sidebarWidth = prefs.sidebarCollapsed ? 0 : clampedSidebarWidth;

  // 3. Resolve right panel
  const rightPanelWidth = (isMobile || isLandscape) ? 0 : (prefs.rightPanelOpen ? prefs.rightPanelWidth : 0);

  // 4. Compute safe areas
  const safeTop = headerHeight + platform.safeAreaInsets.top;
  const aestheticGap = 8;
  const safeBottom = platform.safeAreaInsets.bottom + aestheticGap;

  // 5. Compute editor pane
  const editorLeft = 0;
  const availableWidth = windowSize.width - editorLeft - rightPanelWidth - (isLandscape ? (platform.safeAreaInsets.left + platform.safeAreaInsets.right) : 0);
  
  // MANDATE: editorWidth MUST reflect the actual text-wrap width (page-root max-width)
  const editorWidth = Math.min(Math.max(availableWidth, 320), config.contentMaxWidth);

  // 6. Build cssVariables map
  const prefix = '--layout';
  const cssVariables: Record<string, string> = {
    [`${prefix}-header-height`]: `${headerHeight}px`,
    [`${prefix}-sidebar-width`]: `${sidebarWidth}px`,
    [`${prefix}-sidebar-collapsed`]: prefs.sidebarCollapsed ? '1' : '0',
    [`${prefix}-editor-left`]: `${editorLeft}px`,
    [`${prefix}-editor-width`]: `${editorWidth}px`,
    [`${prefix}-content-max-width`]: `${config.contentMaxWidth}px`,
    [`${prefix}-right-panel-width`]: `${rightPanelWidth}px`,
    [`${prefix}-safe-top`]: `${safeTop}px`,
    [`${prefix}-safe-bottom`]: `${safeBottom}px`,
    [`${prefix}-status-bar-height`]: `${config.statusBarHeight}px`,
    [`${prefix}-is-mobile`]: isMobile ? '1' : '0',
    [`${prefix}-is-landscape`]: isLandscape ? '1' : '0',
  };

  // 7. Return LayoutGeometry
  return {
    headerHeight,
    sidebarWidth,
    sidebarCollapsed: prefs.sidebarCollapsed,
    editorLeft,
    editorWidth,
    contentMaxWidth: config.contentMaxWidth,
    rightPanelWidth,
    landscapeLeftBarWidth: isLandscape ? 44 : 0,
    isMobile,
    isLandscape,
    safeTop,
    safeBottom,
    statusBarHeight: config.statusBarHeight,
    cssVariables,
  };
}
