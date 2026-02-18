import { useEffect, useState } from 'react';

/** FontAwesome CDN URL */
const FONTAWESOME_URL = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';

/** Loading state */
type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Singleton loading state */
let globalLoadState: LoadState = 'idle';
let loadPromise: Promise<void> | null = null;

/**
 * Load FontAwesome stylesheet
 */
async function loadFontAwesome(): Promise<void> {
  if (globalLoadState === 'loaded') {
    return;
  }

  if (loadPromise) {
    return loadPromise;
  }

  // Check if already loaded
  const existing = document.querySelector(`link[href="${FONTAWESOME_URL}"]`);
  if (existing) {
    globalLoadState = 'loaded';
    return;
  }

  globalLoadState = 'loading';
  console.log('[INFO] [useFontAwesome] Loading FontAwesome from CDN');

  loadPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTAWESOME_URL;
    link.onload = () => {
      console.log('[INFO] [useFontAwesome] FontAwesome loaded');
      globalLoadState = 'loaded';
      resolve();
    };
    link.onerror = () => {
      globalLoadState = 'error';
      reject(new Error('Failed to load FontAwesome'));
    };
    document.head.appendChild(link);
  });

  return loadPromise;
}

/**
 * Hook to load FontAwesome icons
 */
export function useFontAwesome(): {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<{
    isLoaded: boolean;
    isLoading: boolean;
    error: string | null;
  }>({
    isLoaded: globalLoadState === 'loaded',
    isLoading: globalLoadState === 'loading',
    error: globalLoadState === 'error' ? 'Failed to load FontAwesome' : null,
  });

  useEffect(() => {
    if (globalLoadState === 'loaded') {
      setState({ isLoaded: true, isLoading: false, error: null });
      return;
    }

    if (globalLoadState === 'error') {
      setState({ isLoaded: false, isLoading: false, error: 'Failed to load FontAwesome' });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    loadFontAwesome()
      .then(() => {
        setState({ isLoaded: true, isLoading: false, error: null });
      })
      .catch((err) => {
        setState({
          isLoaded: false,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load FontAwesome',
        });
      });
  }, []);

  return state;
}

/**
 * Ensure FontAwesome is loaded (imperative API)
 */
export async function ensureFontAwesome(): Promise<void> {
  return loadFontAwesome();
}
