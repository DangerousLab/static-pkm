/**
 * Environment detection utilities
 * Determines deployment context: gh-pages (web), PWA, or native (Tauri)
 */

/** Deployment environment type */
export type DeploymentEnv = 'native' | 'pwa' | 'web';

/**
 * Detect current deployment environment
 */
export function getDeploymentEnv(): DeploymentEnv {
  // Check if running in Tauri (native app)
  if (window.__TAURI__ !== undefined) {
    return 'native';
  }

  // Check if running as PWA (multiple detection methods)
  const isPWA =
    // Installed PWA in standalone mode
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari "Add to Home Screen"
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    // Minimal UI mode (some PWAs use this)
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // PWA preview server (localhost:4173)
    (window.location.hostname === 'localhost' && window.location.port === '4173');

  if (isPWA) {
    return 'pwa';
  }

  // Default to web (gh-pages)
  return 'web';
}

/**
 * Get resource URL strategy based on environment
 *
 * @param localPath - Path to local bundled resource (e.g., './vendor/fontawesome/css/all.min.css')
 * @param cdnUrl - CDN URL for web (e.g., 'https://cdnjs.cloudflare.com/...')
 * @returns URL to use for the current environment
 */
export function getResourceUrl(localPath: string, cdnUrl: string): string {
  const env = getDeploymentEnv();

  switch (env) {
    case 'native':
    case 'pwa':
      // Native app and PWA: Use bundled local files (offline-first)
      // PWA has vendor files pre-cached from cache-manifest.json
      return localPath;

    case 'web':
      // Web (gh-pages): Use CDN for faster loading
      return cdnUrl;

    default:
      return cdnUrl;
  }
}

/**
 * Check if running in native Tauri app
 */
export function isNativeApp(): boolean {
  return getDeploymentEnv() === 'native';
}

/**
 * Check if running as PWA
 */
export function isPWA(): boolean {
  return getDeploymentEnv() === 'pwa';
}

/**
 * Check if running as web (gh-pages)
 */
export function isWeb(): boolean {
  return getDeploymentEnv() === 'web';
}
