# Rollup Build System Guide (CSS + JS + PWA) v4.6

## Comprehensive Offline-First PWA

This system pre-caches **EVERYTHING** on first PWA installation:
- All files in /Home directory
- All assets and vendor files
- ALL CDN resources (CSS, JS, fonts)
- Fonts loaded by CSS files (auto-detected)

**Zero runtime caching needed - full offline from first load!**

## Auto-Detection Features

### CSS Font Detection
The cache manifest generator:
1. Scans HTML for CDN links
2. Fetches and parses external CSS files
3. Extracts @import and url() references
4. Follows import chains recursively
5. Detects all fonts automatically

**No manual CDN URL updates required!**

### What Gets Pre-Cached

- Core app files (HTML, JS, CSS)
- /Home directory (all content)
- /assets directory (images, fonts, etc.)
- /vendor directory (third-party libs)
- Font Awesome CSS + fonts
- Google Fonts / CDN fonts
- MathJax + fonts
- Any CDN resource referenced anywhere

## HTTPS Local Testing

Self-signed certificates auto-generated for PWA testing on iPhone:

**Access URLs:**
- `https://YOUR_IP:3001` (from iPhone/other devices)
- `https://localhost:3001` (from Mac)

**Note:** Accept certificate warning on first visit.

## Commands

### Build Everything
```bash
npm run build
```

Generates comprehensive cache manifest + builds production files.

### Generate Cache Manifest
```bash
npm run cache:generate
```

Scans everything and detects ALL CDN resources (takes 10-30 seconds).

### Dual-Mode Testing
```bash
npm run test
```

Opens:
- http://localhost:3000 (dev - unminified)
- https://localhost:3001 (prod - minified, HTTPS, PWA)

Press Ctrl+C to stop all servers.

### Individual Commands
```bash
npm run dev            # Dev server only
npm run preview        # Prod server only (HTTPS)
npm run watch          # File watcher only
npm run build:css      # Build CSS only
npm run build:js       # Build JS only
npm run generate:css-entry  # Generate CSS entry point
npm run cache:generate # Generate comprehensive cache manifest
```

## First PWA Install

1. Visit https://YOUR_IP:3001 on iPhone
2. Add to Home Screen
3. Open from home screen
4. **Wait 30-60 seconds** - progress bar shows caching
5. Everything cached - full offline support!

## Storage Requirements

Expect 10-50 MB cache size (depending on content):
- All /Home content
- All assets
- All CDN fonts
- All third-party libraries

iOS typically allows 50-500 MB persistent storage.

## Performance

- **First load:** 30-60 seconds (caching everything)
- **Subsequent loads:** Instant (all from cache)
- **Offline:** Full functionality, zero degradation
- **Updates:** Automatic cache invalidation via version hash

## What Gets Committed

Commit:
- index.html
- javascript/app.js (source)
- javascript/app.min.js (built)
- css/styles.css (source)
- css/modules.css (source)
- css/app.min.css (built)
- scripts/*.mjs (build scripts)
- service-worker.js

Do not commit (auto-generated or local):
- javascript/app.min.js.map
- css/app.min.css.map
- css/main.css
- javascript/cache-manifest.json
- .cert/ (HTTPS certificates)
- node_modules/

## Troubleshooting

### Fonts Not Cached?
```bash
# Regenerate cache manifest (fetches CSS to find fonts)
npm run cache:generate

# Check javascript/cache-manifest.json
# Should contain font URLs like:
# "https://cdnjs.cloudflare.com/.../fa-solid-900.woff2"
# "https://fonts.gstatic.com/.../font.woff2"
```

### Service Worker Not Working?
- Ensure HTTPS (not HTTP)
- Check console for [PWA Debug] logs
- Verify running as PWA (from home screen)
- Accept certificate warning first

### Cache Too Large?
Edit `scripts/generate-cache-manifest.mjs`:
- Exclude certain file types
- Skip certain directories
- Reduce /Home content size
