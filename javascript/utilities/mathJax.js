// javascript/utilities/mathJax.js
// Global MathJax utility - loads once, shared across all modules

let mathJaxLoaded = false;
let mathJaxLoadingPromise = null;

/**
 * Load MathJax globally (lazy-loaded on first use)
 * Hybrid approach: JS from local, fonts from CDN
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

  console.log('[MathJax Utility] Loading MathJax (hybrid mode)...');

  mathJaxLoadingPromise = new Promise((resolve, reject) => {
    // Configure MathJax before loading
    window.MathJax = {
      tex: {
        inlineMath: [["\\(", "\\)"], ["$", "$"]],
        displayMath: [["\\[", "\\]"], ["$$", "$$"]]
      },
      chtml: {
        // Use CDN for fonts (default jsdelivr path)
        fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2'
      },
      options: {
        skipHtmlTags: ["script", "noscript", "style", "textarea", "pre"]
      },
      startup: {
        ready: () => {
          window.MathJax.startup.defaultReady();
          mathJaxLoaded = true;
          console.log('[MathJax Utility] MathJax loaded (JS: local, fonts: CDN)');
          resolve();
        }
      }
    };

    // Load main bundle from local vendor directory
    const script = document.createElement('script');
    script.src = './vendor/mathjax/tex-mml-chtml.js';
    script.async = true;
    script.onerror = () => {
      console.error('[MathJax Utility] Failed to load MathJax bundle');
      console.error('[MathJax Utility] Make sure to run: npm run setup:mathjax');
      reject(new Error('Failed to load MathJax bundle'));
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
 * Typeset math equations in a specific container
 * Automatically loads MathJax if not already loaded
 * @param {HTMLElement} container - Container element to typeset
 * @returns {Promise<void>}
 */
export async function typesetMath(container) {
  await loadMathJax();

  if (window.MathJax?.typesetPromise) {
    await window.MathJax.typesetPromise([container]);
  }
}
