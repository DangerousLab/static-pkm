#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WATCH_DIR = path.join(ROOT, 'javascript');

let building = false;

function build() {
  if (building) return;

  building = true;
  console.log('[Watcher] Changes detected, rebuilding...');

  const buildProcess = spawn('npm', ['run', 'build:js'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('[Watcher] Build complete, watching for changes...');
    } else {
      console.log('[Watcher] Build failed');
    }
    building = false;
  });
}

console.log('[Watcher] Watching for changes in javascript/...');

fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.js') && !filename.includes('app.min.js')) {
    build();
  }
});
