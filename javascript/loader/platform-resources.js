// javascript/loader/platform-resources.js

/**
 * Platform Resources Registry
 * 
 * Tracks loaded platform-level resources (MathJax, FontAwesome, etc.)
 * for debugging and future extensibility.
 * 
 * v3.0: Resources load globally into document.head (no shadow DOM injection needed)
 * 
 * @module PlatformResources
 */

// Track registered platform resources (CSS, fonts, etc.)
const platformResources = new Map();

/**
 * Register a platform resource (CSS file, font, etc.)
 * Called by loaders when they load external resources
 * 
 * @param {Object} config - Resource configuration
 * @param {string} config.id - Unique resource ID (e.g., 'mathjax-fonts')
 * @param {string} config.type - Resource type ('css' | 'font' | 'style')
 * @param {string} config.url - CDN URL (for css/font)
 * @param {string} config.content - CSS content (for inline style)
 * @param {string} config.integrity - SRI hash (optional)
 * @param {string} config.name - Human-readable name (for logging)
 */
export function registerPlatformResource(config) {
  const { id, type, url, content, integrity, name } = config;
  
  if (!id || !type) {
    console.error('[PlatformResources] Invalid resource config:', config);
    return;
  }
  
  // Check if already registered
  if (platformResources.has(id)) {
    console.log(`[PlatformResources] Resource '${id}' already registered`);
    return;
  }
  
  const resource = {
    id,
    type,
    url,
    content,
    integrity,
    name: name || id,
    loaded: false
  };
  
  platformResources.set(id, resource);
  console.log(`[PlatformResources] Registered platform resource: ${resource.name} (${type})`);
}

/**
 * Mark a platform resource as loaded
 * Called by loaders after resource loads successfully
 * 
 * v3.0: No injection needed - resources load globally via document.head
 * 
 * @param {string} resourceId - Resource ID to mark as loaded
 */
export function markResourceLoaded(resourceId) {
  const resource = platformResources.get(resourceId);
  
  if (!resource) {
    console.error(`[PlatformResources] Unknown resource ID: ${resourceId}`);
    return;
  }
  
  resource.loaded = true;
  console.log(`[PlatformResources] Resource loaded globally: ${resource.name}`);
}

/**
 * Get list of loaded platform resources (for debugging)
 * 
 * @returns {Array<Object>} Array of loaded resources
 */
export function getLoadedResources() {
  return Array.from(platformResources.values()).filter(r => r.loaded);
}
