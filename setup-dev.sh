#!/bin/bash

################################################################################
# Unstablon PKM - Development Setup Script
# Version: 1.0 (Minimal Build-Only)
# Date: 2026-02-18
#
# Usage:
#   ./setup-dev.sh                # Full setup
#   ./setup-dev.sh --scripts-only # Generate scripts only (for CI)
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPTS_ONLY=false
if [ "$1" = "--scripts-only" ]; then
    SCRIPTS_ONLY=true
fi

################################################################################
# Helpers
################################################################################

print_header() {
    echo ""
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() { echo -e "${GREEN}[OK] $1${NC}"; }
print_error() { echo -e "${RED}[ERROR] $1${NC}"; }
print_warning() { echo -e "${YELLOW}[WARN] $1${NC}"; }
print_info() { echo -e "${BLUE}[INFO] $1${NC}"; }

check_command() {
    command -v $1 &> /dev/null
}

detect_platform() {
    case "$OSTYPE" in
        darwin*)  PLATFORM="macOS" ;;
        linux*)   PLATFORM="Linux" ;;
        msys*|mingw*|cygwin*) PLATFORM="Windows" ;;
        *)        PLATFORM="Unknown" ;;
    esac
}

get_local_ip() {
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -z "$LOCAL_IP" ] && LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7}' | head -1)
    [ -z "$LOCAL_IP" ] && check_command ifconfig && LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
    [ -z "$LOCAL_IP" ] && LOCAL_IP="127.0.0.1"
    echo "$LOCAL_IP"
}

################################################################################
# Pre-flight
################################################################################

preflight_checks() {
    [ "$SCRIPTS_ONLY" = true ] && print_header "Pre-flight (Scripts-Only)" || print_header "Pre-flight"

    detect_platform
    print_success "Platform: $PLATFORM"

    check_command node && print_success "Node.js: $(node --version)" || { print_error "Node.js not found"; exit 1; }

    if [ "$SCRIPTS_ONLY" = false ]; then
        check_command npm && print_success "npm: $(npm --version)" || { print_error "npm not found"; exit 1; }
        check_command openssl && print_success "OpenSSL available" || print_warning "OpenSSL not found"
    fi

    [ -d "javascript" ] && [ -f "index.html" ] && print_success "Project structure OK" || { print_error "Invalid structure"; exit 1; }
    [ -d "css" ] && print_success "CSS directory OK" || { print_error "CSS directory not found"; exit 1; }
}

################################################################################
# Backup
################################################################################

backup_files() {
    [ "$SCRIPTS_ONLY" = true ] && return

    local backup_dir="backup-$(date +%Y%m%d-%H%M%S)"

    if [ -f "package.json" ] || [ -f "rollup.config.js" ]; then
        mkdir -p "$backup_dir"
        [ -f "package.json" ] && cp package.json "$backup_dir/"
        [ -f "rollup.config.js" ] && cp rollup.config.js "$backup_dir/"
        [ -f "rollup.config.css.js" ] && cp rollup.config.css.js "$backup_dir/"
        [ -f "postcss.config.cjs" ] && cp postcss.config.cjs "$backup_dir/"
        print_info "Backup: $backup_dir/"
    fi
}

################################################################################
# HTTPS Certificate
################################################################################

generate_cert() {
    [ "$SCRIPTS_ONLY" = true ] && return

    print_header "HTTPS Certificate"

    if ! check_command openssl; then
        print_warning "OpenSSL not available, skipping"
        return
    fi

    mkdir -p .cert
    LOCAL_IP=$(get_local_ip)

    # Use 'set +e' temporarily to prevent script exit on openssl failure
    set +e
    # Use MSYS_NO_PATHCONV to prevent Git Bash from converting /CN= path on Windows
    MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 \
        -keyout .cert/key.pem \
        -out .cert/cert.pem \
        -days 365 -nodes \
        -subj "/CN=$LOCAL_IP" \
        -addext "subjectAltName=IP:$LOCAL_IP,DNS:localhost" \
        2>/dev/null
    local cert_result=$?
    set -e

    if [ $cert_result -eq 0 ] && [ -f ".cert/cert.pem" ]; then
        print_success "Certificate generated (365 days, IP: $LOCAL_IP)"
    else
        print_warning "Certificate generation failed (non-critical, continuing...)"
    fi
}

################################################################################
# Config Files
################################################################################

create_cache_config() {
    [ -f "cache-scan.config.json" ] && return

    cat > cache-scan.config.json << 'EOF'
{
  "version": "1.0",
  "scanDirectories": {
    "javascript": { "extensions": [".js"], "enabled": true },
    "Home": {
      "extensions": [".html", ".md", ".js"],
      "enabled": true,
      "overrides": { ".md": { "cacheAllImages": true } }
    },
    "css": { "extensions": [".css"], "enabled": true }
  },
  "cdnDetection": {
    "domains": ["cdn.", "cdnjs.", "jsdelivr.", "unpkg.", "fonts.googleapis.com", "fonts.gstatic.com", "fonts.cdnfonts.com"]
  },
  "mathJax": {
    "autoExpand": true,
    "fonts": ["MathJax_Main-Regular.woff", "MathJax_Math-Italic.woff", "MathJax_Size2-Regular.woff", "MathJax_Size1-Regular.woff", "MathJax_AMS-Regular.woff"]
  },
  "excludePatterns": ["node_modules", ".git", ".DS_Store", "app.min.js", "app.min.css", "tree.json", "cache-manifest.json", "vendor/ses"]
}
EOF
    print_success "Created cache-scan.config.json"
}

create_postcss_config() {
    [ "$SCRIPTS_ONLY" = true ] && return
    [ -f "postcss.config.cjs" ] && return

    cat > postcss.config.cjs << 'EOF'
module.exports = {
  plugins: {
    'postcss-import': {},
    'cssnano': {
      preset: ['default', {
        discardComments: { removeAll: true },
        normalizeWhitespace: true,
        colormin: true,
        minifyFontValues: true,
        minifySelectors: true
      }]
    }
  }
};
EOF
    print_success "Created postcss.config.cjs"
}

create_rollup_config_js() {
    [ "$SCRIPTS_ONLY" = true ] && return
    [ -f "rollup.config.js" ] && return

    cat > rollup.config.js << 'EOF'
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'javascript/app.js',
  output: {
    file: 'javascript/app.min.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    nodeResolve(),
    terser({
      compress: { drop_console: ['log', 'debug'] },
      format: { comments: false }
    })
  ]
};
EOF
    print_success "Created rollup.config.js"
}

create_rollup_config_css() {
    [ "$SCRIPTS_ONLY" = true ] && return
    [ -f "rollup.config.css.js" ] && return

    cat > rollup.config.css.js << 'EOF'
import postcss from 'rollup-plugin-postcss';

export default {
  input: 'css/main.css',
  output: { file: 'css/app.min.css' },
  plugins: [
    postcss({
      extract: true,
      minimize: true,
      sourceMap: true,
      extensions: ['.css']
    })
  ]
};
EOF
    print_success "Created rollup.config.css.js"
}

################################################################################
# Script Generators
################################################################################

create_tree_generator() {
    print_header "Generate Tree Script"
    mkdir -p scripts

    cat > scripts/generate-tree.mjs << 'TREESCRIPT'
#!/usr/bin/env node
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const HOME_DIR = 'Home';
const OUTPUT_FILE = 'javascript/tree.json';

console.log('[Tree] Scanning /Home...');

// Determine node type based on file extension
function extToType(ext) {
    switch (ext.toLowerCase()) {
        case '.js': return 'module';
        case '.html': return 'page';
        case '.md': return 'document';
        default: return null;
    }
}

// Derive id from filename (without extension)
function filenameToId(filename) {
    return filename.replace(/\.[^/.]+$/, '');
}

// Fallback title from filename
function filenameToTitle(filename) {
    const base = filename.replace(/\.[^/.]+$/, '');
    const withSpaces = base.replace(/[-_]+/g, ' ');
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

// Extract first <h1>...</h1> from content
function extractH1(content) {
    const match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!match) return null;
    return match[1].replace(/\s+/g, ' ').trim() || null;
}

// Extract first markdown heading
function extractMdHeading(content) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const m = line.match(/^#{1,6}\s+(.*)$/);
        if (m && m[1].trim()) return m[1].trim();
    }
    return null;
}

// Extract title based on type
function extractTitle(type, filename, content) {
    if (type === 'module' || type === 'page') {
        const fromH1 = extractH1(content);
        if (fromH1) return fromH1;
    } else if (type === 'document') {
        const fromMd = extractMdHeading(content);
        if (fromMd) return fromMd;
    }
    return filenameToTitle(filename);
}

// Parse tags list
function parseTagsList(raw) {
    if (!raw) return [];
    return raw.split(',').map(t => t.trim()).filter(t => t.length > 0);
}

// Extract tags from JS: "// @tags: tag1, tag2"
function extractJsTags(content) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const m = line.match(/^\s*\/\/\s*@tags:\s*(.+)$/i);
        if (m && m[1]) return parseTagsList(m[1]);
    }
    return [];
}

// Extract tags from HTML: "<!-- @tags: tag1, tag2 -->"
function extractHtmlTags(content) {
    const m = content.match(/<!--\s*@tags:\s*([^>]+?)-->/i);
    if (m && m[1]) return parseTagsList(m[1]);
    return [];
}

// Extract tags from MD: "[//]: # (@tags: tag1, tag2)"
function extractMdTags(content) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const m = line.match(/^\s*\[\/\/\]:\s*#\s*\(@tags:\s*(.+)\s*\)\s*$/i);
        if (m && m[1]) return parseTagsList(m[1]);
    }
    return [];
}

// Extract tags based on type
function extractTags(type, content) {
    if (type === 'module') return extractJsTags(content);
    if (type === 'page') return extractHtmlTags(content);
    if (type === 'document') return extractMdTags(content);
    return [];
}

// Build folder node recursively
function buildFolderNode(dirPath, relativePath) {
    const name = basename(relativePath);
    const children = [];

    if (!existsSync(dirPath)) return { type: 'folder', name, path: relativePath, children };

    const entries = readdirSync(dirPath, { withFileTypes: true });

    // Sort folders and files separately
    const folders = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const files = entries.filter(e => e.isFile()).sort((a, b) => a.name.localeCompare(b.name));

    // Process folders first
    for (const entry of folders) {
        const childPath = join(dirPath, entry.name);
        const childRelPath = relativePath + '/' + entry.name;
        children.push(buildFolderNode(childPath, childRelPath));
    }

    // Process files
    for (const entry of files) {
        const ext = extname(entry.name);
        const type = extToType(ext);
        if (!type) continue;

        const filePath = join(dirPath, entry.name);
        let content = '';
        try {
            content = readFileSync(filePath, 'utf-8');
        } catch (e) {
            console.warn(`Warning: could not read ${filePath}`);
        }

        const id = filenameToId(entry.name);
        const title = extractTitle(type, entry.name, content);
        const tags = extractTags(type, content);
        const file = (relativePath + '/' + entry.name).replace(/\\/g, '/');

        children.push({ type, id, title, tags, file });
    }

    return { type: 'folder', name, path: relativePath, children };
}

// Main
const tree = buildFolderNode(HOME_DIR, 'Home');
writeFileSync(OUTPUT_FILE, JSON.stringify(tree, null, 2));
console.log(`[Tree] Generated ${OUTPUT_FILE}`);
TREESCRIPT

    chmod +x scripts/generate-tree.mjs 2>/dev/null || true
    print_success "Created scripts/generate-tree.mjs"
}

create_css_generator() {
    print_header "Generate CSS Entry Script"

    cat > scripts/generate-css-entry.mjs << 'CSSSCRIPT'
#!/usr/bin/env node
import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const CSS_DIR = 'css';
const OUTPUT_FILE = 'main.css';

console.log('[CSS] Scanning css/ directory...');

function scanDirectory(dirPath, relativePath = '') {
    const cssFiles = [];
    if (!existsSync(dirPath)) return cssFiles;

    const items = readdirSync(dirPath);
    for (const item of items) {
        const fullPath = join(dirPath, item);
        const itemRelative = relativePath ? `${relativePath}/${item}` : item;
        const stats = statSync(fullPath);

        if (stats.isDirectory()) {
            cssFiles.push(...scanDirectory(fullPath, itemRelative));
        } else if (stats.isFile() && item.endsWith('.css')) {
            if (item === OUTPUT_FILE || item.endsWith('.min.css') || item.endsWith('.css.map')) continue;
            cssFiles.push(itemRelative);
        }
    }
    return cssFiles;
}

const allCssFiles = scanDirectory(CSS_DIR);
if (allCssFiles.length === 0) {
    console.error('[CSS] No source files found');
    process.exit(1);
}

const order = {
    'core/variables.css': 1, 'core/reset.css': 2, 'core/safe-areas.css': 3,
    'layout/app-shell.css': 4, 'layout/header.css': 5, 'layout/animations.css': 6, 'layout/responsive.css': 7,
    'components/sidebar.css': 8, 'components/navigation.css': 9, 'components/search.css': 10, 'components/content.css': 11,
    'modules.css': 12, 'styles.css': 13
};

const sortedFiles = allCssFiles.sort((a, b) => {
    const aOrder = order[a] || 999;
    const bOrder = order[b] || 999;
    return aOrder !== bOrder ? aOrder - bOrder : a.localeCompare(b);
});

console.log(`[CSS] Found ${sortedFiles.length} files`);

const imports = sortedFiles.map(file => `@import './${file.replace(/\\/g, '/')}';`).join('\n');
const content = `/* Auto-generated ${new Date().toISOString()} */\n\n${imports}\n`;

writeFileSync(join(CSS_DIR, OUTPUT_FILE), content, 'utf-8');
console.log(`[CSS] Generated ${CSS_DIR}/${OUTPUT_FILE}`);
CSSSCRIPT

    chmod +x scripts/generate-css-entry.mjs 2>/dev/null || true
    print_success "Created scripts/generate-css-entry.mjs"
}

create_cache_generator() {
    print_header "Generate Cache Manifest Script"

    cat > scripts/generate-cache-manifest.mjs << 'CACHESCRIPT'
#!/usr/bin/env node
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';
import https from 'https';
import http from 'http';

const ROOT = process.cwd();
const CONFIG_FILE = 'cache-scan.config.json';

// Check for --pwa flag
const isPWAMode = process.argv.includes('--pwa');
const SCAN_DIR = isPWAMode ? 'dist-pwa' : 'javascript';
const OUTPUT_FILE = isPWAMode ? 'dist-pwa/cache-manifest.json' : 'javascript/cache-manifest.json';

function loadConfig() {
    if (!existsSync(CONFIG_FILE)) {
        console.error('[Cache] Config not found');
        process.exit(1);
    }
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
}

function getVersion() {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return new Date().toISOString();
    }
}

function scanDirectory(dirPath, extensions = null, exclude = []) {
    const files = [];
    if (!existsSync(dirPath)) return files;

    const items = readdirSync(dirPath);
    for (const item of items) {
        const fullPath = join(dirPath, item);

        // In PWA mode, make paths relative to dist-pwa/, otherwise relative to ROOT
        const baseDir = isPWAMode ? 'dist-pwa' : ROOT;
        const relativePath = './' + relative(baseDir, fullPath).replace(/\\/g, '/');

        if (exclude.some(pattern => relativePath.includes(pattern))) continue;

        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
            files.push(...scanDirectory(fullPath, extensions, exclude));
        } else if (stats.isFile()) {
            if (!extensions || extensions.some(ext => fullPath.endsWith(ext))) {
                files.push(relativePath);
            }
        }
    }
    return files;
}

function fetchURL(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);

        protocol.get(url, {timeout: 10000}, res => {
            clearTimeout(timeout);
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

function extractCSSUrls(cssContent, baseUrl = '') {
    const urls = [];
    const importRegex = /@import\s+(?:url\()?['"]([^'"]+)['"](?:\))?/g;
    let match;
    while ((match = importRegex.exec(cssContent))) {
        let url = match[1];
        if (!url.startsWith('http') && baseUrl) {
            try { url = new URL(url, baseUrl).href; } catch {}
        }
        urls.push(url);
    }
    const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/g;
    while ((match = urlRegex.exec(cssContent))) {
        let url = match[1];
        if (url.startsWith('data:')) continue;
        if (!url.startsWith('http') && baseUrl) {
            try { url = new URL(url, baseUrl).href; } catch {}
        }
        if (url.startsWith('http')) urls.push(url);
    }
    return urls;
}

function extractJSUrls(jsContent, config) {
    const urls = [];
    const stringRegex = /['"\`](https:\/\/[^'"\`\s]+)['"\`]/g;
    let match;
    while ((match = stringRegex.exec(jsContent))) {
        const url = match[1];
        if (config.cdnDetection.domains.some(d => url.includes(d))) urls.push(url);
    }
    return urls;
}

function extractHTMLUrls(htmlContent) {
    const urls = [];
    const linkRegex = /<link[^>]*href=["'](https?:\/\/[^"']+)["']/g;
    const scriptRegex = /<script[^>]*src=["'](https?:\/\/[^"']+)["']/g;
    let match;
    while ((match = linkRegex.exec(htmlContent))) urls.push(match[1]);
    while ((match = scriptRegex.exec(htmlContent))) urls.push(match[1]);
    return urls;
}

function extractMDImages(mdContent) {
    const images = [];
    const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const htmlImgRegex = /<img[^>]*src=["']([^"']+)["']/g;
    let match;
    while ((match = mdImgRegex.exec(mdContent))) images.push(match[2]);
    while ((match = htmlImgRegex.exec(mdContent))) images.push(match[1]);
    return images;
}

async function scanExternalCSS(cssUrl, visited = new Set()) {
    if (visited.has(cssUrl)) return [];
    visited.add(cssUrl);

    const urls = [];
    try {
        console.log(`[Cache] Fetching: ${cssUrl}`);
        const content = await fetchURL(cssUrl);
        const extracted = extractCSSUrls(content, cssUrl);
        urls.push(...extracted);

        for (const url of extracted) {
            if (url.endsWith('.css')) {
                urls.push(...await scanExternalCSS(url, visited));
            }
        }
    } catch (e) {
        console.warn(`[Cache] Failed: ${cssUrl}`);
    }

    return urls;
}

function expandMathJaxResources(urls, config) {
    if (!config.mathJax.autoExpand) return urls;

    const expanded = [...urls];
    const mathJaxBases = urls.filter(u => u.includes('mathjax') && u.includes('tex-mml-chtml.js'));
    const fontBases = urls.filter(u => u.includes('mathjax') && u.includes('fonts/woff-v2'));

    for (const fontBase of fontBases) {
        const baseUrl = fontBase.endsWith('/') ? fontBase : fontBase + '/';
        for (const font of config.mathJax.fonts) expanded.push(baseUrl + font);
    }

    if (fontBases.length === 0 && mathJaxBases.length > 0) {
        for (const base of mathJaxBases) {
            const urlParts = base.split('/');
            urlParts.pop();
            const fontBase = urlParts.join('/') + '/output/chtml/fonts/woff-v2/';
            for (const font of config.mathJax.fonts) expanded.push(fontBase + font);
        }
    }

    return expanded;
}

async function generateCacheManifest() {
    console.log(`[Cache] Generating manifest (mode: ${isPWAMode ? 'PWA' : 'legacy'})...`);

    const config = loadConfig();
    const manifest = {
        version: getVersion(),
        generated: new Date().toISOString(),
        preCache: { local: [], cdn: [] }
    };

    // Core files differ between PWA and legacy builds
    const coreFiles = isPWAMode
        ? ['./', './index.html', './manifest.json', './favicon.ico', './tree.json']
        : ['./', './index.html', './manifest.json', './favicon.ico', './javascript/app.min.js', './javascript/tree.json', './css/app.min.css'];

    manifest.preCache.local.push(...coreFiles);

    // For PWA mode, scan dist-pwa/assets/ for Vite-generated JS/CSS bundles
    if (isPWAMode && existsSync('dist-pwa/assets')) {
        const assetFiles = scanDirectory('dist-pwa/assets', ['.js', '.css'], config.excludePatterns);
        manifest.preCache.local.push(...assetFiles);
    }

    const allCDNUrls = [];

    // CRITICAL: Scan root index.html for CDN URLs in PWA mode
    // The root HTML file contains CDN links (fonts, scripts) but isn't in any scanned subdirectory
    if (isPWAMode && existsSync('dist-pwa/index.html')) {
        const indexContent = readFileSync('dist-pwa/index.html', 'utf-8');
        const indexUrls = extractHTMLUrls(indexContent);
        allCDNUrls.push(...indexUrls);
        console.log(`[Cache] Found ${indexUrls.length} CDN URLs in root index.html`);
    }

    for (const [dirName, dirConfig] of Object.entries(config.scanDirectories)) {
        if (!dirConfig.enabled) continue;

        // In PWA mode, scan from dist-pwa directory
        const scanPath = isPWAMode ? join('dist-pwa', dirName) : dirName;

        if (dirName === 'Home' || dirName === 'assets' || dirName === 'vendor') {
            const files = scanDirectory(scanPath, null, config.excludePatterns);
            manifest.preCache.local.push(...files);
        }

        const files = scanDirectory(scanPath, dirConfig.extensions, config.excludePatterns);

        for (const file of files) {
            if (!existsSync(file)) continue;

            try {
                const content = readFileSync(file, 'utf-8');
                const ext = file.substring(file.lastIndexOf('.'));
                const override = dirConfig.overrides?.[ext];

                if (ext === '.html') {
                    allCDNUrls.push(...extractHTMLUrls(content));
                } else if (ext === '.css') {
                    allCDNUrls.push(...extractCSSUrls(content));
                } else if (ext === '.js') {
                    allCDNUrls.push(...extractJSUrls(content, config));
                } else if (ext === '.md') {
                    const images = extractMDImages(content);
                    if (override?.cacheAllImages) {
                        for (const img of images) {
                            if (img.startsWith('http')) {
                                allCDNUrls.push(img);
                            } else {
                                const imgPath = img.startsWith('./') ? img : './' + img;
                                if (existsSync(imgPath)) manifest.preCache.local.push(imgPath);
                            }
                        }
                    } else {
                        allCDNUrls.push(...images.filter(img => img.startsWith('http')));
                    }
                }
            } catch (e) {}
        }
    }

    const externalCSS = allCDNUrls.filter(url => url.endsWith('.css') && url.startsWith('http'));
    for (const cssUrl of externalCSS) {
        const fonts = await scanExternalCSS(cssUrl);
        allCDNUrls.push(...fonts);
    }

    const expandedUrls = expandMathJaxResources(allCDNUrls, config);

    manifest.preCache.local = [...new Set(manifest.preCache.local)];
    manifest.preCache.cdn = [...new Set(expandedUrls)];

    writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));

    console.log(`[Cache] Generated (v${manifest.version}) → ${OUTPUT_FILE}`);
    console.log(`[Cache] Local: ${manifest.preCache.local.length}, CDN: ${manifest.preCache.cdn.length}`);
}

generateCacheManifest().catch(e => {
    console.error('[Cache] Failed:', e);
    process.exit(1);
});
CACHESCRIPT

    chmod +x scripts/generate-cache-manifest.mjs 2>/dev/null || true
    print_success "Created scripts/generate-cache-manifest.mjs"
}

################################################################################
# Install & Build
################################################################################

install_deps() {
    [ "$SCRIPTS_ONLY" = true ] && return

    print_header "Installing Dependencies"
    npm install || { print_error "npm install failed"; exit 1; }
    print_success "Dependencies installed"
}

initial_build() {
    [ "$SCRIPTS_ONLY" = true ] && return

    print_header "Initial Build"

    npm run build:tree 2>/dev/null || print_warning "Tree generation skipped"
    npm run generate:css-entry || { print_error "CSS entry failed"; exit 1; }
    npm run build:css:legacy || { print_error "CSS build failed"; exit 1; }
    npm run build:js:legacy || { print_error "JS build failed"; exit 1; }
    npm run cache:generate || print_warning "Cache manifest failed"

    print_success "Build complete"
}

################################################################################
# Summary
################################################################################

print_summary() {
    print_header "Setup Complete"

    if [ "$SCRIPTS_ONLY" = true ]; then
        echo "Scripts generated:"
        echo "  - scripts/generate-css-entry.mjs"
        echo "  - scripts/generate-tree.mjs"
        echo "  - scripts/generate-cache-manifest.mjs"
        echo "  - cache-scan.config.json"
    else
        echo "Files created:"
        echo "  - rollup.config.js / rollup.config.css.js"
        echo "  - postcss.config.cjs"
        echo "  - cache-scan.config.json"
        echo "  - scripts/*.mjs (3 generators)"
        [ -f ".cert/cert.pem" ] && echo "  - .cert/*.pem (HTTPS certs)"
        echo ""
        echo "Build output:"
        echo "  - css/main.css / css/app.min.css"
        echo "  - javascript/app.min.js"
        echo "  - javascript/cache-manifest.json"
        echo "  - javascript/tree.json"
        echo ""
        echo "Next: npm run build:web (for GitHub Pages)"
        echo "      npm run tauri:dev (for desktop)"
    fi
}

################################################################################
# Main
################################################################################

main() {
    clear
    echo "Unstablon PKM - Development Setup v5.0"
    [ "$SCRIPTS_ONLY" = true ] && echo "Mode: Scripts-Only (CI)" || echo "Mode: Full Setup"
    echo ""

    preflight_checks
    backup_files
    generate_cert
    create_cache_config
    create_postcss_config
    create_rollup_config_js
    create_rollup_config_css
    create_tree_generator
    create_css_generator
    create_cache_generator
    install_deps
    initial_build
    print_summary
}

main
