/**
 * Vault-related type definitions
 * Defines vault configuration and state interfaces
 */

/**
 * Vault configuration
 * Stores vault metadata and path
 */
export interface VaultConfig {
  /** Absolute path to vault folder */
  path: string;

  /** Display name (folder name) */
  name: string;

  /** Last opened timestamp (milliseconds since epoch) */
  lastOpened: number;
}

/**
 * Vault state interface
 * Used by vaultStore for managing vault state
 */
export interface VaultState {
  /** Currently selected vault configuration (null if no vault selected) */
  currentVault: VaultConfig | null;

  /** Loading state for vault operations */
  isLoading: boolean;

  /** Error message (null if no error) */
  error: string | null;

  /** Initialization state - true after first load attempt */
  isInitialized: boolean;

  // Actions
  /** Set current vault */
  setVault: (vault: VaultConfig) => void;

  /** Clear current vault */
  clearVault: () => void;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error message */
  setError: (error: string | null) => void;

  /** Set initialization state */
  setInitialized: (initialized: boolean) => void;
}
