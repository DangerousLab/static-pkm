import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Theme type */
export type Theme = 'dark' | 'light';

/** Theme store state interface */
interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

/**
 * Theme store with localStorage persistence
 * Manages dark/light theme state
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',

      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark';
          console.log('[INFO] [themeStore] Theme toggled to:', newTheme);
          return { theme: newTheme };
        }),

      setTheme: (theme: Theme) => {
        console.log('[INFO] [themeStore] Theme set to:', theme);
        set({ theme });
      },
    }),
    {
      name: 'unstablon-theme',
    }
  )
);
