import { useEffect } from 'react';
import { useThemeStore, type Theme } from '@core/state/themeStore';

/**
 * Hook to apply theme effects to the document
 * - Sets data-theme attribute on html element
 * - Updates meta theme-color for mobile browsers
 * - Dispatches themechange event for legacy module compatibility
 */
export function useThemeEffect(): Theme {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    // Set theme attribute on document
    document.documentElement.setAttribute('data-theme', theme);

    // Update meta theme-color for mobile status bar
    const metaThemeColor = document.getElementById('theme-color-meta');
    if (metaThemeColor) {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--bg-deep').trim() || (theme === 'dark' ? '#1f1f1f' : '#f3f4f6');
      metaThemeColor.setAttribute('content', color);
    }

    // Dispatch event for legacy module compatibility
    window.dispatchEvent(
      new CustomEvent('themechange', {
        detail: { theme },
      })
    );

    console.log('[INFO] [useThemeEffect] Theme applied:', theme);
  }, [theme]);

  return theme;
}
