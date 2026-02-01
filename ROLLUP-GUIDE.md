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
