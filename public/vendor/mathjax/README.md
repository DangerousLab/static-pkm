# MathJax

**Version:** 3.2.2
**Last Updated:** 2026-02-18

## Why Bundled

For **native app** deployment, MathJax is bundled locally to avoid network dependencies.

- **Web/PWA:** Uses CDN (v3.2.2 from jsdelivr.net)
- **Native:** Uses bundled files (v3.2.2 from this directory)

**Note:** MathJax 3 is used instead of v4 due to rendering flicker issues in v4 when re-typesetting dynamic content.

## Contents

- `tex-mml-chtml.js` - Combined TeX/MathML input, HTML output (971KB)
- `output/` - Output renderers and fonts

## Usage

Loaded automatically via `useMathJax()` hook in `src/loaders/useMathJax.ts`.

The loader detects the environment and uses:
- CDN for web/PWA (faster, cached by service worker)
- Local bundle for native app (no network required)

Configured for:
- Inline math: `$...$` or `\(...\)`
- Display math: `$$...$$` or `\[...\]`

## Updating

To update MathJax for native builds:

```bash
# Download new version
curl -L "https://github.com/mathjax/MathJax/archive/refs/tags/X.X.X.tar.gz" -o mathjax.tar.gz

# Extract
tar -xzf mathjax.tar.gz

# Copy to vendor
cp MathJax-X.X.X/tex-mml-chtml.js public/vendor/mathjax/
cp -r MathJax-X.X.X/output public/vendor/mathjax/

# Update version in this README
```

Or use the automated script:
```bash
bash scripts/download-vendor.sh
```

## Source

- **GitHub:** https://github.com/mathjax/MathJax
- **Website:** https://www.mathjax.org
- **License:** Apache License 2.0
