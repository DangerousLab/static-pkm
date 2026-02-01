#!/bin/bash

################################################################################
# Unstablon PKM - Rollup Build System Setup Script (In-Memory Dev Server)
# Version: 3.0
# Date: 2026-02-01
#
# Features:
# - Single index.html (production-ready by default)
# - In-memory dev server (no temp files)
# - Dual-server testing (ports 3000 dev, 3001 prod)
# - Auto-rebuild on file changes
# - Interleaved server logs
#
# Usage:
#   1. Download this file
#   2. Rename to: setup-rollup-final.sh
#   3. chmod +x setup-rollup-final.sh
#   4. ./setup-rollup-final.sh
#
################################################################################

set -e  # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_command() {
    if command -v $1 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

################################################################################
# Pre-flight Checks
################################################################################

preflight_checks() {
    print_header "Pre-flight Checks"

    local all_checks_passed=true

    if [[ "$OSTYPE" != "darwin"* ]]; then
        print_error "This script is designed for macOS"
        all_checks_passed=false
    else
        print_success "Running on macOS"
    fi

    if check_command node; then
        print_success "Node.js found: $(node --version)"
    else
        print_error "Node.js not found"
        all_checks_passed=false
    fi

    if check_command npm; then
        print_success "npm found: $(npm --version)"
    else
        print_error "npm not found"
        all_checks_passed=false
    fi

    if [ -d "javascript" ] && [ -f "index.html" ]; then
        print_success "Project structure detected"
    else
        print_error "Expected project structure not found"
        all_checks_passed=false
    fi

    if [ "$all_checks_passed" = false ]; then
        print_error "Pre-flight checks failed"
        exit 1
    fi

    print_success "All checks passed!"
}

################################################################################
# Backup
################################################################################

backup_existing_files() {
    print_header "Backing Up Existing Files"

    local backup_dir="backup-$(date +%Y%m%d-%H%M%S)"

    if [ -f "package.json" ]; then
        mkdir -p "$backup_dir"
        cp package.json "$backup_dir/"
        print_success "Backed up package.json"
    fi

    if [ -f "rollup.config.js" ]; then
        mkdir -p "$backup_dir"
        cp rollup.config.js "$backup_dir/"
        print_success "Backed up rollup.config.js"
    fi

    if [ -d "$backup_dir" ]; then
        print_info "Backup saved at: $backup_dir/"
    fi
}

################################################################################
# Create Rollup Configuration
################################################################################

create_rollup_config() {
    print_header "Creating Rollup Configuration"

    cat > rollup.config.js << 'ROLLUPCONFIG'
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'javascript/app.js',
  output: {
    file: 'javascript/app.min.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    nodeResolve(),
    terser({
      compress: {
        drop_console: ['log', 'debug'],
      },
      format: {
        comments: false,
      },
    }),
  ],
};
ROLLUPCONFIG

    print_success "Created rollup.config.js"
}

################################################################################
# Create Dev Server (In-Memory)
################################################################################

create_dev_server() {
    print_header "Creating Development Server"

    mkdir -p scripts

    cat > scripts/dev-server.mjs << 'DEVSERVER'
#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(ROOT, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('404 Not Found');
    console.log(`[Dev 3000] GET ${req.url} 404 Not Found`);
    return;
  }

  let content = fs.readFileSync(filePath);

  // Inject app.js instead of app.min.js for index.html
  if (filePath.endsWith('index.html')) {
    content = content.toString().replace(
      'src="./javascript/app.min.js"',
      'src="./javascript/app.js"'
    );
  }

  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);

  console.log(`[Dev 3000] GET ${req.url} 200 OK`);
});

server.listen(PORT, () => {
  console.log(`[Dev 3000] Server ready`);
});
DEVSERVER

    chmod +x scripts/dev-server.mjs
    print_success "Created scripts/dev-server.mjs"
}

################################################################################
# Create Prod Server
################################################################################

create_prod_server() {
    print_header "Creating Production Server"

    cat > scripts/prod-server.mjs << 'PRODSERVER'
#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 3001;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(ROOT, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('404 Not Found');
    console.log(`[Prod 3001] GET ${req.url} 404 Not Found`);
    return;
  }

  const content = fs.readFileSync(filePath);

  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);

  console.log(`[Prod 3001] GET ${req.url} 200 OK`);
});

server.listen(PORT, () => {
  console.log(`[Prod 3001] Server ready`);
});
PRODSERVER

    chmod +x scripts/prod-server.mjs
    print_success "Created scripts/prod-server.mjs"
}

################################################################################
# Create File Watcher
################################################################################

create_file_watcher() {
    print_header "Creating File Watcher"

    cat > scripts/watch-and-build.mjs << 'WATCHER'
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
WATCHER

    chmod +x scripts/watch-and-build.mjs
    print_success "Created scripts/watch-and-build.mjs"
}

################################################################################
# Create Dual Server Manager
################################################################################

create_dual_server() {
    print_header "Creating Dual Server Manager"

    cat > scripts/test-dual-server.mjs << 'DUALSERVER'
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
DUALSERVER

    chmod +x scripts/test-dual-server.mjs
    print_success "Created scripts/test-dual-server.mjs"
}

################################################################################
# Update package.json
################################################################################

update_package_json() {
    print_header "Updating package.json"

    cat > package.json << 'PACKAGEJSON'
{
  "name": "unstablon-pkm",
  "version": "1.0.0",
  "description": "Unstablon - Science-focused Static Personal Knowledge Management System",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "npm run build:tree && npm run build:js",
    "build:js": "rollup -c",
    "build:tree": "node scripts/generate-tree.mjs",
    "test": "npm run build && node scripts/test-dual-server.mjs",
    "dev": "node scripts/dev-server.mjs",
    "preview": "node scripts/prod-server.mjs",
    "watch": "node scripts/watch-and-build.mjs",
    "clean": "rm -f javascript/app.min.js.map"
  },
  "devDependencies": {
    "@rollup/plugin-node-resolve": "^15.2.3",
    "@rollup/plugin-terser": "^0.4.4",
    "rollup": "^4.9.6"
  },
  "dependencies": {
    "lz-string": "^1.5.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
PACKAGEJSON

    print_success "Created package.json"
}

################################################################################
# Update .gitignore
################################################################################

update_gitignore() {
    print_header "Updating .gitignore"

    if [ ! -f ".gitignore" ]; then
        touch .gitignore
    fi

    if ! grep -q "app.min.js.map" .gitignore 2>/dev/null; then
        cat >> .gitignore << 'GITIGNORE'

# Rollup Build System
node_modules/
*.log

# OS Files
.DS_Store

# IDE
.vscode/
.idea/

# Backups
backup-*/
GITIGNORE
        print_success "Updated .gitignore"
    else
        print_info ".gitignore already configured"
    fi
}

################################################################################
# Create Documentation
################################################################################

create_documentation() {
    print_header "Creating Documentation"

    cat > ROLLUP-GUIDE.md << 'GUIDE'
# 🚀 Rollup Build System Guide

## Overview

Single-source build system with in-memory dev server and dual-mode testing.

## File Structure

```
repo/
├── index.html                # Production (references app.min.js)
├── javascript/
│   ├── app.js               # Source (for development)
│   ├── app.min.js          # Minified (for production)
│   └── app.min.js.map      # Source map [gitignored]
```

## Commands

### Build Production
npm run build

Creates:
- javascript/app.min.js (minified)
- javascript/app.min.js.map (source map)

### Dual-Mode Testing
npm run test

Starts THREE processes:
1. Dev server (port 3000) - serves app.js
2. Prod server (port 3001) - serves app.min.js
3. File watcher - auto-rebuilds on changes

URLs:
- Development: http://localhost:3000
- Production: http://localhost:3001

Press Ctrl+C to stop all servers.

### Individual Servers

# Development only
npm run dev

# Production only
npm run preview

# File watcher only
npm run watch

## How It Works

### In-Memory Dev Server

The dev server reads index.html and modifies it on-the-fly:

```html
<!-- Disk: index.html -->
<script src="./javascript/app.min.js"></script>

<!-- Served at localhost:3000 -->
<script src="./javascript/app.js"></script>
```

No temporary files created!

### Auto-Rebuild

The file watcher monitors javascript/ folder:
- Detects changes to *.js files
- Runs npm run build:js
- Production server immediately serves new bundle

## Workflow

1. Start testing: npm run test
2. Open both URLs in browser
3. Make changes to javascript/app.js
4. Watch auto-rebuild happen
5. Refresh browsers to see changes
6. Compare dev vs prod behavior
7. Ctrl+C when done

## What Gets Committed

✅ Commit these:
- index.html
- javascript/app.js (source)
- javascript/app.min.js (built for GitHub Pages)

❌ Don't commit:
- javascript/app.min.js.map (gitignored)
- node_modules/ (gitignored)

## GitHub Pages Deployment

index.html references app.min.js by default, so GitHub Pages works immediately!

Just push and it deploys correctly.
GUIDE

    print_success "Created ROLLUP-GUIDE.md"
}

################################################################################
# Install Dependencies
################################################################################

install_dependencies() {
    print_header "Installing Dependencies"

    print_info "Installing Rollup and plugins..."
    echo ""

    if npm install; then
        print_success "Dependencies installed"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

################################################################################
# Generate Initial Build
################################################################################

generate_initial_build() {
    print_header "Generating Initial Build"

    if [ -f "scripts/generate-tree.mjs" ]; then
        print_info "Generating tree.json..."
        npm run build:tree && print_success "Generated tree.json" || print_warning "Could not generate tree.json"
    fi

    print_info "Building production bundle..."
    if npm run build:js; then
        print_success "Built javascript/app.min.js"
    else
        print_error "Build failed"
        exit 1
    fi
}

################################################################################
# Update index.html Reference
################################################################################

update_index_html() {
    print_header "Updating index.html"

    if grep -q 'src="./javascript/app.js"' index.html; then
        print_info "Updating script reference to app.min.js..."
        sed -i.bak 's|src="./javascript/app.js"|src="./javascript/app.min.js"|g' index.html
        rm index.html.bak
        print_success "Updated index.html to reference app.min.js"
    elif grep -q 'src="./javascript/app.min.js"' index.html; then
        print_success "index.html already references app.min.js"
    else
        print_warning "Could not find script tag in index.html"
    fi
}

################################################################################
# Final Summary
################################################################################

print_summary() {
    print_header "Setup Complete! 🎉"

    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Rollup Build System Successfully Installed${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    print_info "Files Created:"
    echo "  ✓ rollup.config.js"
    echo "  ✓ scripts/dev-server.mjs (in-memory)"
    echo "  ✓ scripts/prod-server.mjs"
    echo "  ✓ scripts/watch-and-build.mjs"
    echo "  ✓ scripts/test-dual-server.mjs"
    echo "  ✓ package.json"
    echo "  ✓ ROLLUP-GUIDE.md"
    echo ""

    print_info "Build Output:"
    echo "  ✓ javascript/app.min.js (minified)"
    echo ""

    print_info "Repository State:"
    echo "  ✓ index.html → references app.min.js (production-ready)"
    echo "  ✓ Both app.js and app.min.js in repo"
    echo "  ✓ GitHub Pages will work correctly"
    echo ""

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  🚀 Quick Start${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "  Test both modes:"
    echo -e "     ${GREEN}npm run test${NC}"
    echo ""
    echo "  Then open in browser:"
    echo "     http://localhost:3000 (dev - app.js)"
    echo "     http://localhost:3001 (prod - app.min.js)"
    echo ""
    echo "  Build for deployment:"
    echo -e "     ${GREEN}npm run build${NC}"
    echo ""

    print_info "Features:"
    echo "  ✅ In-memory dev server (no temp files)"
    echo "  ✅ Dual-mode testing (ports 3000 & 3001)"
    echo "  ✅ Auto-rebuild on file changes"
    echo "  ✅ Production-ready by default"
    echo ""

    echo -e "${GREEN}🎉 Ready to use! Run 'npm run test' to start.${NC}"
    echo ""
}

################################################################################
# Main Execution
################################################################################

main() {
    clear

    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                              ║${NC}"
    echo -e "${BLUE}║         Unstablon PKM - Rollup Build System v3.0            ║${NC}"
    echo -e "${BLUE}║                                                              ║${NC}"
    echo -e "${BLUE}║           In-Memory Dev Server + Dual Testing                ║${NC}"
    echo -e "${BLUE}║                                                              ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    preflight_checks
    backup_existing_files
    create_rollup_config
    create_dev_server
    create_prod_server
    create_file_watcher
    create_dual_server
    update_package_json
    update_gitignore
    create_documentation
    install_dependencies
    generate_initial_build
    update_index_html
    print_summary
}

main
