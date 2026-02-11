/**
 * MathJax Loader
 * Loads MathJax globally for rendering in global scope containers
 * Platform Layer: Has document.head access for font injection
 */

import { registerPlatformResource, markResourceLoaded } from './platform-resources.js';

let mathJaxLoaded = false;
let mathJaxLoadingPromise = null;

/**
 * Load MathJax globally (lazy-loaded on first use)
 * Safe to call multiple times - only loads once
 * @returns {Promise<void>}
 */
export async function loadMathJax() {
  if (mathJaxLoaded) {
    return Promise.resolve();
  }

  if (mathJaxLoadingPromise) {
    return mathJaxLoadingPromise;
  }

  console.log('[MathJax Loader] Loading MathJax from CDN...');
  
  // Register MathJax output styles as platform resource
  registerPlatformResource({
    id: 'mathjax-output-css',
    type: 'style',
    name: 'MathJax Output CSS',
    content: `
      /* MathJax SVG Output Styling */
      mjx-container {
        display: inline-block;
        margin: 0;
        padding: 0;
      }
      
      mjx-container[display="true"] {
        display: block;
        margin: 1em 0;
        text-align: center;
      }
      
      /* Inherit theme colors */
      mjx-container {
        color: inherit;
      }
      
      mjx-container svg {
        display: inline-block;
        vertical-align: middle;
      }
    `
  });

  mathJaxLoadingPromise = new Promise((resolve, reject) => {
    // Configure MathJax BEFORE loading script
    window.MathJax = {
      tex: {
        inlineMath: [["\\(", "\\)"], ["$", "$"]],
        displayMath: [["\\[", "\\]"], ["$$", "$$"]]
      },
      svg: {
        fontCache: 'global'  // Use SVG output (works better with shadow DOM)
      },
      options: {
        skipHtmlTags: ["script", "noscript", "style", "textarea", "pre"]
      },
      startup: {
        ready: () => {
          window.MathJax.startup.defaultReady();
          mathJaxLoaded = true;
          
          // Mark CSS resource as loaded (auto-injects into all shadow roots)
          markResourceLoaded('mathjax-output-css');
          
          console.log('[MathJax Loader] MathJax loaded and styles injected into shadow DOMs');
          resolve();
        }
      }
    };

    // Load MathJax from CDN (use SVG output for shadow DOM compatibility)
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    script.async = true;
    script.onerror = () => {
      console.error('[MathJax Loader] Failed to load MathJax from CDN');
      mathJaxLoadingPromise = null;
      reject(new Error('Failed to load MathJax'));
    };
    document.head.appendChild(script);
  });

  return mathJaxLoadingPromise;
}

/**
 * Check if MathJax is already loaded
 * @returns {boolean}
 */
export function isMathJaxLoaded() {
  return mathJaxLoaded;
}

/**
 * Typeset math equations in ANY container (shadow DOM or global scope)
 * Platform Resources system handles style injection automatically
 * @param {HTMLElement} container - Container with LaTeX equations
 * @returns {Promise<void>}
 */
export async function typesetMath(container) {
  if (!container) {
    console.warn('[MathJax Loader] typesetMath called with null container');
    return;
  }

  await loadMathJax();

  if (window.MathJax?.typesetPromise) {
    try {
      console.log('[MathJax Loader] Typesetting math in global scope container...');
      await window.MathJax.typesetPromise([container]);
      console.log('[MathJax Loader] Typesetting complete');
    } catch (error) {
      console.error('[MathJax Loader] Typesetting failed:', error);
    }
  }
}