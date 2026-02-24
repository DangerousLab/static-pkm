import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VaultState, VaultConfig } from '@/types/vault';

/**
 * Vault store with localStorage persistence
 * Manages currently selected vault and related state
 */
export const useVaultStore = create<VaultState>()(
  persist(
    (set) => ({
      // State
      currentVault: null,
      isLoading: false,
      error: null,
      isInitialized: false,

      // Actions
      setVault: (vault: VaultConfig) => {
        console.log('[INFO] [vaultStore] Vault set:', vault.name, vault.path);
        set({
          currentVault: vault,
          error: null,
        });
      },

      clearVault: () => {
        console.log('[INFO] [vaultStore] Vault cleared');
        set({
          currentVault: null,
          error: null,
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        if (error) {
          console.log('[ERROR] [vaultStore] Error:', error);
        }
        set({ error });
      },

      setInitialized: (initialized: boolean) => {
        set({ isInitialized: initialized });
      },
    }),
    {
      name: 'unstablon-vault',
      // Only persist currentVault, not loading/error/initialized state
      partialize: (state) => ({
        currentVault: state.currentVault,
      }),
    }
  )
);
