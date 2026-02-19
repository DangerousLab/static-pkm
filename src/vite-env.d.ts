/// <reference types="vite/client" />

// Tauri environment variables
interface ImportMetaEnv {
  readonly TAURI_ENV_PLATFORM?: string;
  readonly TAURI_ENV_DEBUG?: string;
  readonly VITE_BUILD_MODE?: 'tauri' | 'pwa' | 'web';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
