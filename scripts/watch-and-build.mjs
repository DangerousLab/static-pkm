#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WATCH_JS = path.join(ROOT, 'javascript');
const WATCH_CSS = path.join(ROOT, 'css');

let buildingJs = false;
let buildingCss = false;

function buildJs() {
  if (buildingJs) return;

  buildingJs = true;
  console.log('[Watcher] JS changes detected, rebuilding...');

  const buildProcess = spawn('npm', ['run', 'build:js'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('[Watcher] JS build complete');
    } else {
      console.log('[Watcher] JS build failed');
    }
    buildingJs = false;
  });
}

function buildCss() {
  if (buildingCss) return;

  buildingCss = true;
  console.log('[Watcher] CSS changes detected, rebuilding...');

  const buildProcess = spawn('npm', ['run', 'build:css'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('[Watcher] CSS build complete');
    } else {
      console.log('[Watcher] CSS build failed');
    }
    buildingCss = false;
  });
}

console.log('[Watcher] Watching for changes...');
console.log('[Watcher]   - javascript/');
console.log('[Watcher]   - css/');

fs.watch(WATCH_JS, { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.js') && !filename.includes('app.min.js')) {
    buildJs();
  }
});

fs.watch(WATCH_CSS, { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.css') && !filename.includes('app.min.css') && !filename.includes('main.css')) {
    buildCss();
  }
});
