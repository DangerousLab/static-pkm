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
  },
  windowSize: { width: number; height: number },
  prefs: UserLayoutPrefs
): LayoutGeometry {
  // 1. Apply font scale to sidebar width
  const scaledSidebarWidth = prefs.sidebarWidth * platform.fontScale;
  const clampedSidebarWidth = Math.min(
    Math.max(scaledSidebarWidth, config.minSidebarWidth),
    config.maxSidebarWidth
  );

  // 2. Resolve actual sidebar width
  const sidebarWidth = prefs.sidebarCollapsed ? 0 : clampedSidebarWidth;

  // 3. Resolve right panel
  const rightPanelWidth = prefs.rightPanelOpen ? prefs.rightPanelWidth : 0;

  // 4. Compute safe areas
  const safeTop = platform.safeAreaInsets.top + config.headerHeight;
  const safeBottom = platform.safeAreaInsets.bottom + config.statusBarHeight;

  // 5. Compute editor pane
  // MANDATE: Sidebar is an OVERLAY. editorLeft remains 0 so content doesn't shift.
  const editorLeft = 0;
  const editorWidth = Math.max(windowSize.width - editorLeft - rightPanelWidth, 320);

  // 6. Build cssVariables map
  const prefix = '--layout';
  const cssVariables: Record<string, string> = {
    [`${prefix}-header-height`]: `${config.headerHeight}px`,
    [`${prefix}-sidebar-width`]: `${sidebarWidth}px`,
    [`${prefix}-sidebar-collapsed`]: prefs.sidebarCollapsed ? '1' : '0',
    [`${prefix}-editor-left`]: `${editorLeft}px`,
    [`${prefix}-editor-width`]: `${editorWidth}px`,
    [`${prefix}-right-panel-width`]: `${rightPanelWidth}px`,
    [`${prefix}-safe-top`]: `${safeTop}px`,
    [`${prefix}-safe-bottom`]: `${safeBottom}px`,
    [`${prefix}-status-bar-height`]: `${config.statusBarHeight}px`,
  };

  // 7. Return LayoutGeometry
  return {
    headerHeight: config.headerHeight,
    sidebarWidth,
    sidebarCollapsed: prefs.sidebarCollapsed,
    editorLeft,
    editorWidth,
    rightPanelWidth,
    safeTop,
    safeBottom,
    statusBarHeight: config.statusBarHeight,
    cssVariables,
  };
}
