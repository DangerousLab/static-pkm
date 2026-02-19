import { useThemeStore } from '@core/state/themeStore';
import { useSidebarStore } from '@core/state/sidebarStore';
import { getThemeImagePaths } from '@modules/theme/useThemeImages';

/**
 * Landscape mode left bar component
 * Shows on mobile devices in landscape orientation only (controlled by CSS)
 * Uses original CSS class names for responsive layout
 */
function LandscapeLeftBar(): React.JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const toggleSidebar = useSidebarStore((state) => state.toggle);
  const isOpen = useSidebarStore((state) => state.isOpen);

  const { logo: logoSrc } = getThemeImagePaths(theme);

  return (
    <div className="landscape-leftbar">
      {/* Toggle button at top */}
      <button
        id="landscapeToggle"
        className="landscape-leftbar-toggle sidebar-toggle"
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={isOpen}
        data-open={isOpen}
        onClick={toggleSidebar}
      >
        <span className="sidebar-toggle-icon" />
      </button>

      {/* Logo in middle */}
      <div className="landscape-leftbar-logo">
        <img
          id="landscapeLogo"
          src={logoSrc}
          alt="Logo"
          loading="eager"
        />
      </div>

      {/* Theme toggle at bottom */}
      <button
        id="landscapeThemeToggle"
        className="theme-toggle"
        type="button"
        aria-label="Toggle theme"
        onClick={toggleTheme}
      >
        <span id="landscapeThemeIcon">
          <i className={theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun'} />
        </span>
      </button>
    </div>
  );
}

export default LandscapeLeftBar;
