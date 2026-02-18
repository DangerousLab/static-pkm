import { useEffect, useRef } from 'react';

/** Theme image paths */
const THEME_IMAGES = {
  dark: {
    logo: './assets/logo-dark.png',
    banner: './assets/banner-dark.png',
  },
  light: {
    logo: './assets/logo-light.png',
    banner: './assets/banner-light.png',
  },
};

/** Cache for preloaded images */
const imageCache: Map<string, HTMLImageElement> = new Map();

/**
 * Preload an image and cache it
 */
function preloadImage(src: string): Promise<HTMLImageElement> {
  // Return cached image if available
  const cached = imageCache.get(src);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Hook to preload theme images on mount
 * Prevents image flicker when switching themes
 */
export function useThemeImages(): void {
  const preloaded = useRef(false);

  useEffect(() => {
    if (preloaded.current) return;
    preloaded.current = true;

    console.log('[INFO] [useThemeImages] Preloading theme images');

    // Preload all theme images
    const allImages = [
      ...Object.values(THEME_IMAGES.dark),
      ...Object.values(THEME_IMAGES.light),
    ];

    Promise.all(allImages.map(preloadImage))
      .then(() => {
        console.log('[INFO] [useThemeImages] All theme images preloaded');
      })
      .catch((err) => {
        console.warn('[WARN] [useThemeImages] Failed to preload some images:', err);
      });
  }, []);
}

/**
 * Get preloaded image element
 */
export function getPreloadedImage(src: string): HTMLImageElement | undefined {
  return imageCache.get(src);
}

/**
 * Get theme image paths
 */
export function getThemeImagePaths(theme: 'dark' | 'light'): {
  logo: string;
  banner: string;
} {
  return THEME_IMAGES[theme];
}
