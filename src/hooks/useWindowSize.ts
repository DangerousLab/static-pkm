import { useState, useEffect } from 'react';

interface WindowSize {
  width: number;
  height: number;
}

/**
 * Hook to track window size
 * Updates on resize with debounce
 */
export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleResize = (): void => {
      // Debounce resize events
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return windowSize;
}

/**
 * Check if window is mobile width
 */
export function useIsMobile(): boolean {
  const { width } = useWindowSize();
  return width < 600;
}

/**
 * Check if window is tablet width
 */
export function useIsTablet(): boolean {
  const { width } = useWindowSize();
  return width >= 600 && width < 1024;
}

/**
 * Check if window is in landscape orientation
 */
export function useIsLandscape(): boolean {
  const { width, height } = useWindowSize();
  return width > height && height < 600;
}

/**
 * Check if sidebar should auto-close on content/item click
 * Based on viewport width and content layout
 *
 * Breakpoints:
 * - Mobile (<600px): Always auto-close
 * - Tablet/narrow (<841px): Always auto-close
 * - Desktop: Auto-close if sidebar overlaps centered content-card
 *
 * Formula: content-card + (2 × sidebar) + (2 × padding)
 * All values read dynamically from DOM/CSS
 */
export function useShouldAutoCloseSidebar(): boolean {
  const { width, height } = useWindowSize();

  // Always auto-close in landscape mode (phone sideways)
  if (width > height && height < 600) {
    return true;
  }

  // Always auto-close below tablet breakpoint
  if (width < 841) {
    return true;
  }

  // Read actual values from DOM
  const sidebar = document.getElementById('sidebar');
  const pageRoot = document.querySelector('.page-root') as HTMLElement | null;

  // Get sidebar width from element or CSS
  const sidebarWidth = sidebar?.offsetWidth ?? 320;

  // Get content-card max-width from computed style
  const contentCardMaxWidth = pageRoot
    ? parseInt(getComputedStyle(pageRoot).maxWidth, 10) || 980
    : 980;

  // Get padding from CSS variable
  const rootStyles = getComputedStyle(document.documentElement);
  const padding = parseFloat(rootStyles.getPropertyValue('--space-md')) * 16 || 16;

  // Formula: content-card + (2 × sidebar) + (2 × padding)
  const minWidthNoOverlap = contentCardMaxWidth + (2 * sidebarWidth) + (2 * padding);

  return width < minWidthNoOverlap;
}
