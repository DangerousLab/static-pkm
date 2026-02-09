/**
 * Central Loader Registry
 * Provides unified access to all lazy-loaded libraries
 */

import { 
  loadFontAwesome,
  elementContainsFontAwesome
} from './fontawesome-loader.js';
import { 
  loadMathJax, 
  typesetMath 
} from './mathjax-loader.js';

// Re-export MathJax loader
export { loadMathJax, typesetMath } from './mathjax-loader.js';

// Re-export FontAwesome loader + helpers
export { 
  loadFontAwesome,
  containsFontAwesomeIcons,
  elementContainsFontAwesome,
  loadIconsIfNeeded,
  getTypeIcon, 
  getIcon,
  renderWithIcons
} from './fontawesome-loader.js';

// Future loaders can be added here:
// export { loadChartJS } from './chartjs-loader.js';
// export { loadPrism } from './prism-loader.js';

/**
 * Auto-render all passive content (icons, math, etc.)
 * Scans container and loads only what's needed
 * @param {HTMLElement} container - Container to scan and render
 * @returns {Promise<void>}
 */
export async function autoRender(container) {
  if (!container) return;
  
  console.log('[Loader] Auto-rendering passive content...');
  
  const loadPromises = [];
  
  // Check for FontAwesome icons
  if (elementContainsFontAwesome(container)) {
    console.log('[Loader] Detected FontAwesome icons');
    loadPromises.push(loadFontAwesome());
  }
  
  // Check for MathJax (look for \( \) or \[ \] patterns)
  const html = container.innerHTML;
  if (/\\\(|\\\[|\$\$?/.test(html)) {
    console.log('[Loader] Detected math expressions');
    loadPromises.push(loadMathJax().then(() => typesetMath(container)));
  }
  
  // Load all detected libraries in parallel
  if (loadPromises.length > 0) {
    await Promise.all(loadPromises);
    console.log('[Loader] Auto-render complete');
  } else {
    console.log('[Loader] No passive content detected');
  }
}

/**
 * Re-render passive content after dynamic DOM updates
 * Assumes libraries are already loaded (use after initial autoRender)
 * For user modules that update innerHTML dynamically
 * @param {HTMLElement} container - Container with updated content
 * @returns {Promise<void>}
 */
export async function dynamicRender(container) {
  if (!container) return;
  
  console.log('[Loader] Dynamic re-render...');
  
  // Just re-typeset, don't reload libraries
  // MathJax is already loaded from initial autoRender
  if (window.MathJax?.typesetPromise) {
    await typesetMath(container);
    console.log('[Loader] Dynamic re-render complete');
  }
  
  // Icons don't need re-rendering (CSS-based, no JS needed after load)
  // Add other library re-renders here if needed in future
}