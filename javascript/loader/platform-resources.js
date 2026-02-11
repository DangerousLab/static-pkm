// javascript/loader/platform-resources.js

/**
 * Platform Resources Registry
 * 
 * Manages injection of platform-level resources (CSS, fonts, styles)
 * into shadow DOMs for trusted third-party libraries.
 * 
 * SECURITY:
 * - Only Platform Layer code can register resources
 * - User Layer modules receive resources automatically
 * - No document.head access given to User Layer
 * - All resources are vetted (MathJax, FontAwesome, etc.)
 * 
 * @module PlatformResources
 */

// Track all shadow roots in the application
const shadowRoots = new Set();

// Track registered platform resources (CSS, fonts, etc.)
const platformResources = new Map();

/**
 * Register a shadow root to receive platform resources
 * Called by dom-isolation.js when creating shadow DOM
 * 
 * @param {ShadowRoot} shadowRoot - Shadow root to inject resources into
 * @param {string} instanceId - Instance ID for logging
 */
export function registerShadowRoot(shadowRoot, instanceId) {
  if (!shadowRoot || !(shadowRoot instanceof ShadowRoot)) {
    console.error('[PlatformResources] Invalid shadow root');
    return;
  }
  
  shadowRoots.add(shadowRoot);
  console.log(`[PlatformResources] Registered shadow root for ${instanceId} (${shadowRoots.size} total)`);
  
  // Inject all existing platform resources into this new shadow root
  for (const [resourceId, resource] of platformResources) {
    if (resource.loaded) {
      injectResourceIntoShadowRoot(shadowRoot, resource, instanceId);
    }
  }
}

/**
 * Unregister a shadow root (cleanup)
 * Called by instance-manager.js when destroying module
 * 
 * @param {ShadowRoot} shadowRoot - Shadow root to remove
 */
export function unregisterShadowRoot(shadowRoot) {
  shadowRoots.delete(shadowRoot);
  console.log(`[PlatformResources] Unregistered shadow root (${shadowRoots.size} remaining)`);
}

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
 * Mark a platform resource as loaded and inject into all shadow roots
 * Called by loaders after resource loads successfully
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
  console.log(`[PlatformResources] Resource loaded: ${resource.name} - injecting into ${shadowRoots.size} shadow roots`);
  
  // Inject into ALL existing shadow roots
  for (const shadowRoot of shadowRoots) {
    injectResourceIntoShadowRoot(shadowRoot, resource);
  }
}

/**
 * Inject a single resource into a single shadow root
 * 
 * @private
 * @param {ShadowRoot} shadowRoot - Target shadow root
 * @param {Object} resource - Resource to inject
 * @param {string} instanceId - Instance ID (for logging)
 */
function injectResourceIntoShadowRoot(shadowRoot, resource, instanceId = 'unknown') {
  try {
    if (resource.type === 'css') {
      // Inject <link> tag for external CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = resource.url;
      link.dataset.platformResource = resource.id;
      
      if (resource.integrity) {
        link.integrity = resource.integrity;
        link.crossOrigin = 'anonymous';
      }
      
      // Insert at beginning of shadow root (before module styles)
      if (shadowRoot.firstChild) {
        shadowRoot.insertBefore(link, shadowRoot.firstChild);
      } else {
        shadowRoot.appendChild(link);
      }
      
      console.log(`[PlatformResources] Injected CSS link for ${resource.name} into ${instanceId}`);
      
    } else if (resource.type === 'style') {
      // Inject inline <style> for CSS content
      const style = document.createElement('style');
      style.textContent = resource.content;
      style.dataset.platformResource = resource.id;
      
      // Insert at beginning of shadow root
      if (shadowRoot.firstChild) {
        shadowRoot.insertBefore(style, shadowRoot.firstChild);
      } else {
        shadowRoot.appendChild(style);
      }
      
      console.log(`[PlatformResources] Injected inline style for ${resource.name} into ${instanceId}`);
      
    } else if (resource.type === 'font') {
      // Inject @font-face declaration
      const fontStyle = document.createElement('style');
      fontStyle.textContent = `
        @font-face {
          font-family: '${resource.name}';
          src: url('${resource.url}');
        }
      `;
      fontStyle.dataset.platformResource = resource.id;
      
      // Insert at beginning
      if (shadowRoot.firstChild) {
        shadowRoot.insertBefore(fontStyle, shadowRoot.firstChild);
      } else {
        shadowRoot.appendChild(fontStyle);
      }
      
      console.log(`[PlatformResources] Injected font for ${resource.name} into ${instanceId}`);
    }
    
  } catch (error) {
    console.error(`[PlatformResources] Failed to inject resource ${resource.id}:`, error);
  }
}

/**
 * Get list of loaded platform resources (for debugging)
 * 
 * @returns {Array<Object>} Array of loaded resources
 */
export function getLoadedResources() {
  return Array.from(platformResources.values()).filter(r => r.loaded);
}

/**
 * Get shadow root count (for debugging)
 * 
 * @returns {number} Number of registered shadow roots
 */
export function getShadowRootCount() {
  return shadowRoots.size;
}
