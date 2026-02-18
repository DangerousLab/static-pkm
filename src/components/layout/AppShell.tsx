import Header from './Header';
import Sidebar from '@modules/sidebar/Sidebar';
import MainContent from './MainContent';
import LandscapeLeftBar from './LandscapeLeftBar';

/**
 * Main application shell component
 */
function AppShell(): React.JSX.Element {
  return (
    <>
      {/* Landscape mode left bar (mobile landscape only - controlled by CSS) */}
      <LandscapeLeftBar />

      {/* Main app grid */}
      <div className="app-shell">
        <Header />
        <Sidebar />
        <MainContent />
      </div>
    </>
  );
}

export default AppShell;
