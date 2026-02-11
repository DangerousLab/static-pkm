/**
 * Dynamic resource loader utility
 * Loads external CSS/JS resources on-demand with auto-detection
 */

import { registerPlatformResource, markResourceLoaded } from './platform-resources.js';

const loadedResources = new Set();
let fontAwesomeLoadPromise = null;

/**
 * Load CSS resource dynamically
 */
async function loadCSS(url, integrity = null, crossorigin = 'anonymous') {
  console.log('[DynamicLoader] Attempting to load CSS:', url);
  
  if (loadedResources.has(url)) {
    console.log('[DynamicLoader] CSS already loaded, skipping:', url);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    
    if (integrity) {
      link.integrity = integrity;
      link.crossOrigin = crossorigin;
    }
    
    link.onload = () => {
      loadedResources.add(url);
      console.log('[DynamicLoader] CSS loaded successfully:', url);
      resolve();
    };
    
    link.onerror = () => {
      console.error('[DynamicLoader] Failed to load CSS:', url);
      reject(new Error(`Failed to load CSS: ${url}`));
    };
    
    document.head.appendChild(link);
  });
}

/**
 * Load FontAwesome icons (singleton pattern)
 * Returns same promise for concurrent calls
 */
export async function loadFontAwesome() {
  // Return existing promise if already loading
  if (fontAwesomeLoadPromise) {
    console.log('[DynamicLoader] FontAwesome already loading, returning existing promise');
    return fontAwesomeLoadPromise;
  }

  // Return immediately if already loaded
  if (loadedResources.has('fontawesome')) {
    console.log('[DynamicLoader] FontAwesome already loaded');
    return Promise.resolve();
  }

  console.log('[DynamicLoader] Loading FontAwesome...');
  
  const faURL = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css';
  
  // Register FontAwesome as platform resource
  registerPlatformResource({
    id: 'fontawesome-css',
    type: 'css',
    url: faURL,
    name: 'FontAwesome Icons'
  });
  
  fontAwesomeLoadPromise = loadCSS(faURL)
  .then(() => {
    loadedResources.add('fontawesome');
    
    // Mark as loaded - auto-injects into all shadow roots
    markResourceLoaded('fontawesome-css');
    
    console.log('[DynamicLoader] FontAwesome loaded and injected into shadow DOMs');
    fontAwesomeLoadPromise = null;
  })
  .catch((error) => {
    console.error('[DynamicLoader] FontAwesome load failed:', error);
    fontAwesomeLoadPromise = null;
    throw error;
  });

  return fontAwesomeLoadPromise;
}

/**
 * Check if HTML string contains FontAwesome classes
 */
export function containsFontAwesomeIcons(htmlString) {
  if (!htmlString) return false;
  
  const faPatterns = [
    /class=["'][^"']*\bfa-/,
    /class=["'][^"']*\bfas\b/,
    /class=["'][^"']*\bfar\b/,
    /class=["'][^"']*\bfab\b/
  ];
  
  return faPatterns.some(pattern => pattern.test(htmlString));
}

/**
 * Check if DOM element contains FontAwesome icons
 */
export function elementContainsFontAwesome(element) {
  if (!element) return false;
  
  const classes = element.className;
  if (typeof classes === 'string' && /\bfa-|\bfas\b|\bfar\b|\bfab\b/.test(classes)) {
    return true;
  }
  
  const icons = element.querySelectorAll('[class*="fa-"], .fas, .far, .fab');
  return icons.length > 0;
}

/**
 * Load FontAwesome if content needs it (auto-detection)
 */
export async function loadIconsIfNeeded(content) {
  let needsIcons = false;
  
  if (typeof content === 'string') {
    needsIcons = containsFontAwesomeIcons(content);
  } else if (content instanceof HTMLElement) {
    needsIcons = elementContainsFontAwesome(content);
  }
  
  if (needsIcons) {
    console.log('[DynamicLoader] Content contains FontAwesome icons, loading...');
    await loadFontAwesome();
  } else {
    console.log('[DynamicLoader] No FontAwesome icons detected in content');
  }
}

/**
 * Get icon HTML for common types
 * Returns FontAwesome HTML without loading the library
 * Caller is responsible for ensuring icons are loaded
 */
export function getTypeIcon(type) {
  switch (type) {
    case "module":
      return '<i class="fa-solid fa-gear"></i>';
    case "page":
      return '<i class="fa-regular fa-file"></i>';
    case "document":
      return '<i class="fa-regular fa-file-lines"></i>';
    case "folder":
      return '<i class="fa-regular fa-folder"></i>';
    case "back":
      return '<i class="fa-solid fa-caret-left"></i>';
    default:
      return '<i class="fa-solid fa-circle"></i>';
  }
}

/**
 * Get custom icon HTML
 * @param {string} iconClass - FontAwesome class (e.g., 'fa-solid fa-heart')
 */
export function getIcon(iconClass) {
  return `<i class="${iconClass}"></i>`;
}

/**
 * Render content with auto-loaded icons
 * Detects if content needs icons and loads them automatically
 * @param {string|HTMLElement} content - Content to render
 * @param {HTMLElement} container - Container to render into
 */
export async function renderWithIcons(content, container) {
  await loadIconsIfNeeded(content);
  
  if (typeof content === 'string') {
    container.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    container.appendChild(content);
  }
}
