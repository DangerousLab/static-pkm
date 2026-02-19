#!/usr/bin/env bash
# Download third-party vendor libraries for native app bundling
#
# Version specifications:
# - Native (bundled): FontAwesome 7.2.0, MathJax 3.2.2
# - CDN (web/PWA): FontAwesome 7.0.1, MathJax 3.2.2

set -e

# Paths relative to repository root
# Script is expected to be run from repository root
VENDOR_DIR="public/vendor"
TEMP_DIR="temp-vendor-download"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Versions for native bundling
FONTAWESOME_VERSION="7.2.0"
MATHJAX_VERSION="3.2.2"

# Trap to ensure cleanup on exit (success or failure)
cleanup() {
    if [ -d "$SCRIPT_DIR/$TEMP_DIR" ]; then
        echo "[Vendor] Cleaning up temporary files..."
        rm -rf "$SCRIPT_DIR/$TEMP_DIR"
    fi
}
trap cleanup EXIT

echo "[Vendor] Downloading third-party libraries for native app..."
echo "[Vendor] FontAwesome: $FONTAWESOME_VERSION"
echo "[Vendor] MathJax: $MATHJAX_VERSION"
echo ""

# Check if correct versions already exist
VERSION_FILE="$SCRIPT_DIR/$VENDOR_DIR/.versions"
if [ -f "$VERSION_FILE" ]; then
    INSTALLED_FA=$(grep "^FONTAWESOME=" "$VERSION_FILE" 2>/dev/null | cut -d'=' -f2)
    INSTALLED_MJ=$(grep "^MATHJAX=" "$VERSION_FILE" 2>/dev/null | cut -d'=' -f2)

    if [ "$INSTALLED_FA" = "$FONTAWESOME_VERSION" ] && [ "$INSTALLED_MJ" = "$MATHJAX_VERSION" ]; then
        echo "[Vendor] ✓ Correct versions already installed, skipping download"
        echo ""
        echo "Installed libraries:"
        echo "  - FontAwesome $FONTAWESOME_VERSION ($(du -sh $SCRIPT_DIR/$VENDOR_DIR/fontawesome 2>/dev/null | cut -f1 || echo 'N/A'))"
        echo "  - MathJax $MATHJAX_VERSION ($(du -sh $SCRIPT_DIR/$VENDOR_DIR/mathjax 2>/dev/null | cut -f1 || echo 'N/A'))"
        exit 0
    else
        echo "[Vendor] Version mismatch detected (FA: $INSTALLED_FA → $FONTAWESOME_VERSION, MJ: $INSTALLED_MJ → $MATHJAX_VERSION)"
        echo "[Vendor] Re-downloading vendor libraries..."
    fi
fi

# Create temp directory (at repo root)
mkdir -p "$SCRIPT_DIR/$TEMP_DIR"
cd "$SCRIPT_DIR/$TEMP_DIR"

# Download FontAwesome
echo "[Vendor] Downloading FontAwesome $FONTAWESOME_VERSION..."
curl -L "https://github.com/FortAwesome/Font-Awesome/releases/download/$FONTAWESOME_VERSION/fontawesome-free-$FONTAWESOME_VERSION-web.zip" -o fontawesome.zip
unzip -q fontawesome.zip
rm -rf "$SCRIPT_DIR/$VENDOR_DIR/fontawesome"
mkdir -p "$SCRIPT_DIR/$VENDOR_DIR/fontawesome"
cp -r "fontawesome-free-$FONTAWESOME_VERSION-web/css" "$SCRIPT_DIR/$VENDOR_DIR/fontawesome/"
cp -r "fontawesome-free-$FONTAWESOME_VERSION-web/webfonts" "$SCRIPT_DIR/$VENDOR_DIR/fontawesome/"
echo "[Vendor] ✓ FontAwesome $FONTAWESOME_VERSION installed to $VENDOR_DIR/fontawesome"

# Download MathJax
echo "[Vendor] Downloading MathJax $MATHJAX_VERSION..."
curl -L "https://github.com/mathjax/MathJax/archive/refs/tags/$MATHJAX_VERSION.tar.gz" -o mathjax.tar.gz
tar -xzf mathjax.tar.gz
rm -rf "$SCRIPT_DIR/$VENDOR_DIR/mathjax"
mkdir -p "$SCRIPT_DIR/$VENDOR_DIR/mathjax"
cp "MathJax-$MATHJAX_VERSION/es5/tex-mml-chtml.js" "$SCRIPT_DIR/$VENDOR_DIR/mathjax/"
cp -r "MathJax-$MATHJAX_VERSION/es5/output" "$SCRIPT_DIR/$VENDOR_DIR/mathjax/" 2>/dev/null || true
echo "[Vendor] ✓ MathJax $MATHJAX_VERSION installed to $VENDOR_DIR/mathjax"

# Write version marker file
cat > "$SCRIPT_DIR/$VENDOR_DIR/.versions" << EOF
FONTAWESOME=$FONTAWESOME_VERSION
MATHJAX=$MATHJAX_VERSION
EOF
echo "[Vendor] ✓ Version marker saved"

echo ""
echo "[Vendor] Download complete!"
echo ""
echo "Installed libraries:"
echo "  - FontAwesome $FONTAWESOME_VERSION ($(du -sh $SCRIPT_DIR/$VENDOR_DIR/fontawesome 2>/dev/null | cut -f1 || echo 'N/A'))"
echo "  - MathJax $MATHJAX_VERSION ($(du -sh $SCRIPT_DIR/$VENDOR_DIR/mathjax 2>/dev/null | cut -f1 || echo 'N/A'))"
echo ""
echo "These libraries are bundled for native app builds."
echo "Web/PWA builds use CDN versions (see src/loaders/ for details)."
