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

const CACHE_MANIFEST_URL = './cache-manifest.json';
let CACHE_VERSION = 'v1.0.0';
let CACHE_NAME = `unstablon-offline-${CACHE_VERSION}`;
let PRECACHE_URLS = [];

/**
 * Load cache manifest dynamically with integrity verification
 */
async function loadCacheManifest() {
  try {
    console.log('[SW DEBUG] Loading cache manifest from:', CACHE_MANIFEST_URL);
    const response = await fetch(CACHE_MANIFEST_URL, { cache: 'no-cache' });
    console.log('[SW DEBUG] Manifest fetch response:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error('Failed to load cache manifest');
    }

    const manifest = await response.json();
    console.log('[SW DEBUG] Manifest loaded successfully');
    console.log('[SW DEBUG] Manifest version:', manifest.version);
    console.log('[SW DEBUG] Local files:', manifest.preCache.local.length);
    console.log('[SW DEBUG] CDN files:', manifest.preCache.cdn.length);
    
    // SECURITY: Validate manifest structure
    if (!manifest.version || !manifest.preCache) {
      throw new Error('Invalid cache manifest structure');
    }
    
    // SECURITY: Validate version format (semver, timestamp, or git SHA)
    const isSemver = /^v?\d+\.\d+\.\d+$/.test(manifest.version);
    const isTimestamp = /^\d{13,}$/.test(manifest.version);
    const isGitSHA = /^[0-9a-f]{7,40}$/i.test(manifest.version); // 7-40 char hex string
    
    if (!isSemver && !isTimestamp && !isGitSHA) {
      throw new Error('Invalid version format in manifest');
    }
    
    // SECURITY: Check for version downgrade
    const currentVersion = await getCurrentCachedVersion();
    if (currentVersion && isVersionDowngrade(currentVersion, manifest.version)) {
      console.warn('[SW] ⚠️  Version downgrade detected:', currentVersion, '→', manifest.version);
      console.warn('[SW] Downgrade blocked for security. Clear cache manually if intentional.');
      throw new Error('Version downgrade blocked');
    }
    
    CACHE_VERSION = manifest.version;
    CACHE_NAME = `unstablon-offline-${CACHE_VERSION}`;

    // Get ALL pre-cache URLs (local + CDN)
    PRECACHE_URLS = [
      ...manifest.preCache.local,
      ...manifest.preCache.cdn
    ];
    
    // SECURITY: Store version for future comparisons
    await storeCurrentVersion(manifest.version);

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
 * Get currently cached version from IndexedDB
 */
async function getCurrentCachedVersion() {
  try {
    const db = await openVersionDB();
    return await getVersionFromDB(db);
  } catch (error) {
    console.warn('[SW] Could not read cached version:', error);
    return null;
  }
}

/**
 * Store current version in IndexedDB for downgrade detection
 */
async function storeCurrentVersion(version) {
  try {
    const db = await openVersionDB();
    await saveVersionToDB(db, version);
    console.log('[SW] Stored version:', version);
  } catch (error) {
    console.warn('[SW] Could not store version:', error);
  }
}

/**
 * Open or create version tracking database
 */
async function openVersionDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('unstablon-sw-version', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('versions')) {
        db.createObjectStore('versions', { keyPath: 'id' });
      }
    };
  });
}

/**
 * Get version from database
 */
async function getVersionFromDB(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['versions'], 'readonly');
    const store = transaction.objectStore('versions');
    const request = store.get('current');
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result ? request.result.version : null);
    };
  });
}

/**
 * Save version to database
 */
async function saveVersionToDB(db, version) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['versions'], 'readwrite');
    const store = transaction.objectStore('versions');
    const request = store.put({ 
      id: 'current', 
      version: version,
      timestamp: Date.now()
    });
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Check if new version is a downgrade (prevents version rollback attacks)
 */
function isVersionDowngrade(oldVersion, newVersion) {
  // Handle timestamp versions (13+ digits)
  if (/^\d{13,}$/.test(oldVersion) && /^\d{13,}$/.test(newVersion)) {
    return parseInt(newVersion) < parseInt(oldVersion);
  }
  
  // Handle semver versions (v1.2.3 or 1.2.3)
  const parseVersion = (v) => {
    const match = v.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  };
  
  const [oldMajor, oldMinor, oldPatch] = parseVersion(oldVersion);
  const [newMajor, newMinor, newPatch] = parseVersion(newVersion);
  
  if (newMajor < oldMajor) return true;
  if (newMajor === oldMajor && newMinor < oldMinor) return true;
  if (newMajor === oldMajor && newMinor === oldMinor && newPatch < oldPatch) return true;
  
  return false;
}

/**
 * INSTALL EVENT - Pre-cache ALL resources
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  console.log('[SW] This will pre-cache EVERYTHING for full offline support');

  event.waitUntil(
    loadCacheManifest()
      .then(() => {
        console.log('[SW DEBUG] Manifest loaded, PRECACHE_URLS length:', PRECACHE_URLS.length);
        console.log('[SW DEBUG] First 5 URLs:', PRECACHE_URLS.slice(0, 5));
        return caches.open(CACHE_NAME);
      })
      .then(cache => {
        console.log('[SW] Opened cache:', CACHE_NAME);
        console.log('[SW DEBUG] Cache object:', cache);

        const totalAssets = PRECACHE_URLS.length;
        let cachedAssets = 0;
        let failedAssets = [];

        // Cache each URL individually to track progress
        console.log(`[SW DEBUG] Starting to cache ${totalAssets} URLs...`);
        const cachePromises = PRECACHE_URLS.map(async (url, index) => {
          console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] Starting: ${url}`);
          const startTime = Date.now();

          try {
            const isCDN = url.startsWith('http://') || url.startsWith('https://');

            // CRITICAL: Convert relative URLs to FULL ABSOLUTE URLs for cache matching
            // Browser requests come as full URLs like http://localhost:4173/assets/app.js
            // Cache API matches by full URL, not path strings
            const baseUrl = self.registration.scope; // e.g., "http://localhost:4173/"
            let cacheUrl = url;
            if (!isCDN) {
              // Resolve relative URL to absolute using service worker scope
              cacheUrl = new URL(url, baseUrl).href;
            }

            console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] Original: ${url}, Cache URL: ${cacheUrl}`);
            console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] Is CDN: ${isCDN}`);

            if (isCDN) {
              // CDN resources - handle CORS
              try {
                console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] Fetching CDN with CORS...`);
                const response = await fetch(url, {
                  mode: 'cors',
                  cache: 'force-cache'
                });
                console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] CDN response: ${response.status} ${response.statusText}`);
                if (response.ok) {
                  await cache.put(url, response);
                  console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] CDN cached successfully`);
                } else {
                  throw new Error(`HTTP ${response.status}`);
                }
              } catch (corsError) {
                console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] CORS failed, trying no-cors: ${corsError.message}`);
                // Fallback to no-cors for opaque responses
                const response = await fetch(url, {
                  mode: 'no-cors',
                  cache: 'force-cache'
                });
                await cache.put(url, response);
                console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] CDN cached with no-cors`);
              }
            } else {
              // Local resources - explicit fetch and cache
              console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] Fetching local resource...`);
              // CRITICAL: Fetch with same properties browser will use during normal requests
              // This ensures caches.match() will find the entry later
              const response = await fetch(cacheUrl, {
                cache: 'reload' // Force fresh fetch during install
                // NO credentials - browser default is 'omit' for same-origin
                // NO mode - browser default is 'cors' for cross-origin, 'no-cors' for same-origin
              });

              console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] Response status: ${response.status} ${response.statusText}`);
              console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] Response type: ${response.type}`);
              console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] Content-Type: ${response.headers.get('Content-Type')}`);

              // Log response size if available
              const contentLength = response.headers.get('Content-Length');
              if (contentLength) {
                console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] Content-Length: ${contentLength} bytes`);
              }

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }

              // Cache with absolute URL - this matches how browser requests come in
              const clonedResponse = response.clone();
              await cache.put(cacheUrl, clonedResponse);
              console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] Cached as: ${cacheUrl}`);

              const elapsed = Date.now() - startTime;
              console.log(`[SW DEBUG] [${index + 1}/${totalAssets}] ✓ Cached successfully in ${elapsed}ms`);
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

            console.log(`[SW] Progress: ${cachedAssets}/${totalAssets} (${progress}%)`);
          } catch (error) {
            const elapsed = Date.now() - startTime;
            failedAssets.push({ url, error: error.message });
            console.error(`[SW DEBUG] [${index + 1}/${totalAssets}] ✗ FAILED in ${elapsed}ms: ${url}`);
            console.error(`[SW DEBUG] Error details:`, error);
            console.error(`[SW DEBUG] Error name: ${error.name}`);
            console.error(`[SW DEBUG] Error message: ${error.message}`);
            console.error(`[SW DEBUG] Error stack:`, error.stack);
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
 * FETCH EVENT - Cache-first strategy with security headers
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip non-http protocols (includes tauri://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // CRITICAL: Skip Tauri protocol requests
  // Tauri serves from tauri://localhost or custom protocols
  if (url.protocol === 'tauri:' || url.hostname === 'tauri.localhost') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached version with security headers
        if (cachedResponse) {
          // SECURITY: Clone and add security headers
          return addSecurityHeaders(cachedResponse, url);
        }

        // Cache miss - try matching by URL only (ignore request properties)
        // This handles cases where request credentials/mode differ from cached version
        return caches.match(event.request.url, { ignoreVary: true })
          .then(urlMatch => {
            if (urlMatch) {
              console.log('[SW] Cache hit by URL (request properties differed):', url.pathname);
              return addSecurityHeaders(urlMatch, url);
            }

            // Not in cache (unexpected) - fetch from network
            console.warn('[SW] Unexpected cache miss:', url.pathname);
            return fetch(event.request)
              .then(response => {
                // Add security headers to network response too
                return addSecurityHeaders(response, url);
              })
              .catch(error => {
                console.error('[SW] Fetch failed:', url.pathname, error);

                // Return offline fallback for HTML pages
                if (event.request.headers.get('accept').includes('text/html')) {
                  const fallbackUrl = new URL('./index.html', self.registration.scope).href;
                  return caches.match(fallbackUrl, { ignoreVary: true })
                    .then(fallback => addSecurityHeaders(fallback, url));
                }

                return new Response('Offline - Resource not available', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/plain'
                  })
                });
              });
          });
      })
  );
});

/**
 * Add security headers to response
 */
function addSecurityHeaders(response, url) {
  if (!response) return response;

  // CRITICAL: Clone response before reading properties
  // This prevents "body already consumed" errors
  const clonedResponse = response.clone();
  const headers = new Headers(clonedResponse.headers);

  // SECURITY: Add CSP for HTML files
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === './') {
    headers.set('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.cdnfonts.com; " +
      "font-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.cdnfonts.com data:; " +
      "img-src 'self' data: blob:; " +
      "connect-src 'self'"
    );
  }

  // SECURITY: Prevent MIME sniffing
  headers.set('X-Content-Type-Options', 'nosniff');

  // SECURITY: Frame protection (clickjacking)
  headers.set('X-Frame-Options', 'SAMEORIGIN');

  // Clone response with new headers
  return new Response(clonedResponse.body, {
    status: clonedResponse.status,
    statusText: clonedResponse.statusText,
    headers: headers
  });
}

/**
 * MESSAGE EVENT - Handle messages from app
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service worker script loaded');
