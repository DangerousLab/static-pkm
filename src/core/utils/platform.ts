/**
 * Platform detection utilities — uses Web APIs only
 * No @tauri-apps/plugin-os required
 */

import { isTauriContext } from '@core/ipc/platform';

/** Check if the app is running on macOS */
export function isMacOS(): boolean {
  // navigator.userAgentData (modern Chromium-based WKWebView builds)
  if ('userAgentData' in navigator) {
    const uad = (navigator as Navigator & {
      userAgentData?: { platform: string };
    }).userAgentData;
    if (uad?.platform) return uad.platform === 'macOS';
  }
  // Fallback: navigator.platform (deprecated but reliable in WKWebView)
  return /Mac/.test(navigator.platform);
}

/**
 * True when JS-based scrollbars are needed.
 * macOS WKWebView ignores ::-webkit-scrollbar CSS, so OverlayScrollbars
 * must be used there. CSS scrollbars work fine on Windows/Linux.
 */
export function needsCustomScrollbar(): boolean {
  return isTauriContext();
}
