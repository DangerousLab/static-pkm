/**
 * Vault selector component
 * Displays current vault and allows selecting a new vault folder
 */

import { useVault } from '@hooks/useVault';
import { isTauriContext } from '@core/ipc/commands';

/**
 * VaultSelector component
 * Shows current vault name or "Select Vault" button
 * Disabled in PWA mode (shows "Demo Vault")
 */
function VaultSelector(): React.JSX.Element {
  const { currentVault, isLoading, selectVault } = useVault();
  const isTauri = isTauriContext();

  // Click handler
  const handleClick = (): void => {
    if (!isTauri || isLoading) return;
    selectVault();
  };

  // Display name
  const displayName = currentVault?.name || 'Select Vault';
  const isPWAMode = !isTauri;

  return (
    <div className="sidebar-vault">
      <button
        className="vault-selector"
        onClick={handleClick}
        disabled={isPWAMode || isLoading}
        aria-label={isPWAMode ? 'Demo vault (read-only)' : 'Select vault folder'}
        title={
          isPWAMode
            ? 'Demo vault (read-only)'
            : currentVault
            ? `Current vault: ${currentVault.path}`
            : 'Click to select a vault folder'
        }
      >
        {/* Folder icon */}
        <svg
          className="vault-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>

        {/* Vault name */}
        <span className="vault-name">
          {isLoading ? 'Loading...' : isPWAMode ? 'Demo Vault' : displayName}
        </span>

        {/* Chevron icon (only show in Tauri mode when not loading) */}
        {!isPWAMode && !isLoading && (
          <svg
            className="vault-chevron"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div className="vault-spinner">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="spinner"
            >
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
            </svg>
          </div>
        )}
      </button>
    </div>
  );
}

export default VaultSelector;
