/**
 * MathJax Loader
 * Loads MathJax globally for rendering in global scope containers
 * Platform Layer: Has document.head access for font injection
 */

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

  mathJaxLoadingPromise = new Promise((resolve, reject) => {
    // Configure MathJax BEFORE loading script
    window.MathJax = {
      tex: {
        inlineMath: [["\\(", "\\)"], ["$", "$"]],
        displayMath: [["\\[", "\\]"], ["$$", "$$"]]
      },
      chtml: {
        fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2'
      },
      options: {
        skipHtmlTags: ["script", "noscript", "style", "textarea", "pre"]
      },
      startup: {
        ready: () => {
          window.MathJax.startup.defaultReady();
          mathJaxLoaded = true;
          console.log('[MathJax Loader] MathJax loaded and ready (global scope)');
          resolve();
        }
      }
    };

    // Load MathJax from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
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
 * Typeset math equations in a container (MUST be in global scope, not shadow DOM)
 * @param {HTMLElement} container - Container in global document (not shadow root)
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