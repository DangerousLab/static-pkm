import Header from './Header';
import Sidebar from '@modules/sidebar/Sidebar';
import MainContent from './MainContent';
import LandscapeLeftBar from './LandscapeLeftBar';

/**
 * Main application shell component
 * Provides the grid layout structure for the app
 */
function AppShell(): React.JSX.Element {
  return (
    <>
      {/* Landscape mode left bar (mobile landscape only) */}
      <LandscapeLeftBar />

      {/* Main app grid */}
      <div className="app-shell grid min-h-screen grid-rows-[auto_1fr] grid-cols-1 pb-[env(safe-area-inset-bottom,0px)]">
        <Header />
        <Sidebar />
        <MainContent />
      </div>
    </>
  );
}

export default AppShell;
