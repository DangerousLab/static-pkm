/**
 * PWA Detection and Service Worker Registration Utility
 * 
 * CRITICAL: Only registers service worker when running as installed PWA
 * Specifically designed for iOS Safari PWA detection
 * 
 * Includes debug logging for troubleshooting
 */

/**
 * Detect if app is running as installed PWA
 * @returns {boolean} True if running as PWA
 */
export function isPWA() {
  // Method 1: iOS Safari PWA detection
  if (window.navigator.standalone === true) {
    console.log('[PWA] Detected: iOS standalone mode');
    return true;
  }

  // Method 2: Standard display-mode detection
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('[PWA] Detected: display-mode standalone');
    return true;
  }

  // Method 3: Fullscreen mode (Android)
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    console.log('[PWA] Detected: display-mode fullscreen');
    return true;
  }

  // Method 4: Minimal UI mode
  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    console.log('[PWA] Detected: display-mode minimal-ui');
    return true;
  }

  console.log('[PWA] Not detected: Running in browser');
  return false;
}

/**
 * Get PWA display mode
 * @returns {string} Display mode
 */
export function getPWADisplayMode() {
  if (window.navigator.standalone === true) {
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
 * Show progress indicator during service worker installation
 */
function showCacheProgress() {
  const overlay = document.createElement('div');
  overlay.id = 'pwa-cache-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(31, 31, 31, 0.95);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: 'Uni Sans', sans-serif;
  `;

  overlay.innerHTML = `
    <div style="text-align: center; max-width: 80%; color: #ffffff;">
      <div style="font-size: 1.5rem; margin-bottom: 1rem; font-weight: 600;">
        ⚡ Preparing Full Offline Mode
      </div>
      <div style="font-size: 0.9rem; margin-bottom: 2rem; color: #cccccc;">
        Caching ALL assets for complete offline access...<br>
        This may take 30-60 seconds on first install
      </div>
      <div style="width: 100%; max-width: 300px; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden;">
        <div id="pwa-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); transition: width 0.3s ease;"></div>
      </div>
      <div id="pwa-progress-text" style="margin-top: 1rem; font-size: 0.8rem; color: #999;">
        0%
      </div>
      <div id="pwa-progress-detail" style="margin-top: 0.5rem; font-size: 0.7rem; color: #666; min-height: 1rem;">
        Starting...
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Update progress bar
 */
function updateProgress(progress, current, total, url) {
  const progressBar = document.getElementById('pwa-progress-bar');
  const progressText = document.getElementById('pwa-progress-text');
  const progressDetail = document.getElementById('pwa-progress-detail');

  if (progressBar) {
    progressBar.style.width = progress + '%';
  }
  if (progressText) {
    progressText.textContent = `${progress}% (${current}/${total})`;
  }
  if (progressDetail && url) {
    const fileName = url.split('/').pop() || url;
    const shortName = fileName.length > 40 ? fileName.substring(0, 37) + '...' : fileName;
    progressDetail.textContent = shortName;
  }
}

/**
 * Remove progress overlay
 */
function hideProgress() {
  const overlay = document.getElementById('pwa-cache-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s ease';
    setTimeout(() => overlay.remove(), 500);
  }
}

/**
 * Register service worker (only if PWA)
 * @returns {Promise<boolean>} True if registered successfully
 */
export async function registerServiceWorker() {
  // Debug logging
  console.log('[PWA Debug] === Service Worker Registration Debug ===');
  console.log('[PWA Debug] Protocol:', window.location.protocol);
  console.log('[PWA Debug] Hostname:', window.location.hostname);
  console.log('[PWA Debug] Port:', window.location.port);
  console.log('[PWA Debug] Secure context:', window.isSecureContext);
  console.log('[PWA Debug] Service worker available:', 'serviceWorker' in navigator);
  console.log('[PWA Debug] Navigator standalone:', window.navigator.standalone);
  console.log('[PWA Debug] Display mode:', getPWADisplayMode());
  console.log('[PWA Debug] isPWA():', isPWA());

  // CRITICAL: Only register if running as PWA
  if (!isPWA()) {
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

    let progressOverlay = null;
    if (isFirstInstall) {
      progressOverlay = showCacheProgress();
      console.log('[PWA] First install - showing progress overlay');
      console.log('[PWA] ⏳ This will take 30-60 seconds to cache everything');
    }

    // Listen for progress messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'CACHE_PROGRESS') {
        updateProgress(
          event.data.progress,
          event.data.current,
          event.data.total,
          event.data.url
        );
      }

      if (event.data && event.data.type === 'CACHE_COMPLETE') {
        console.log('[PWA] ✅ Cache complete!');
        console.log('[PWA] Total:', event.data.totalAssets);
        console.log('[PWA] Cached:', event.data.cachedAssets);
        if (event.data.failedAssets > 0) {
          console.warn('[PWA] Failed:', event.data.failedAssets);
        }
        setTimeout(() => hideProgress(), 1000);
      }
    });

    // Register service worker
    const registration = await navigator.serviceWorker.register('./service-worker.js', {
      scope: './'
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
        console.log('[PWA Debug] Storage usage:', Math.round(estimate.usage / 1024 / 1024) + ' MB');
        console.log('[PWA Debug] Storage quota:', Math.round(estimate.quota / 1024 / 1024) + ' MB');
      }
    }

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('[PWA] New service worker found, installing...');

      newWorker.addEventListener('statechange', () => {
        console.log('[PWA Debug] Worker state:', newWorker.state);
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[PWA] New service worker installed, update available');
        }
      });
    });

    if (!isFirstInstall && progressOverlay) {
      hideProgress();
    }

    return true;
  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
    console.error('[PWA Debug] Error name:', error.name);
    console.error('[PWA Debug] Error message:', error.message);
    hideProgress();
    return false;
  }
}

/**
 * Check if app is ready for offline use
 * @returns {Promise<boolean>}
 */
export async function isOfflineReady() {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration || !registration.active) {
    return false;
  }

  const cacheNames = await caches.keys();
  return cacheNames.some(name => name.startsWith('unstablon-offline-'));
}

console.log('[PWA] PWA detector utility loaded');
