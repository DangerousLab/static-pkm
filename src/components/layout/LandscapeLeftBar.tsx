import { useThemeStore } from '@core/state/themeStore';
import { useSidebarStore } from '@core/state/sidebarStore';

/**
 * Landscape mode left bar component
 * Shows on mobile devices in landscape orientation
 * Contains sidebar toggle, logo, and theme toggle in vertical layout
 */
function LandscapeLeftBar(): React.JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const toggleSidebar = useSidebarStore((state) => state.toggle);
  const isOpen = useSidebarStore((state) => state.isOpen);

  const logoSrc = theme === 'dark' ? './assets/logo-dark.png' : './assets/logo-light.png';

  return (
    <div className="landscape-leftbar fixed left-0 top-0 bottom-0 w-landscape-bar flex-col items-center justify-between py-4 bg-bg-panel z-50 hidden landscape:flex">
      {/* Toggle button at top */}
      <button
        onClick={toggleSidebar}
        className="landscape-leftbar-toggle sidebar-toggle p-2 rounded-md hover:bg-bg-hover transition-colors"
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={isOpen}
      >
        <span className="sidebar-toggle-icon block w-5 h-0.5 bg-text-main relative before:absolute before:w-full before:h-full before:bg-text-main before:-top-1.5 after:absolute after:w-full after:h-full after:bg-text-main after:top-1.5" />
      </button>

      {/* Logo in middle */}
      <div className="landscape-leftbar-logo">
        <img src={logoSrc} alt="Logo" className="w-8 h-auto" loading="eager" />
      </div>

      {/* Theme toggle at bottom */}
      <button
        onClick={toggleTheme}
        className="theme-toggle p-2 rounded-full hover:bg-bg-hover transition-colors"
        type="button"
        aria-label="Toggle theme"
      >
        <span className="text-lg">{theme === 'dark' ? '☾' : '☀'}</span>
      </button>
    </div>
  );
}

export default LandscapeLeftBar;
