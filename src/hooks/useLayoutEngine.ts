import { useState, useEffect } from 'react';
import type { LayoutGeometry, UserLayoutPrefs, PlatformInfo } from '../types/layout';
import { getPlatformInfo, setPlatformOverrides, getCachedPlatformInfo } from '../core/layout/platformAdapter';
import { computeLayout } from '../core/layout/appLayoutEngine';
import { applyLayoutGeometry } from '../core/layout/cssPropertyBridge';
import { invalidateOracle, computeAll } from '../core/layout/layoutOracle';
import { getCurrentNoteManifests, getCurrentNoteId } from '../core/layout/oracleCoordinator';

// Module-level geometry cache
let cachedGeometry: LayoutGeometry | null = null;

export function getCachedGeometry(): LayoutGeometry | null {
  return cachedGeometry;
}

const LAYOUT_CONFIG = {
  defaultSidebarWidth: 240,
  minSidebarWidth: 180,
  maxSidebarWidth: 400,
  headerHeight: 90,
  statusBarHeight: 24,
  rightPanelDefaultWidth: 280,
  landscapeLeftBarWidth: 44,
  contentMaxWidth: 900,
};

const DEFAULT_GEOMETRY: LayoutGeometry = {
  headerHeight: 90,
  sidebarWidth: 240,
  sidebarCollapsed: false,
  editorLeft: 0,
  editorWidth: typeof window !== 'undefined' ? window.innerWidth : 800,
  contentMaxWidth: 900,
  rightPanelWidth: 0,
  landscapeLeftBarWidth: 0,
  isMobile: false,
  isLandscape: false,
  safeTop: 90,
  safeBottom: 8,
  statusBarHeight: 24,
  cssVariables: {},
};

function readCssSafeAreaInsets(): PlatformInfo['safeAreaInsets'] {
  const div = document.createElement('div');
  div.style.paddingTop = 'env(safe-area-inset-top, 0px)';
  div.style.paddingRight = 'env(safe-area-inset-right, 0px)';
  div.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
  div.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
  
  // Need to append to DOM to get computed style
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  document.body.appendChild(div);
  
  const style = getComputedStyle(div);
  const parsePx = (val: string) => parseFloat(val) || 0;
  
  const insets = {
    top: parsePx(style.paddingTop),
    right: parsePx(style.paddingRight),
    bottom: parsePx(style.paddingBottom),
    left: parsePx(style.paddingLeft),
  };
  
  document.body.removeChild(div);
  return insets;
}

function windowSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

export function useLayoutEngine(prefs: UserLayoutPrefs): {
  geometry: LayoutGeometry;
  isReady: boolean;
} {
  const [geometry, setGeometry] = useState<LayoutGeometry>(cachedGeometry || DEFAULT_GEOMETRY);
  const [isReady, setIsReady] = useState<boolean>(cachedGeometry !== null);

  // Effect 1: Platform init
  useEffect(() => {
    let cancelled = false;

    async function initPlatform() {
      await setPlatformOverrides({
        devicePixelRatio: window.devicePixelRatio,
        safeAreaInsets: readCssSafeAreaInsets(),
      });
      if (cancelled) return;

      const platform = await getPlatformInfo();
      if (cancelled) return;

      const geo = computeLayout(platform, LAYOUT_CONFIG, windowSize(), prefs);
      applyLayoutGeometry(geo);
      cachedGeometry = geo;
      setGeometry(geo);
      setIsReady(true);
    }

    initPlatform();

    return () => {
      cancelled = true;
    };
    // Initialize once on mount. We don't want to re-run this if prefs change, 
    // that's handled in Effect 3.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 2: Window resize
  useEffect(() => {
    let timeoutId: number;
    
    const handleResize = () => {
      // Debounce the resize event locally
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const platform = getCachedPlatformInfo();
        if (!platform) return;
        
        const geo = computeLayout(platform, LAYOUT_CONFIG, windowSize(), prefs);
        applyLayoutGeometry(geo);
        cachedGeometry = geo;
        setGeometry(geo);
        
        // Phase 2 integration point: Re-measure block heights if width changed
        invalidateOracle();
        const manifests = getCurrentNoteManifests();
        const noteId = getCurrentNoteId();
        if (manifests.length > 0 && noteId) {
          computeAll(manifests, geo.editorWidth, noteId);
          // Note: Virtual scroll layers will automatically read the updated
          // heights from the Layout Oracle during their next render cycle.
        }
      }, 50);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.clearTimeout(timeoutId);
    };
  }, [prefs]); // Need prefs dependency to recompute correctly on resize with current prefs

  // Effect 3: Prefs change
  useEffect(() => {
    if (!isReady) return;
    
    const platform = getCachedPlatformInfo();
    if (!platform) return;
    
    const geo = computeLayout(platform, LAYOUT_CONFIG, windowSize(), prefs);
    applyLayoutGeometry(geo);
    cachedGeometry = geo;
    setGeometry(geo);
    
    // Phase 2 integration point: Re-measure block heights
    invalidateOracle();
    const manifests = getCurrentNoteManifests();
    const noteId = getCurrentNoteId();
    if (manifests.length > 0 && noteId) {
      computeAll(manifests, geo.editorWidth, noteId);
    }
  }, [prefs.sidebarWidth, prefs.sidebarCollapsed, prefs.rightPanelOpen, prefs.rightPanelWidth, isReady]);

  return { geometry, isReady };
}
