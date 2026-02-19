#!/usr/bin/env bash
# Download third-party vendor libraries for native app bundling
#
# Version specifications:
# - Native (bundled): FontAwesome 7.2.0, MathJax 3.2.2
# - CDN (web/PWA): FontAwesome 7.0.1, MathJax 3.2.2

set -e

VENDOR_DIR="public/vendor"
TEMP_DIR="temp-vendor-download"

# Versions for native bundling
FONTAWESOME_VERSION="7.2.0"
MATHJAX_VERSION="3.2.2"

echo "[Vendor] Downloading third-party libraries for native app..."
echo "[Vendor] FontAwesome: $FONTAWESOME_VERSION"
echo "[Vendor] MathJax: $MATHJAX_VERSION"
echo ""

# Create temp directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Download FontAwesome
echo "[Vendor] Downloading FontAwesome $FONTAWESOME_VERSION..."
curl -L "https://github.com/FortAwesome/Font-Awesome/releases/download/$FONTAWESOME_VERSION/fontawesome-free-$FONTAWESOME_VERSION-web.zip" -o fontawesome.zip
unzip -q fontawesome.zip
rm -rf "../$VENDOR_DIR/fontawesome"
mkdir -p "../$VENDOR_DIR/fontawesome"
cp -r "fontawesome-free-$FONTAWESOME_VERSION-web/css" "../$VENDOR_DIR/fontawesome/"
cp -r "fontawesome-free-$FONTAWESOME_VERSION-web/webfonts" "../$VENDOR_DIR/fontawesome/"
echo "[Vendor] ✓ FontAwesome $FONTAWESOME_VERSION installed to $VENDOR_DIR/fontawesome"

# Download MathJax
echo "[Vendor] Downloading MathJax $MATHJAX_VERSION..."
curl -L "https://github.com/mathjax/MathJax/archive/refs/tags/$MATHJAX_VERSION.tar.gz" -o mathjax.tar.gz
tar -xzf mathjax.tar.gz
rm -rf "../$VENDOR_DIR/mathjax"
mkdir -p "../$VENDOR_DIR/mathjax"
cp "MathJax-$MATHJAX_VERSION/tex-mml-chtml.js" "../$VENDOR_DIR/mathjax/"
cp -r "MathJax-$MATHJAX_VERSION/output" "../$VENDOR_DIR/mathjax/" 2>/dev/null || true
echo "[Vendor] ✓ MathJax $MATHJAX_VERSION installed to $VENDOR_DIR/mathjax"

# Cleanup
cd ..
rm -rf "$TEMP_DIR"

echo ""
echo "[Vendor] Download complete!"
echo ""
echo "Installed libraries:"
echo "  - FontAwesome $FONTAWESOME_VERSION ($(du -sh $VENDOR_DIR/fontawesome 2>/dev/null | cut -f1 || echo 'N/A'))"
echo "  - MathJax $MATHJAX_VERSION ($(du -sh $VENDOR_DIR/mathjax 2>/dev/null | cut -f1 || echo 'N/A'))"
echo ""
echo "These libraries are bundled for native app builds."
echo "Web/PWA builds use CDN versions (see src/loaders/ for details)."
