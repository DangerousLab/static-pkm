import { useThemeStore } from '@core/state/themeStore';
import { useSidebarStore } from '@core/state/sidebarStore';
import SidebarToggle from '@modules/sidebar/SidebarToggle';

/**
 * Application header component
 * Contains logo, banner, tagline, and theme toggle
 */
function Header(): React.JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  // Dynamic image sources based on theme
  const logoSrc = theme === 'dark' ? './assets/logo-dark.png' : './assets/logo-light.png';
  const bannerSrc = theme === 'dark' ? './assets/banner-dark.png' : './assets/banner-light.png';

  return (
    <header className="app-header sticky top-0 z-50 bg-bg/95 backdrop-blur-sm">
      <div className="header-bar flex items-center justify-between px-4 h-header-height mobile:h-header-mobile">
        {/* Sidebar Toggle Button */}
        <SidebarToggle />

        {/* Logo and Banner */}
        <div className="header-center flex items-center gap-4 flex-1 justify-center">
          <div className="header-logo-wrap">
            <img
              src={logoSrc}
              alt="Unstablon Logo"
              className="header-logo-img h-12 w-auto animate-slide-up-fade"
              loading="eager"
            />
          </div>
          <div className="header-banner-wrap flex flex-col items-start">
            <img
              src={bannerSrc}
              alt="Unstablon"
              className="header-banner-img h-8 w-auto animate-slide-up-fade-delay-1"
              loading="eager"
            />
            <p className="header-tagline text-text-muted text-xs mt-1 animate-slide-up-fade-delay-2 hidden tablet:block">
              A static, modular PKM for experimental scientists
            </p>
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="theme-toggle p-2 rounded-full hover:bg-bg-hover transition-colors duration-fast"
          type="button"
          aria-label="Toggle theme"
        >
          <span className="text-xl">{theme === 'dark' ? '☾' : '☀'}</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
