/**
 * Vault management hook
 * Combines vault store with IPC operations for folder selection and loading
 */

import { useCallback } from 'react';
import { useVaultStore } from '@core/state/vaultStore';
import { useNavigationStore } from '@core/state/navigationStore';
import { selectVaultFolder, getNavigationTree, isTauriContext } from '@core/ipc/commands';
import type { VaultConfig } from '@/types/vault';

export interface UseVaultReturn {
  /** Current vault configuration (null if no vault selected) */
  currentVault: VaultConfig | null;

  /** Loading state */
  isLoading: boolean;

  /** Error message (null if no error) */
  error: string | null;

  /** Initialization state */
  isInitialized: boolean;

  /** Open folder picker and load selected vault */
  selectVault: () => Promise<void>;

  /** Load vault from given path */
  loadVault: (path: string, name: string) => Promise<void>;

  /** Initialize from persisted vault (call on app startup) */
  initializeFromPersistedVault: () => Promise<void>;

  /** Clear current vault */
  clearVault: () => void;
}

/**
 * Hook for vault management
 * Provides functions to select, load, and clear vaults
 */
export function useVault(): UseVaultReturn {
  const currentVault = useVaultStore((state) => state.currentVault);
  const isLoading = useVaultStore((state) => state.isLoading);
  const error = useVaultStore((state) => state.error);
  const isInitialized = useVaultStore((state) => state.isInitialized);

  const setVault = useVaultStore((state) => state.setVault);
  const clearVaultState = useVaultStore((state) => state.clearVault);
  const setLoading = useVaultStore((state) => state.setLoading);
  const setError = useVaultStore((state) => state.setError);
  const setInitialized = useVaultStore((state) => state.setInitialized);

  const setNavigationTree = useNavigationStore((state) => state.setNavigationTree);
  const resetNavigation = useNavigationStore((state) => state.reset);

  /**
   * Load vault from given path
   * Validates path and loads navigation tree
   */
  const loadVault = useCallback(
    async (path: string, name: string): Promise<void> => {
      console.log('[INFO] [useVault] Loading vault:', path);
      setLoading(true);
      setError(null);

      try {
        // Call backend to generate navigation tree from path
        const tree = await getNavigationTree(path);

        // Validate tree has content
        if (!tree || !tree.children || tree.children.length === 0) {
          console.warn('[WARN] [useVault] Vault is empty or invalid');
          setError('Selected folder is empty or not a valid vault');
          setLoading(false);
          return;
        }

        // Update vault store
        const vault: VaultConfig = {
          path,
          name,
          lastOpened: Date.now(),
        };
        setVault(vault);

        // Update navigation tree
        setNavigationTree(tree);

        // Debug: log tree structure
        console.log('[DEBUG] [useVault] Navigation tree:', {
          name: tree.name,
          path: tree.path,
          childrenCount: tree.children?.length || 0,
          children: tree.children?.slice(0, 5).map(c => ({
            type: c.type,
            name: 'name' in c ? c.name : 'unknown',
            hasId: 'id' in c,
            hasFile: 'file' in c,
            hasTitle: 'title' in c,
          })) || []
        });
        console.log('[DEBUG] [useVault] Full first child:', tree.children?.[0]);

        console.log('[INFO] [useVault] Vault loaded successfully');
      } catch (err) {
        console.error('[ERROR] [useVault] Failed to load vault:', err);
        setError(err instanceof Error ? err.message : 'Failed to load vault');
        resetNavigation();
      } finally {
        setLoading(false);
      }
    },
    [setVault, setLoading, setError, setNavigationTree, resetNavigation]
  );

  /**
   * Open folder picker and load selected vault
   */
  const selectVault = useCallback(async (): Promise<void> => {
    console.log('[INFO] [useVault] Opening folder picker');

    try {
      const result = await selectVaultFolder();

      // User cancelled or PWA mode
      if (!result.path || !result.name) {
        console.log('[INFO] [useVault] No folder selected');
        return;
      }

      // Load the selected vault
      await loadVault(result.path, result.name);
    } catch (err) {
      console.error('[ERROR] [useVault] Failed to select vault:', err);
      setError(err instanceof Error ? err.message : 'Failed to select vault');
    }
  }, [loadVault, setError]);

  /**
   * Initialize from persisted vault
   * Called on app startup to restore previous vault
   */
  const initializeFromPersistedVault = useCallback(async (): Promise<void> => {
    console.log('[INFO] [useVault] Initializing from persisted vault');

    // Only run in Tauri mode
    if (!isTauriContext()) {
      console.log('[INFO] [useVault] PWA mode - skipping vault initialization');
      setInitialized(true);
      return;
    }

    // Already initialized
    if (isInitialized) {
      console.log('[INFO] [useVault] Already initialized');
      return;
    }

    // No persisted vault
    if (!currentVault) {
      console.log('[INFO] [useVault] No persisted vault found');
      setInitialized(true);
      return;
    }

    // Try to load persisted vault
    try {
      console.log('[INFO] [useVault] Restoring vault:', currentVault.name);
      await loadVault(currentVault.path, currentVault.name);
    } catch (err) {
      console.error('[ERROR] [useVault] Failed to restore vault:', err);
      // Clear invalid vault
      clearVaultState();
      setError('Previous vault is no longer accessible');
    } finally {
      setInitialized(true);
    }
  }, [currentVault, isInitialized, loadVault, clearVaultState, setError, setInitialized]);

  /**
   * Clear current vault
   */
  const clearVault = useCallback((): void => {
    console.log('[INFO] [useVault] Clearing vault');
    clearVaultState();
    resetNavigation();
  }, [clearVaultState, resetNavigation]);

  return {
    currentVault,
    isLoading,
    error,
    isInitialized,
    selectVault,
    loadVault,
    initializeFromPersistedVault,
    clearVault,
  };
}
