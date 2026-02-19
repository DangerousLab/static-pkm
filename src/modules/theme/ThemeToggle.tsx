import { useThemeStore } from '@core/state/themeStore';
import { useThemeImages } from './useThemeImages';

/**
 * Theme toggle button component
 * Toggles between dark and light themes with preloaded images
 */
function ThemeToggle(): React.JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  // Preload theme images to prevent flicker
  useThemeImages();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle p-2 rounded-full hover:bg-bg-hover transition-colors duration-fast"
      type="button"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      <span className="text-xl transition-transform duration-normal hover:scale-110">
        <i className={theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun'} />
      </span>
    </button>
  );
}

export default ThemeToggle;
