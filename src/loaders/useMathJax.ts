import { useEffect, useCallback, useState } from 'react';

/** MathJax CDN URL */
const MATHJAX_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';

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
  console.log('[INFO] [useMathJax] Loading MathJax from CDN');

  loadPromise = new Promise((resolve, reject) => {
    // Configure MathJax before loading
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
      },
      svg: {
        fontCache: 'global',
      },
      startup: {
        ready: () => {
          console.log('[INFO] [useMathJax] MathJax ready');
          globalLoadState = 'loaded';
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
   */
  const typeset = useCallback(async (element?: HTMLElement): Promise<void> => {
    if (!window.MathJax?.typesetPromise) {
      console.warn('[WARN] [useMathJax] MathJax not loaded');
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
