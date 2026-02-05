# Vendor Directory

This directory contains **third-party external libraries** that are self-hosted for performance and privacy.

## Contents

### MathJax 3.x
- **Purpose**: LaTeX equation rendering for scientific modules
- **Location**: `vendor/mathjax/`
- **Files**: 
  - `tex-mml-chtml.js` (~350 KB, compressed to ~180 KB with brotli)
  - `fonts/*.woff2` (4 font files, ~97 KB total)
- **Used by**: `nitricCalculator.js` and other math-enabled modules

### Font Awesome (Future)
- **Purpose**: UI icons (magnifying glass, close button, etc.)
- **Location**: `vendor/fontawesome/` (not yet implemented)
- **Files**: Subset CSS + WOFF2 fonts

## Important Guidelines

⚠️ **DO NOT manually modify files in this directory.**

These files are **externally-sourced dependencies** managed by automated scripts.

## Installation

Download vendor libraries:

```bash
# Download MathJax
npm run setup:mathjax

# Download Font Awesome (future)
npm run setup:fontawesome
```

## Updates

To update vendor libraries to latest versions:

```bash
# Update MathJax
npm run setup:mathjax

# This re-downloads from CDN at the version specified in scripts/download-mathjax.mjs
```

## User Customization

If you want to customize **branding assets** (logos, banners, images), edit files in the `assets/` directory instead.

**Directory purposes:**
- `assets/` → User-customizable branding
- `vendor/` → Third-party libraries (managed by scripts)
- `javascript/` → Your application code
- `Home/` → Your custom modules

## Why Self-Host?

1. **Performance**: GitHub Pages brotli compression (~60% size reduction)
2. **Privacy**: No tracking from external CDNs
3. **Reliability**: Works without external dependencies
4. **Speed**: No DNS lookup or external HTTPS handshake
5. **Offline**: Works in PWA/offline mode (future)

## File Sizes

| Library | Uncompressed | Compressed (br) | HTTP Requests |
|---------|--------------|-----------------|---------------|
| MathJax JS | 350 KB | ~180 KB | 1 |
| MathJax Fonts | 97 KB | ~50-60 KB | 3-6 (lazy) |
| **Total** | **447 KB** | **~240 KB** | **4-7** |

Fonts load on-demand based on glyphs used in equations.
