/**
 * Unstablon PKM - PWA Service Worker
 * FULL offline-first caching - EVERYTHING pre-cached on first install
 * Only activated when installed as PWA (especially iOS)
 * 
 * Cache Strategy:
 * - Pre-cache ALL resources from cache-manifest.json
 * - NO runtime caching - everything is cached immediately
 * - Cache-first for all requests (maximum persistence)
 * - Network fallback only for unexpected resources
 * - Persistent storage API for maximum cache retention
 */

const CACHE_MANIFEST_URL = './javascript/cache-manifest.json';
let CACHE_VERSION = 'v1.0.0';
let CACHE_NAME = `unstablon-offline-${CACHE_VERSION}`;
let PRECACHE_URLS = [];

/**
 * Load cache manifest dynamically
 */
async function loadCacheManifest() {
  try {
    const response = await fetch(CACHE_MANIFEST_URL);
    if (!response.ok) {
      throw new Error('Failed to load cache manifest');
    }

    const manifest = await response.json();
    CACHE_VERSION = manifest.version;
    CACHE_NAME = `unstablon-offline-${CACHE_VERSION}`;

    // Get ALL pre-cache URLs (local + CDN)
    PRECACHE_URLS = [
      ...manifest.preCache.local,
      ...manifest.preCache.cdn
    ];

    console.log('[SW] Loaded cache manifest:', manifest.version);
    console.log('[SW] Pre-cache URLs:', PRECACHE_URLS.length);
    console.log('[SW] ⚠️  Pre-caching EVERYTHING - may take 30-60 seconds');

    return manifest;
  } catch (error) {
    console.error('[SW] Failed to load cache manifest:', error);
    // Fallback to minimal cache
    PRECACHE_URLS = ['./', './index.html'];
    return null;
  }
}

/**
 * INSTALL EVENT - Pre-cache ALL resources
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  console.log('[SW] This will pre-cache EVERYTHING for full offline support');

  event.waitUntil(
    loadCacheManifest()
      .then(() => caches.open(CACHE_NAME))
      .then(cache => {
        console.log('[SW] Opened cache:', CACHE_NAME);

        const totalAssets = PRECACHE_URLS.length;
        let cachedAssets = 0;
        let failedAssets = [];

        // Cache each URL individually to track progress
        const cachePromises = PRECACHE_URLS.map(async (url, index) => {
          try {
            const isCDN = url.startsWith('http://') || url.startsWith('https://');

            if (isCDN) {
              // CDN resources - handle CORS
              try {
                const response = await fetch(url, { 
                  mode: 'cors',
                  cache: 'force-cache'
                });
                if (response.ok) {
                  await cache.put(url, response);
                } else {
                  throw new Error(`HTTP ${response.status}`);
                }
              } catch (corsError) {
                // Fallback to no-cors for opaque responses
                const response = await fetch(url, { 
                  mode: 'no-cors',
                  cache: 'force-cache'
                });
                await cache.put(url, response);
              }
            } else {
              // Local resources - use cache.add
              await cache.add(url);
            }

            cachedAssets++;

            // Send progress update to all clients
            const progress = Math.round((cachedAssets / totalAssets) * 100);
            const clients = await self.clients.matchAll({ includeUncontrolled: true });
            clients.forEach(client => {
              client.postMessage({
                type: 'CACHE_PROGRESS',
                progress: progress,
                current: cachedAssets,
                total: totalAssets,
                url: url
              });
            });

            // Log every 10th item to avoid spam
            if (cachedAssets % 10 === 0 || cachedAssets === totalAssets) {
              console.log(`[SW] Progress: ${cachedAssets}/${totalAssets} (${progress}%)`);
            }
          } catch (error) {
            failedAssets.push({ url, error: error.message });
            console.warn(`[SW] Failed to cache: ${url}`, error.message);
          }
        });

        return Promise.all(cachePromises).then(() => {
          return { totalAssets, cachedAssets, failedAssets };
        });
      })
      .then(({ totalAssets, cachedAssets, failedAssets }) => {
        console.log('[SW] ✅ Pre-caching complete!');
        console.log(`[SW] Successfully cached: ${cachedAssets}/${totalAssets} resources`);

        if (failedAssets.length > 0) {
          console.warn(`[SW] ⚠️  Failed to cache ${failedAssets.length} resources:`);
          failedAssets.forEach(({ url }) => {
            console.warn(`[SW]   - ${url}`);
          });
        }

        // Send completion message
        self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'CACHE_COMPLETE',
              cacheName: CACHE_NAME,
              totalAssets,
              cachedAssets,
              failedAssets: failedAssets.length
            });
          });
        });

        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Pre-caching failed:', error);
      })
  );
});

/**
 * ACTIVATE EVENT - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

/**
 * FETCH EVENT - Cache-first strategy (everything already cached)
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached version (should always exist)
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache (unexpected) - fetch from network
        console.warn('[SW] Unexpected cache miss:', url.pathname);
        return fetch(event.request)
          .catch(error => {
            console.error('[SW] Fetch failed:', url.pathname, error);

            // Return offline fallback for HTML pages
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }

            return new Response('Offline - Resource not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

/**
 * MESSAGE EVENT - Handle messages from app
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service worker script loaded');
