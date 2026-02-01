#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║          Dual-Mode Test Servers Running                ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

console.log('📝 Development Server');
console.log('   http://localhost:3000');
console.log('   Uses: javascript/app.js (unminified)\n');

console.log('🚀 Production Server');
console.log('   http://localhost:3001');
console.log('   Uses: javascript/app.min.js (minified)\n');

console.log('🔄 File Watcher');
console.log('   Auto-rebuilds on changes in javascript/\n');

console.log('💡 Open both URLs in your browser to test');
console.log('⚠️  Press Ctrl+C to stop all servers\n');

// Start dev server
const devServer = spawn('node', ['scripts/dev-server.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
});

// Start prod server
const prodServer = spawn('node', ['scripts/prod-server.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
});

// Start file watcher
const watcher = spawn('node', ['scripts/watch-and-build.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
});

// Handle cleanup
function cleanup() {
  console.log('\n👋 Stopping all servers...');
  devServer.kill();
  prodServer.kill();
  watcher.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

devServer.on('exit', cleanup);
prodServer.on('exit', cleanup);
watcher.on('exit', cleanup);
