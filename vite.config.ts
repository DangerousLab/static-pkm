import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { execSync } from 'child_process';

// Vite plugin to auto-generate build artifacts (CSS entry, navigation tree)
const generateBuildArtifacts = () => ({
  name: 'generate-build-artifacts',
  buildStart() {
    console.log('[Vite] Generating build artifacts...');
    try {
      // Generate CSS entry point
      execSync('node scripts/generate-css-entry.mjs', { stdio: 'inherit' });

      // Generate navigation tree JSON
      execSync('node scripts/generate-tree.mjs', { stdio: 'inherit' });
    } catch (error) {
      console.error('[Vite] Failed to generate build artifacts:', error);
      throw error;
    }
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [generateBuildArtifacts(), tailwindcss(), react()],

  // Vite options for Tauri
  // - Prevents vite from obscuring rust errors
  clearScreen: false,
  // - tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // tell vite to ignore watching `src-tauri` and user content directory
      ignored: ['**/src-tauri/**', '**/public/Home/**'],
    },
  },

  // Path aliases matching tsconfig.json
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@modules': resolve(__dirname, './src/modules'),
      '@components': resolve(__dirname, './src/components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@contexts': resolve(__dirname, './src/contexts'),
      '@types': resolve(__dirname, './src/types'),
    },
    // Force single instances of CM6 core packages across all Rollup chunks.
    // Without this, Vite/Rollup can create separate copies in split chunks,
    // each with their own Facet registry and StyleModule counter — causing
    // highlight class IDs and facet priorities to mismatch between dev and build.
    dedupe: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/language',
      '@lezer/highlight',
      '@lezer/common',
      'style-mod',
    ],
  },

  // Build output configuration
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari14',
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },

  // Compile-time environment variables
  define: {
    'import.meta.env.VITE_BUILD_MODE': JSON.stringify(
      process.env.TAURI_ENV_PLATFORM ? 'tauri' : 'web'
    ),
  },

  // env prefix for Tauri
  envPrefix: ['VITE_', 'TAURI_ENV_'],
});
