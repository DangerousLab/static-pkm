import { useThemeStore } from '@core/state/themeStore';
import { useSidebarStore } from '@core/state/sidebarStore';
import { getThemeImagePaths } from '@modules/theme/useThemeImages';

/**
 * Application header component
 */
function Header(): React.JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const toggleSidebar = useSidebarStore((state) => state.toggle);
  const isOpen = useSidebarStore((state) => state.isOpen);

  const { logo: logoSrc, banner: bannerSrc } = getThemeImagePaths(theme);

  return (
    <header className="app-header">
      <div className="header-bar">
        {/* Sidebar Toggle Button */}
        <button
          id="sidebarToggle"
          className="sidebar-toggle"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
          data-open={isOpen}
          onClick={toggleSidebar}
        >
          <span className="sidebar-toggle-icon" />
          <span className="sidebar-toggle-label">Menu</span>
        </button>

        {/* Logo and Banner - centered */}
        <div className="header-center">
          <div className="header-logo-wrap">
            <img
              id="headerLogo"
              src={logoSrc}
              alt="Unstablon Logo"
              className="header-logo-img"
              loading="eager"
            />
          </div>
          <div className="header-banner-wrap">
            <img
              id="headerBanner"
              src={bannerSrc}
              alt="Unstablon"
              className="header-banner-img"
              loading="eager"
            />
            <p className="header-tagline">A static, modular PKM for experimental scientists</p>
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          id="themeToggle"
          className="theme-toggle"
          type="button"
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          <span id="themeIcon">{theme === 'dark' ? '☾' : '☀'}</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
