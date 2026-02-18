/**
 * Platform detection and abstraction
 * Determines runtime environment (Tauri, PWA, or Browser)
 */

/**
 * Platform mode enum
 */
export type PlatformMode = 'tauri' | 'pwa' | 'browser';

/**
 * Check if running in Tauri context
 * @returns true if Tauri APIs are available
 */
export function isTauriContext(): boolean {
  // Tauri 2.0 detection methods (in order of reliability)

  // 1. Check for Tauri-specific internals (most reliable)
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return true;
  }

  // 2. Check for legacy __TAURI__ global (Tauri 1.x)
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return true;
  }

  // 3. Check for Tauri IPC protocol (Tauri 2.0)
  if (typeof window !== 'undefined' && window.location.protocol === 'tauri:') {
    return true;
  }

  // 4. Check for environment variable set during Tauri dev
  if (import.meta.env.TAURI_ENV_PLATFORM) {
    return true;
  }

  return false;
}

/**
 * Check if PWA is installed
 * @returns true if running as installed PWA
 */
export function isPWAInstalled(): boolean {
  // iOS Safari standalone mode
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) {
    return true;
  }

  // Android/Chrome display modes
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return true;
  }

  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return true;
  }

  return false;
}

/**
 * Get current platform mode
 * @returns Platform mode (tauri, pwa, or browser)
 */
export function getPlatformMode(): PlatformMode {
  if (isTauriContext()) {
    return 'tauri';
  }

  if (isPWAInstalled()) {
    return 'pwa';
  }

  return 'browser';
}

/**
 * Check if running in PWA build
 * @returns true if built as PWA (VITE_BUILD_MODE=pwa)
 */
export function isPWABuild(): boolean {
  return import.meta.env.VITE_BUILD_MODE === 'pwa';
}
