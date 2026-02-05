# 🚀 Rollup Build System Guide (CSS + JS)

## Commands

### Build Production
npm run build

### Dual-Mode Testing
npm run test

Opens:
- http://localhost:3000 (dev - unminified)
- http://localhost:3001 (prod - minified)

Press Ctrl+C to stop all servers.

### Individual Commands
npm run dev            # Dev server only
npm run preview        # Prod server only  
npm run watch          # File watcher only
npm run build:css      # Build CSS only
npm run build:js       # Build JS only
npm run setup:mathjax  # Download MathJax vendor files

## What Gets Committed

✅ Commit:
- index.html
- javascript/app.js (source)
- javascript/app.min.js (built)
- css/styles.css (source)
- css/modules.css (source)
- css/app.min.css (built)
- vendor/mathjax/ (self-hosted MathJax)

❌ Don't commit:
- javascript/app.min.js.map
- css/app.min.css.map
- css/main.css
- node_modules/

## Vendor Dependencies

Third-party libraries are self-hosted in `vendor/` for performance:

- **MathJax**: LaTeX equation rendering
  - Update: `npm run setup:mathjax`
  - Location: `vendor/mathjax/`

## Performance

- CSS: 2 files → 1 minified (~60-70% smaller)
- JS: Minified + console.log removed
- MathJax: Self-hosted (~60% smaller with brotli)
- Fewer HTTP requests = faster loads
