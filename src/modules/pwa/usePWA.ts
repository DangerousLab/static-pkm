/**
 * React hook for PWA functionality
 * Handles service worker registration, caching progress, and offline status
 */

import { useState, useEffect } from 'react';
import { isPWAInstalled } from '@/core/ipc/platform';
import { registerServiceWorker, isOfflineReady, type CacheProgress, type CacheComplete } from './index';

export interface PWAState {
  isInstalled: boolean;
  isOffline: boolean;
  cacheProgress: number;
  cacheCurrent: number;
  cacheTotal: number;
  cacheUrl: string | null;
  isOfflineReady: boolean;
}

/**
 * usePWA hook - manages PWA installation, caching, and offline status
 */
export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isOffline: false,
    cacheProgress: 0,
    cacheCurrent: 0,
    cacheTotal: 0,
    cacheUrl: null,
    isOfflineReady: false,
  });

  useEffect(() => {
    // Check PWA installation status
    const installed = isPWAInstalled();
    setState((prev) => ({ ...prev, isInstalled: installed }));

    // Register service worker if PWA
    if (installed) {
      registerServiceWorker(
        // Progress callback
        (progress: CacheProgress) => {
          setState((prev) => ({
            ...prev,
            cacheProgress: progress.progress,
            cacheCurrent: progress.current,
            cacheTotal: progress.total,
            cacheUrl: progress.url ?? null,
          }));
        },
        // Complete callback
        (result: CacheComplete) => {
          console.log('[usePWA] Cache complete:', result);
          setState((prev) => ({
            ...prev,
            cacheProgress: 100,
            isOfflineReady: true,
          }));
        }
      );

      // Check offline ready status
      isOfflineReady().then((ready) => {
        setState((prev) => ({ ...prev, isOfflineReady: ready }));
      });
    }

    // Listen for online/offline events
    const handleOnline = () => {
      console.log('[usePWA] Online');
      setState((prev) => ({ ...prev, isOffline: false }));
    };

    const handleOffline = () => {
      console.log('[usePWA] Offline');
      setState((prev) => ({ ...prev, isOffline: true }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial offline state
    setState((prev) => ({ ...prev, isOffline: !navigator.onLine }));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return state;
}
