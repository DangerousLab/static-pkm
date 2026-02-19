# FontAwesome Icons

**Version:** 7.2.0 (Free)
**Last Updated:** 2026-02-18

## Why Bundled

For **native app** deployment, FontAwesome is bundled locally to avoid network dependencies.

- **Web/PWA:** Uses CDN (v7.0.1 from cdnjs.com)
- **Native:** Uses bundled files (v7.2.0 from this directory)

## Contents

- `css/all.min.css` - Complete FontAwesome stylesheet (74KB)
- `webfonts/` - Icon font files

## Usage

Loaded automatically via `useFontAwesome()` hook in `src/loaders/useFontAwesome.ts`.

The loader detects the environment and uses:
- CDN for web/PWA (faster, cached by service worker)
- Local bundle for native app (no network required)

## Updating

To update FontAwesome for native builds:

```bash
# Download new version
curl -L "https://github.com/FortAwesome/Font-Awesome/releases/download/X.X.X/fontawesome-free-X.X.X-web.zip" -o fontawesome.zip

# Extract
unzip fontawesome.zip

# Copy to vendor
cp -r fontawesome-free-X.X.X-web/css public/vendor/fontawesome/
cp -r fontawesome-free-X.X.X-web/webfonts public/vendor/fontawesome/

# Update version in this README
```

Or use the automated script:
```bash
bash scripts/download-vendor.sh
```

## Source

- **GitHub:** https://github.com/FortAwesome/Font-Awesome
- **Website:** https://fontawesome.com
- **License:** Free version (SIL OFL 1.1 for fonts, MIT for code)
