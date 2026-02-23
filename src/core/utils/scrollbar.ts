/**
 * Custom scrollbar utilities for macOS Tauri.
 *
 * macOS WKWebView ignores ::-webkit-scrollbar CSS, so we use OverlayScrollbars.
 * The React component (OverlayScrollbarsComponent) owns its own DOM wrapper,
 * keeping React's VDOM reconciliation safe.
 *
 * On Windows/Linux needsCustomScrollbar() returns false and the OS component
 * renders a plain <div> passthrough — no OverlayScrollbars overhead.
 */

import { needsCustomScrollbar } from '@core/utils/platform';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import 'overlayscrollbars/styles/overlayscrollbars.css';

/** Default options shared by all scroll areas in the app */
const DEFAULT_OS_OPTIONS = {
  scrollbars: {
    theme: 'os-theme-unstablon',
    autoHide: 'leave' as const,
    autoHideDelay: 800,
    autoHideSuspend: false,
  },
  overflow: { x: 'hidden' as const, y: 'scroll' as const },
};

/**
 * Returns the OverlayScrollbars options to use, or null on non-macOS.
 * Pass the result to <OverlayScrollbarsComponent options={...}>.
 */
export function getScrollbarOptions() {
  return needsCustomScrollbar() ? DEFAULT_OS_OPTIONS : undefined;
}

export { OverlayScrollbarsComponent, needsCustomScrollbar };
