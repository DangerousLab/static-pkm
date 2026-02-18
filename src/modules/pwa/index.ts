/**
 * PWA module - Service worker registration and offline capabilities
 * Ported from javascript/modules/pwa.js to TypeScript/React
 */

import { isPWAInstalled } from '@/core/ipc/platform';

export type PWADisplayMode = 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';

export interface CacheProgress {
  progress: number;
  current: number;
  total: number;
  url?: string;
}

export interface CacheComplete {
  totalAssets: number;
  cachedAssets: number;
  failedAssets: number;
}

/**
 * Get PWA display mode
 * @returns Display mode string
 */
export function getPWADisplayMode(): PWADisplayMode {
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) {
    return 'standalone';
  }
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return 'minimal-ui';
  }
  return 'browser';
}

/**
 * Register service worker with progress tracking
 * @param onProgress - Progress callback function
 * @returns Promise<boolean> - true if registered successfully
 */
export async function registerServiceWorker(
  onProgress?: (progress: CacheProgress) => void,
  onComplete?: (result: CacheComplete) => void
): Promise<boolean> {
  // Debug logging
  console.log('[PWA Debug] === Service Worker Registration Debug ===');
  console.log('[PWA Debug] Protocol:', window.location.protocol);
  console.log('[PWA Debug] Hostname:', window.location.hostname);
  console.log('[PWA Debug] Port:', window.location.port);
  console.log('[PWA Debug] Secure context:', window.isSecureContext);
  console.log('[PWA Debug] Service worker available:', 'serviceWorker' in navigator);
  console.log('[PWA Debug] Navigator standalone:', (window.navigator as Navigator & { standalone?: boolean }).standalone);
  console.log('[PWA Debug] Display mode:', getPWADisplayMode());
  console.log('[PWA Debug] isPWAInstalled():', isPWAInstalled());

  // CRITICAL: Only register if running as PWA
  if (!isPWAInstalled()) {
    console.log('[PWA] Service worker NOT registered: Not running as PWA');
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service worker not supported in this browser');
    console.warn('[PWA] Possible causes:');
    console.warn('[PWA]   - Not HTTPS (requires HTTPS or localhost)');
    console.warn('[PWA]   - Browser too old');
    console.warn('[PWA]   - Private browsing mode');
    return false;
  }

  if (!window.isSecureContext) {
    console.error('[PWA] Not a secure context (HTTPS required)');
    console.error('[PWA] Current protocol:', window.location.protocol);
    console.error('[PWA] Service worker registration blocked');
    return false;
  }

  console.log('[PWA] Registering service worker...');

  try {
    // Check if this is first installation
    const registrations = await navigator.serviceWorker.getRegistrations();
    const isFirstInstall = registrations.length === 0;

    console.log('[PWA Debug] Existing registrations:', registrations.length);
    console.log('[PWA] First install:', isFirstInstall);

    if (isFirstInstall) {
      console.log('[PWA] First install - will show progress overlay');
      console.log('[PWA] ⏳ This will take 30-60 seconds to cache everything');
    }

    // Listen for progress messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'CACHE_PROGRESS') {
        if (onProgress) {
          onProgress({
            progress: event.data.progress,
            current: event.data.current,
            total: event.data.total,
            url: event.data.url,
          });
        }
      }

      if (event.data && event.data.type === 'CACHE_COMPLETE') {
        console.log('[PWA] ✅ Cache complete!');
        console.log('[PWA] Total:', event.data.totalAssets);
        console.log('[PWA] Cached:', event.data.cachedAssets);
        if (event.data.failedAssets > 0) {
          console.warn('[PWA] Failed:', event.data.failedAssets);
        }
        if (onComplete) {
          onComplete({
            totalAssets: event.data.totalAssets,
            cachedAssets: event.data.cachedAssets,
            failedAssets: event.data.failedAssets,
          });
        }
      }
    });

    // Register service worker
    const registration = await navigator.serviceWorker.register('./service-worker.js', {
      scope: './',
    });

    console.log('[PWA] Service worker registered');
    console.log('[PWA Debug] Scope:', registration.scope);
    console.log('[PWA Debug] Active:', !!registration.active);
    console.log('[PWA Debug] Installing:', !!registration.installing);
    console.log('[PWA Debug] Waiting:', !!registration.waiting);

    // Request persistent storage
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      if (isPersisted) {
        console.log('[PWA] ✅ Persistent storage granted');
      } else {
        console.warn('[PWA] ⚠️  Persistent storage denied (cache may be evicted)');
      }

      // Check storage estimate
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        console.log('[PWA Debug] Storage usage:', Math.round((estimate.usage ?? 0) / 1024 / 1024) + ' MB');
        console.log('[PWA Debug] Storage quota:', Math.round((estimate.quota ?? 0) / 1024 / 1024) + ' MB');
      }
    }

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('[PWA] New service worker found, installing...');

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          console.log('[PWA Debug] Worker state:', newWorker.state);
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New service worker installed, update available');
          }
        });
      }
    });

    return true;
  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
    if (error instanceof Error) {
      console.error('[PWA Debug] Error name:', error.name);
      console.error('[PWA Debug] Error message:', error.message);
    }
    return false;
  }
}

/**
 * Check if app is ready for offline use
 * @returns Promise<boolean>
 */
export async function isOfflineReady(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration || !registration.active) {
    return false;
  }

  const cacheNames = await caches.keys();
  return cacheNames.some((name) => name.startsWith('unstablon-offline-'));
}

console.log('[PWA] PWA module loaded');
