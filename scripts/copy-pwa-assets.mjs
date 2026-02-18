#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const PWA_OUT_DIR = 'dist-pwa';

console.log('[PWA] Copying static assets to', PWA_OUT_DIR);

// Assets to copy
const assets = [
  { src: 'Home', dest: join(PWA_OUT_DIR, 'Home'), type: 'dir' },
  { src: 'assets', dest: join(PWA_OUT_DIR, 'assets'), type: 'dir' },
  { src: 'vendor', dest: join(PWA_OUT_DIR, 'vendor'), type: 'dir' },
  { src: 'manifest.json', dest: join(PWA_OUT_DIR, 'manifest.json'), type: 'file' },
  { src: 'service-worker.js', dest: join(PWA_OUT_DIR, 'service-worker.js'), type: 'file' },
  { src: 'favicon.ico', dest: join(PWA_OUT_DIR, 'favicon.ico'), type: 'file' },
  { src: 'javascript/tree.json', dest: join(PWA_OUT_DIR, 'tree.json'), type: 'file' },
];

// Ensure output directory exists
if (!existsSync(PWA_OUT_DIR)) {
  mkdirSync(PWA_OUT_DIR, { recursive: true });
}

// Copy each asset
for (const asset of assets) {
  if (!existsSync(asset.src)) {
    console.warn(`[PWA] Warning: ${asset.src} does not exist, skipping`);
    continue;
  }

  try {
    if (asset.type === 'dir') {
      cpSync(asset.src, asset.dest, { recursive: true, force: true });
      console.log(`[PWA] Copied directory: ${asset.src} → ${asset.dest}`);
    } else {
      cpSync(asset.src, asset.dest, { force: true });
      console.log(`[PWA] Copied file: ${asset.src} → ${asset.dest}`);
    }
  } catch (error) {
    console.error(`[PWA] Error copying ${asset.src}:`, error.message);
  }
}

console.log('[PWA] Asset copy complete');
