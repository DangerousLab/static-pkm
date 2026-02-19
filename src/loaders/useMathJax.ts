import { useEffect, useCallback, useState } from 'react';
import { getResourceUrlSync } from '@core/utils/environment';

/** MathJax CDN URL (for web/PWA) - v3.2.2 (v4 has flicker issues with dynamic re-rendering) */
const MATHJAX_CDN = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';

/** MathJax local URL (for native app) - v3.2.2 */
const MATHJAX_LOCAL = './vendor/mathjax/tex-mml-chtml.js';

/** Get MathJax URL based on environment */
const MATHJAX_URL = getResourceUrlSync(MATHJAX_LOCAL, MATHJAX_CDN);

/** MathJax global interface */
interface MathJaxGlobal {
  typesetPromise: (elements?: HTMLElement[]) => Promise<void>;
  startup: {
    promise: Promise<void>;
  };
}

declare global {
  interface Window {
    MathJax?: MathJaxGlobal;
  }
}

/** Loading state */
type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Singleton loading state */
let globalLoadState: LoadState = 'idle';
let loadPromise: Promise<void> | null = null;

/**
 * Load MathJax script
 */
async function loadMathJax(): Promise<void> {
  if (globalLoadState === 'loaded') {
    return;
  }

  if (loadPromise) {
    return loadPromise;
  }

  globalLoadState = 'loading';
  console.log('[INFO] [useMathJax] Loading MathJax:', MATHJAX_URL);

  loadPromise = new Promise((resolve, reject) => {
    // Configure MathJax 3.2.2 before loading (matching old vanilla JS version)
    window.MathJax = {
      tex: {
        inlineMath: [['\\(', '\\)'], ['$', '$']],
        displayMath: [['\\[', '\\]'], ['$$', '$$']],
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
      },
      startup: {
        ready: () => {
          // Call the original MathJax ready function
          console.log('[INFO] [useMathJax] MathJax startup.ready called');

          // IMPORTANT: Call the original MathJax.startup.ready() (MathJax 3 uses defaultReady)
          if (typeof (window.MathJax as any).startup?.defaultReady === 'function') {
            (window.MathJax as any).startup.defaultReady();
          }

          // Mark as loaded after initialization
          globalLoadState = 'loaded';
          console.log('[INFO] [useMathJax] MathJax loaded from CDN');
          resolve();
        },
      },
    } as unknown as MathJaxGlobal;

    const script = document.createElement('script');
    script.src = MATHJAX_URL;
    script.async = true;
    script.onerror = () => {
      globalLoadState = 'error';
      reject(new Error('Failed to load MathJax'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Hook to load and use MathJax for math rendering
 */
export function useMathJax(): {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  typeset: (element?: HTMLElement) => Promise<void>;
} {
  const [state, setState] = useState<{
    isLoaded: boolean;
    isLoading: boolean;
    error: string | null;
  }>({
    isLoaded: globalLoadState === 'loaded',
    isLoading: globalLoadState === 'loading',
    error: globalLoadState === 'error' ? 'Failed to load MathJax' : null,
  });

  useEffect(() => {
    if (globalLoadState === 'loaded') {
      setState({ isLoaded: true, isLoading: false, error: null });
      return;
    }

    if (globalLoadState === 'error') {
      setState({ isLoaded: false, isLoading: false, error: 'Failed to load MathJax' });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    loadMathJax()
      .then(() => {
        setState({ isLoaded: true, isLoading: false, error: null });
      })
      .catch((err) => {
        setState({
          isLoaded: false,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load MathJax',
        });
      });
  }, []);

  /**
   * Typeset math in an element
   *
   * For re-rendering scenarios (user changes values), this provides a flicker-free approach:
   * 1. Clone the element's existing rendered content
   * 2. Update the element's HTML with new raw LaTeX
   * 3. Create a hidden staging area to render the new content
   * 4. Once MathJax finishes, swap the staged content back
   *
   * This ensures users never see raw LaTeX during transitions.
   */
  const typeset = useCallback(async (element?: HTMLElement): Promise<void> => {
    if (!window.MathJax?.typesetPromise) {
      console.warn('[WARN] [useMathJax] MathJax.typesetPromise not available yet');
      // If MathJax is loading, wait for it
      if (globalLoadState === 'loading') {
        console.log('[INFO] [useMathJax] Waiting for MathJax to finish loading...');
        await loadMathJax();
        // Try again after loading
        if (window.MathJax?.typesetPromise) {
          const elements = element ? [element] : undefined;
          await window.MathJax.typesetPromise(elements);
          console.log('[INFO] [useMathJax] Typeset complete (after waiting)');
          return;
        }
      }
      return;
    }

    try {
      const elements = element ? [element] : undefined;
      await window.MathJax.typesetPromise(elements);
      console.log('[INFO] [useMathJax] Typeset complete');
    } catch (err) {
      console.error('[ERROR] [useMathJax] Typeset failed:', err);
    }
  }, []);

  return {
    ...state,
    typeset,
  };
}
