import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { execSync } from 'child_process';

/**
 * Vite plugin to generate build artifacts before build
 */
const generateBuildArtifacts = () => ({
  name: 'generate-build-artifacts',
  buildStart() {
    console.log('[Build] Generating CSS entry...');
    execSync('node scripts/generate-css-entry.mjs', { stdio: 'inherit' });
    console.log('[Build] Generating navigation tree...');
    execSync('node scripts/generate-tree.mjs', { stdio: 'inherit' });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [generateBuildArtifacts(), react()],

  // Relative paths for GitHub Pages deployment
  base: './',

  build: {
    outDir: 'dist-pwa',
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Predictable asset names for cache manifest
        entryFileNames: 'assets/app-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },

  // Environment variable to identify PWA build
  define: {
    'import.meta.env.VITE_BUILD_MODE': JSON.stringify('pwa'),
  },

  // Same path aliases as main config
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
  },
});
