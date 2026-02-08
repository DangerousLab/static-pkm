#!/bin/bash

################################################################################
# Unstablon PKM - Rollup Build System Setup Script (CSS + JS Bundling + PWA)
# Version: 4.8
# Date: 2026-02-06
#
# Features:
# - Dynamic CSS entry point generation (no hardcoding)
# - CSS minification and bundling (auto-discovered files → app.min.css)
# - JavaScript bundling (app.js → app.min.js)
# - PWA Service Worker with full offline-first caching
# - User-configurable CDN scanning via cache-scan.config.json
# - Scans /Home, /javascript, /css for CDN resources
# - Auto-detects fonts, images, JS libraries from .html, .md, .js files
# - Markdown: cache ALL images (local + CDN) - configurable override
# - MathJax auto-detection and font expansion
# - HTTPS support with self-signed certificates
# - In-memory dev server (no temp files)
# - Dual-server testing (ports 3000 dev, 3001 prod HTTPS)
#
# Changes in v4.8:
# - User-editable cache-scan.config.json (zero hardcoding!)
# - Scans /Home for .html, .md, .js files
# - Markdown images: cache ALL (local + CDN) via override
# - JavaScript CDN detection from all .js files
# - Config-based directory scanning
# - Customizable CDN domains and resource types
# - Fails if config file not found (prevents misconfiguration)
# - Config file committed to git (default)
#
# Usage:
#   chmod +x setup-rollup.sh
#   ./setup-rollup.sh
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

    if check_command openssl; then
        print_success "OpenSSL found: $(openssl version)"
    else
        print_warning "OpenSSL not found (HTTPS cert generation will be skipped)"
    fi

    if [ -d "javascript" ] && [ -f "index.html" ]; then
        print_success "Project structure detected"
    else
        print_error "Expected project structure not found"
        all_checks_passed=false
    fi

    if [ -d "css" ] && [ -f "css/styles.css" ]; then
        print_success "CSS directory detected"
    else
        print_error "CSS directory not found"
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
# Generate Self-Signed HTTPS Certificate
################################################################################

generate_https_certificate() {
    print_header "Generating Self-Signed HTTPS Certificate"

    if ! check_command openssl; then
        print_warning "OpenSSL not available, skipping certificate generation"
        print_info "HTTPS will not be available for local testing"
        return
    fi

    mkdir -p .cert

    # Get local IP address
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)

    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP="localhost"
        print_warning "Could not detect local IP, using localhost"
    else
        print_info "Detected local IP: $LOCAL_IP"
    fi

    # Generate certificate
    print_info "Generating self-signed certificate..."

    openssl req -x509 -newkey rsa:2048 \
        -keyout .cert/key.pem \
        -out .cert/cert.pem \
        -days 365 \
        -nodes \
        -subj "/CN=$LOCAL_IP" \
        -addext "subjectAltName=IP:$LOCAL_IP,DNS:localhost" \
        2>/dev/null

    if [ -f ".cert/cert.pem" ] && [ -f ".cert/key.pem" ]; then
        print_success "HTTPS certificate generated"
        print_info "Certificate valid for: $LOCAL_IP and localhost"
        print_info "Valid for: 365 days"
        print_warning "You'll need to accept certificate warning on first visit"
        echo ""
        print_info "Access URLs:"
        echo "  - https://$LOCAL_IP:3001"
        echo "  - https://localhost:3001"
    else
        print_error "Certificate generation failed"
    fi
}

################################################################################
# Create User-Editable Cache Scan Configuration
################################################################################

create_cache_scan_config() {
    print_header "Creating Cache Scan Configuration (USER-EDITABLE)"
    
    cat > cache-scan.config.json << 'CONFIGEOF'
{
  "version": "1.0",
  "description": "User-editable CDN scanning configuration",
  
  "scanDirectories": {
    "javascript": {
      "extensions": [".js"],
      "enabled": true
    },
    "Home": {
      "extensions": [".html", ".md", ".js"],
      "enabled": true,
      "overrides": {
        ".md": {
          "cacheAllImages": true
        }
      }
    },
    "css": {
      "extensions": [".css"],
      "enabled": true
    }
  },
  
  "cdnDetection": {
    "domains": [
      "cdn.",
      "cdnjs.",
      "jsdelivr.",
      "unpkg.",
      "fonts.googleapis.com",
      "fonts.gstatic.com"
    ]
  },
  
  "mathJax": {
    "autoExpand": true,
    "fonts": [
      "MathJax_Main-Regular.woff",
      "MathJax_Math-Italic.woff",
      "MathJax_Size2-Regular.woff",
      "MathJax_Size1-Regular.woff",
      "MathJax_AMS-Regular.woff"
    ]
  },
  
  "excludePatterns": [
    "node_modules",
    ".git",
    ".DS_Store",
    "app.min.js",
    "app.min.css",
    "tree.json",
    "cache-manifest.json"
  ]
}
CONFIGEOF

    print_success "Created cache-scan.config.json"
}

################################################################################
# Create Dynamic CSS Entry Generator Script
################################################################################

create_css_entry_generator() {
    print_header "Creating Dynamic CSS Entry Generator"

    mkdir -p scripts

    cat > scripts/generate-css-entry.mjs << 'CSSGENERATOR'
#!/usr/bin/env node

/**
 * Dynamic CSS Entry Point Generator
 * Auto-discovers CSS source files and creates main.css import file
 * 
 * Features:
 * - No hardcoding - scans css/ directory
 * - Excludes build outputs (*.min.css, *.map)
 * - Excludes itself (main.css)
 * - Consistent alphabetical order
 */

import { readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const CSS_DIR = 'css';
const OUTPUT_FILE = 'main.css';

console.log('[CSS Entry] Auto-discovering CSS source files...');

// Automatically discover all CSS source files
const cssFiles = readdirSync(CSS_DIR)
  .filter(file => {
    // Include only .css files
    if (!file.endsWith('.css')) return false;

    // Exclude the output file itself
    if (file === OUTPUT_FILE) return false;

    // Exclude minified files
    if (file.endsWith('.min.css')) return false;

    // Exclude source maps
    if (file.endsWith('.css.map')) return false;

    return true;
  })
  .sort(); // Consistent alphabetical order

if (cssFiles.length === 0) {
  console.error('[CSS Entry] ❌ No CSS source files found in css/ directory');
  process.exit(1);
}

console.log(`[CSS Entry] ✅ Discovered ${cssFiles.length} CSS file(s):`);
cssFiles.forEach(file => console.log(`[CSS Entry]    - ${file}`));

// Generate import statements
const imports = cssFiles.map(file => `@import './${file}';`).join('\n');

const content = `/**
 * Auto-generated CSS Entry Point - DO NOT EDIT
 * Generated: ${new Date().toISOString()}
 * 
 * This file is dynamically created by scripts/generate-css-entry.mjs
 * It imports all CSS source files for bundling into app.min.css
 * 
 * Discovered ${cssFiles.length} CSS source file(s)
 */

${imports}
`;

// Write the file
const outputPath = join(CSS_DIR, OUTPUT_FILE);
writeFileSync(outputPath, content, 'utf-8');

console.log(`[CSS Entry] ✅ Generated ${CSS_DIR}/${OUTPUT_FILE}`);
console.log('[CSS Entry] Ready for Rollup bundling');
CSSGENERATOR

    chmod +x scripts/generate-css-entry.mjs
    print_success "Created scripts/generate-css-entry.mjs (dynamic CSS discovery)"
}

################################################################################
# Create Comprehensive Cache Manifest Generator
################################################################################

create_cache_manifest_generator() {
    print_header "Creating Cache Manifest Generator v3 (Config-Based)"
    
    cat > scripts/generate-cache-manifest.mjs << 'CACHEMANIFEST'
#!/usr/bin/env node
/**
 * Cache Manifest Generator v3 - Config-Based Scanning
 */
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';
import https from 'https';
import http from 'http';

const ROOT = process.cwd();
const CONFIG_FILE = 'cache-scan.config.json';

// Load configuration (exits if not found)
function loadConfig() {
    if (!existsSync(CONFIG_FILE)) {
        console.error(`[Cache] ❌ Configuration file not found: ${CONFIG_FILE}`);
        console.error('[Cache] Please run setup-rollup.sh to create it');
        process.exit(1);
    }
    
    try {
        const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
        console.log('[Cache] ✓ Loaded configuration');
        return config;
    } catch (e) {
        console.error('[Cache] ❌ Invalid configuration:', e.message);
        process.exit(1);
    }
}

// Get version from git or timestamp
function getVersion() {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return new Date().toISOString();
    }
}

// Recursively scan directory
function scanDirectory(dirPath, extensions = null, exclude = []) {
    const files = [];
    if (!existsSync(dirPath)) return files;
    
    const items = readdirSync(dirPath);
    for (const item of items) {
        const fullPath = join(dirPath, item);
        const relativePath = './' + relative(ROOT, fullPath).replace(/\\/g, '/');
        
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

// Fetch URL content
function fetchURL(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
        
        protocol.get(url, {timeout: 10000}, res => {
            clearTimeout(timeout);
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

// Extract URLs from CSS content
function extractCSSUrls(cssContent, baseUrl = '') {
    const urls = [];
    
    // @import statements
    const importRegex = /@import\s+(?:url\()?['"]([^'"]+)['"](?:\))?/g;
    let match;
    while ((match = importRegex.exec(cssContent))) {
        let url = match[1];
        if (!url.startsWith('http') && baseUrl) {
            try {
                url = new URL(url, baseUrl).href;
            } catch {}
        }
        urls.push(url);
    }
    
    // url() references
    const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/g;
    while ((match = urlRegex.exec(cssContent))) {
        let url = match[1];
        if (url.startsWith('data:')) continue;
        if (!url.startsWith('http') && baseUrl) {
            try {
                url = new URL(url, baseUrl).href;
            } catch {}
        }
        if (url.startsWith('http')) urls.push(url);
    }
    
    return urls;
}

// Extract CDN URLs from JavaScript
function extractJSUrls(jsContent, config) {
    const urls = [];
    const stringRegex = /['"\`](https:\/\/[^'"\`\s]+)['"\`]/g;
    let match;
    
    while ((match = stringRegex.exec(jsContent))) {
        const url = match[1];
        if (config.cdnDetection.domains.some(d => url.includes(d))) {
            urls.push(url);
        }
    }
    
    return urls;
}

// Extract URLs from HTML
function extractHTMLUrls(htmlContent) {
    const urls = [];
    const linkRegex = /<link[^>]*href=["'](https?:\/\/[^"']+)["']/g;
    const scriptRegex = /<script[^>]*src=["'](https?:\/\/[^"']+)["']/g;
    let match;
    
    while ((match = linkRegex.exec(htmlContent))) urls.push(match[1]);
    while ((match = scriptRegex.exec(htmlContent))) urls.push(match[1]);
    
    return urls;
}

// Extract images from Markdown
function extractMDImages(mdContent) {
    const images = [];
    const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const htmlImgRegex = /<img[^>]*src=["']([^"']+)["']/g;
    let match;
    
    while ((match = mdImgRegex.exec(mdContent))) images.push(match[2]);
    while ((match = htmlImgRegex.exec(mdContent))) images.push(match[1]);
    
    return images;
}

// Scan external CSS for fonts
async function scanExternalCSS(cssUrl, visited = new Set()) {
    if (visited.has(cssUrl)) return [];
    visited.add(cssUrl);
    
    const urls = [];
    try {
        console.log(`[Cache]     Fetching: ${cssUrl}`);
        const content = await fetchURL(cssUrl);
        const extracted = extractCSSUrls(content, cssUrl);
        urls.push(...extracted);
        
        for (const url of extracted) {
            if (url.endsWith('.css')) {
                urls.push(...await scanExternalCSS(url, visited));
            }
        }
    } catch (e) {
        console.warn(`[Cache]     ⚠ Failed: ${cssUrl} - ${e.message}`);
    }
    
    return urls;
}

// Expand MathJax font resources
function expandMathJaxResources(urls, config) {
    if (!config.mathJax.autoExpand) return urls;
    
    const expanded = [...urls];
    const mathJaxBases = urls.filter(u => u.includes('mathjax') && u.includes('tex-mml-chtml.js'));
    const fontBases = urls.filter(u => u.includes('mathjax') && u.includes('fonts/woff-v2'));
    
    for (const fontBase of fontBases) {
        const baseUrl = fontBase.endsWith('/') ? fontBase : fontBase + '/';
        for (const font of config.mathJax.fonts) {
            expanded.push(baseUrl + font);
        }
    }
    
    if (fontBases.length === 0 && mathJaxBases.length > 0) {
        for (const base of mathJaxBases) {
            const urlParts = base.split('/');
            urlParts.pop();
            const fontBase = urlParts.join('/') + '/output/chtml/fonts/woff-v2/';
            for (const font of config.mathJax.fonts) {
                expanded.push(fontBase + font);
            }
        }
    }
    
    return expanded;
}

// Main generator function
async function generateCacheManifest() {
    console.log('[Cache] ═══════════════════════════════════════════════════════');
    console.log('[Cache] Cache Manifest Generator v3 (Config-based)');
    console.log('[Cache] ═══════════════════════════════════════════════════════');
    
    const config = loadConfig();
    const manifest = {
        version: getVersion(),
        generated: new Date().toISOString(),
        preCache: { local: [], cdn: [] }
    };
    
    // Core files
    console.log('[Cache] Step 1: Core files');
    const coreFiles = [
        './',
        './index.html',
        './manifest.json',
        './favicon.ico',
        './javascript/app.min.js',
        './javascript/tree.json',
        './css/app.min.css'
    ];
    manifest.preCache.local.push(...coreFiles);
    console.log(`[Cache]   ✓ ${coreFiles.length} core files`);
    
    let stepNum = 2;
    const allCDNUrls = [];
    
    // Scan configured directories
    for (const [dirName, dirConfig] of Object.entries(config.scanDirectories)) {
        if (!dirConfig.enabled) {
            console.log(`[Cache] Step ${stepNum++}: ${dirName} (disabled)`);
            continue;
        }
        
        console.log(`[Cache] Step ${stepNum++}: Scanning ${dirName}`);
        
        // Add all files to cache for Home directory
        if (dirName === 'Home' || dirName === 'assets' || dirName === 'vendor') {
            const files = scanDirectory(dirName, null, config.excludePatterns);
            manifest.preCache.local.push(...files);
            console.log(`[Cache]   ✓ ${files.length} files added to cache`);
        }
        
        // Scan files for CDN resources
        const files = scanDirectory(dirName, dirConfig.extensions, config.excludePatterns);
        
        for (const file of files) {
            if (!existsSync(file)) continue;
            
            try {
                const content = readFileSync(file, 'utf-8');
                const ext = file.substring(file.lastIndexOf('.'));
                const override = dirConfig.overrides?.[ext];
                
                if (ext === '.html') {
                    const urls = extractHTMLUrls(content);
                    allCDNUrls.push(...urls);
                } else if (ext === '.css') {
                    const urls = extractCSSUrls(content);
                    allCDNUrls.push(...urls);
                } else if (ext === '.js') {
                    const urls = extractJSUrls(content, config);
                    if (urls.length > 0) {
                        console.log(`[Cache]     ${file}: ${urls.length} CDN resources`);
                    }
                    allCDNUrls.push(...urls);
                } else if (ext === '.md') {
                    const images = extractMDImages(content);
                    
                    if (override?.cacheAllImages) {
                        // Cache ALL images (local + external)
                        for (const img of images) {
                            if (img.startsWith('http')) {
                                allCDNUrls.push(img);
                            } else {
                                const imgPath = img.startsWith('./') ? img : './' + img;
                                if (existsSync(imgPath)) {
                                    manifest.preCache.local.push(imgPath);
                                }
                            }
                        }
                        if (images.length > 0) {
                            console.log(`[Cache]     ${file}: ${images.length} images (all cached)`);
                        }
                    } else {
                        // Only cache CDN images
                        allCDNUrls.push(...images.filter(img => img.startsWith('http')));
                    }
                }
            } catch (e) {
                console.warn(`[Cache]     ⚠ Failed to read ${file}: ${e.message}`);
            }
        }
    }
    
    // Scan external CSS
    console.log(`[Cache] Step ${stepNum++}: Scanning external CSS`);
    const externalCSS = allCDNUrls.filter(url => url.endsWith('.css') && url.startsWith('http'));  // ← ONLY external URLs
    for (const cssUrl of externalCSS) {
        const fonts = await scanExternalCSS(cssUrl);
        allCDNUrls.push(...fonts);
        if (fonts.length > 0) {
            console.log(`[Cache]   ✓ ${cssUrl}: ${fonts.length} resources`);
        }
    }
    
    // Expand MathJax
    console.log(`[Cache] Step ${stepNum++}: Expanding MathJax resources`);
    const expandedUrls = expandMathJaxResources(allCDNUrls, config);
    const newMathJax = expandedUrls.length - allCDNUrls.length;
    if (newMathJax > 0) {
        console.log(`[Cache]   ✓ Added ${newMathJax} MathJax fonts`);
    }
    
    // Remove duplicates
    manifest.preCache.local = [...new Set(manifest.preCache.local)];
    manifest.preCache.cdn = [...new Set(expandedUrls)];
    
    // Write manifest
    const outputPath = 'javascript/cache-manifest.json';
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
    
    console.log('[Cache] ═══════════════════════════════════════════════════════');
    console.log('[Cache] ✅ Generated javascript/cache-manifest.json');
    console.log(`[Cache] Version: ${manifest.version}`);
    console.log(`[Cache] Local: ${manifest.preCache.local.length}`);
    console.log(`[Cache] CDN: ${manifest.preCache.cdn.length}`);
    console.log(`[Cache] TOTAL: ${manifest.preCache.local.length + manifest.preCache.cdn.length}`);
    console.log('[Cache] ═══════════════════════════════════════════════════════');
}

generateCacheManifest().catch(e => {
    console.error('[Cache] ❌ Failed:', e);
    process.exit(1);
});
CACHEMANIFEST

    chmod +x scripts/generate-cache-manifest.mjs
    print_success "Created scripts/generate-cache-manifest.mjs (config-based)"
}

################################################################################
# Create PostCSS Configuration
################################################################################

create_postcss_config() {
    print_header "Creating PostCSS Configuration"

    cat > postcss.config.cjs << 'POSTCSSCONFIG'
module.exports = {
  plugins: {
    'postcss-import': {},
    'cssnano': {
      preset: ['default', {
        discardComments: {
          removeAll: true,
        },
        normalizeWhitespace: true,
        colormin: true,
        minifyFontValues: true,
        minifySelectors: true,
      }],
    },
  },
};
POSTCSSCONFIG

    print_success "Created postcss.config.cjs"
}

################################################################################
# Create Rollup Configuration (JavaScript)
################################################################################

create_rollup_config_js() {
    print_header "Creating Rollup Configuration (JavaScript)"

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
# Create Rollup Configuration (CSS)
################################################################################

create_rollup_config_css() {
    print_header "Creating Rollup Configuration (CSS)"

    cat > rollup.config.css.js << 'ROLLUPCSSCONFIG'
import postcss from 'rollup-plugin-postcss';

export default {
  input: 'css/main.css',
  output: {
    file: 'css/app.min.css',
  },
  plugins: [
    postcss({
      extract: true,
      minimize: true,
      sourceMap: true,
      extensions: ['.css'],
    }),
  ],
};
ROLLUPCSSCONFIG

    print_success "Created rollup.config.css.js"
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

  // In-memory modifications for development
  if (filePath.endsWith('index.html')) {
    content = content.toString()
      .replace('src="./javascript/app.min.js"', 'src="./javascript/app.js"')
      .replace('href="./css/app.min.css"', 'href="./css/styles.css" />\n    <link rel="stylesheet" href="./css/modules.css"');
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
# Create Prod Server (HTTPS Support - FIXED)
################################################################################

create_prod_server() {
    print_header "Creating Production Server"

    cat > scripts/prod-server.mjs << 'PRODSERVER'
#!/usr/bin/env node

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
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

function requestHandler(req, res) {
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
}

// Get local IP addresses
function getLocalIPAddresses() {
  const addresses = [];
  const networkInterfaces = os.networkInterfaces();

  Object.keys(networkInterfaces).forEach(name => {
    networkInterfaces[name].forEach(net => {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    });
  });

  return addresses;
}

// Check if certificates exist
const certPath = path.join(ROOT, '.cert', 'cert.pem');
const keyPath = path.join(ROOT, '.cert', 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  // HTTPS server
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };

  const server = https.createServer(options, requestHandler);

  server.listen(PORT, () => {
    console.log(`[Prod 3001] ✅ HTTPS Server ready`);
    console.log(`[Prod 3001] 🔒 Access via:`);

    const addresses = getLocalIPAddresses();

    if (addresses.length > 0) {
      addresses.forEach(addr => {
        console.log(`[Prod 3001]    https://${addr}:${PORT}`);
      });
    }
    console.log(`[Prod 3001]    https://localhost:${PORT}`);
    console.log(`[Prod 3001] ⚠️  Accept certificate warning on first visit`);
  });
} else {
  // Fallback to HTTP
  console.log('[Prod 3001] ⚠️  No HTTPS certificates found (.cert/cert.pem, .cert/key.pem)');
  console.log('[Prod 3001] ⚠️  PWA Service Workers require HTTPS to function');
  console.log('[Prod 3001] ⚠️  Run setup-rollup.sh again to generate certificates');
  console.log('[Prod 3001] Starting HTTP server (service workers will not work)...');

  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    console.log(`[Prod 3001] HTTP Server ready (no HTTPS)`);
    console.log(`[Prod 3001] http://localhost:${PORT}`);
  });
}
PRODSERVER

    chmod +x scripts/prod-server.mjs
    print_success "Created scripts/prod-server.mjs (with HTTPS support, FIXED)"
}

################################################################################
# Create File Watcher (JS + CSS)
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
const WATCH_JS = path.join(ROOT, 'javascript');
const WATCH_CSS = path.join(ROOT, 'css');

let buildingJs = false;
let buildingCss = false;

function buildJs() {
  if (buildingJs) return;

  buildingJs = true;
  console.log('[Watcher] JS changes detected, rebuilding...');

  const buildProcess = spawn('npm', ['run', 'build:js'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('[Watcher] JS build complete');
    } else {
      console.log('[Watcher] JS build failed');
    }
    buildingJs = false;
  });
}

function buildCss() {
  if (buildingCss) return;

  buildingCss = true;
  console.log('[Watcher] CSS changes detected, rebuilding...');

  const buildProcess = spawn('npm', ['run', 'build:css'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('[Watcher] CSS build complete');
    } else {
      console.log('[Watcher] CSS build failed');
    }
    buildingCss = false;
  });
}

console.log('[Watcher] Watching for changes...');
console.log('[Watcher]   - javascript/');
console.log('[Watcher]   - css/');

fs.watch(WATCH_JS, { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.js') && !filename.includes('app.min.js')) {
    buildJs();
  }
});

fs.watch(WATCH_CSS, { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.css') && !filename.includes('app.min.css') && !filename.includes('main.css')) {
    buildCss();
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
console.log('   Uses: javascript/app.js + css/styles.css + css/modules.css\n');

console.log('🚀 Production Server');
console.log('   https://localhost:3001 (or https://YOUR_IP:3001)');
console.log('   Uses: javascript/app.min.js + css/app.min.css');
console.log('   HTTPS enabled for PWA testing\n');

console.log('🔄 File Watcher');
console.log('   Auto-rebuilds on changes in javascript/ and css/\n');

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
    "generate:css-entry": "node scripts/generate-css-entry.mjs",
    "cache:generate": "node scripts/generate-cache-manifest.mjs",
    "prebuild:css": "npm run generate:css-entry",
    "prebuild": "npm run cache:generate",
    "build": "npm run build:tree && npm run build:css && npm run build:js",
    "build:js": "rollup -c rollup.config.js",
    "build:css": "rollup -c rollup.config.css.js",
    "build:tree": "node scripts/generate-tree.mjs",
    "test": "npm run build && node scripts/test-dual-server.mjs",
    "dev": "node scripts/dev-server.mjs",
    "preview": "node scripts/prod-server.mjs",
    "watch": "node scripts/watch-and-build.mjs",
    "clean": "rm -f javascript/app.min.js* css/app.min.css* css/main.css javascript/cache-manifest.json"
  },
  "devDependencies": {
    "@rollup/plugin-node-resolve": "^15.2.3",
    "@rollup/plugin-terser": "^0.4.4",
    "cssnano": "^6.0.3",
    "postcss": "^8.4.33",
    "postcss-import": "^16.0.0",
    "rollup": "^4.9.6",
    "rollup-plugin-postcss": "^4.0.2"
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

    print_success "Created package.json with comprehensive cache scripts"
}

################################################################################
# Update .gitignore
################################################################################

update_gitignore() {
    print_header "Updating .gitignore"

    cat > .gitignore << 'GITIGNORE'
# Node modules
node_modules/
*.log

# Build outputs (auto-generated)
css/main.css
css/app.min.css
css/app.min.css.map
javascript/app.min.js
javascript/app.min.js.map
javascript/tree.json
javascript/cache-manifest.json

# HTTPS certificates (local testing only)
.cert/

# Build documentation
ROLLUP-GUIDE.md

# OS files
.DS_Store

# IDE
.vscode/
.idea/

# Backups
backup-*/
GITIGNORE

    print_success "Created .gitignore"
}

################################################################################
# Create Documentation
################################################################################

create_documentation() {
    print_header "Creating Documentation"

    cat > ROLLUP-GUIDE.md << 'GUIDE'
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
GUIDE

    print_success "Created ROLLUP-GUIDE.md"
}

################################################################################
# Update index.html Reference
################################################################################

update_index_html() {
    print_header "Updating index.html"

    # Update JavaScript reference
    if grep -q 'src="./javascript/app.js"' index.html; then
        print_info "Updating JS script reference to app.min.js..."
        sed -i.bak 's|src="./javascript/app.js"|src="./javascript/app.min.js"|g' index.html
        print_success "Updated JavaScript reference"
    elif grep -q 'src="./javascript/app.min.js"' index.html; then
        print_success "JavaScript reference already uses app.min.js"
    else
        print_warning "Could not find JS script tag in index.html"
    fi

    # Update CSS references
    if grep -q 'href="./css/styles.css"' index.html; then
        print_info "Consolidating CSS references to app.min.css..."
        sed -i.bak 's|<link rel="stylesheet" href="./css/styles.css" />|<link rel="stylesheet" href="./css/app.min.css" />|g' index.html
        sed -i.bak '/<link rel="stylesheet" href="\.\/css\/modules.css"/d' index.html
        print_success "Updated CSS references to app.min.css"
    elif grep -q 'href="./css/app.min.css"' index.html; then
        print_success "CSS reference already uses app.min.css"
    else
        print_warning "Could not find CSS link tags in index.html"
    fi

    # Remove manifest link (loaded conditionally by JS)
    if grep -q '<link rel="manifest"' index.html; then
        print_info "Removing manifest link (will be loaded conditionally by JS)..."
        sed -i.bak '/<link rel="manifest"/d' index.html
        print_success "Removed manifest link from HTML"
    fi

    rm -f index.html.bak
}

################################################################################
# Install Dependencies
################################################################################

install_dependencies() {
    print_header "Installing Dependencies"

    print_info "Installing Rollup, PostCSS, and plugins..."
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

    print_info "Generating CSS entry point..."
    if npm run generate:css-entry; then
        print_success "Generated css/main.css"
    else
        print_error "CSS entry generation failed"
        exit 1
    fi

    print_info "Building CSS bundle..."
    if npm run build:css; then
        print_success "Built css/app.min.css"
    else
        print_error "CSS build failed"
        exit 1
    fi

    print_info "Building JavaScript bundle..."
    if npm run build:js; then
        print_success "Built javascript/app.min.js"
    else
        print_error "JavaScript build failed"
        exit 1
    fi

    print_info "Generating comprehensive cache manifest (this may take 30-60 seconds)..."
    if npm run cache:generate; then
        print_success "Generated javascript/cache-manifest.json"
    else
        print_warning "Cache manifest generation failed"
    fi
}

################################################################################
# Final Summary
################################################################################

print_summary() {
    print_header "Setup Complete"

    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Rollup Build System + Full PWA v4.6 Installed${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    print_info "Files Created:"
    echo "  ✓ rollup.config.js"
    echo "  ✓ rollup.config.css.js"
    echo "  ✓ postcss.config.cjs"
    echo "  ✓ scripts/generate-css-entry.mjs"
    echo "  ✓ scripts/generate-cache-manifest.mjs (comprehensive)"
    echo "  ✓ scripts/dev-server.mjs"
    echo "  ✓ scripts/prod-server.mjs (HTTPS support)"
    echo "  ✓ scripts/watch-and-build.mjs"
    echo "  ✓ scripts/test-dual-server.mjs"
    echo "  ✓ .cert/cert.pem (HTTPS certificate)"
    echo "  ✓ .cert/key.pem (HTTPS private key)"
    echo "  ✓ package.json"
    echo "  ✓ ROLLUP-GUIDE.md"
    echo ""

    print_info "Build Output:"
    echo "  ✓ css/main.css (auto-generated)"
    echo "  ✓ css/app.min.css"
    echo "  ✓ javascript/app.min.js"
    echo "  ✓ javascript/cache-manifest.json (comprehensive)"
    echo ""

    print_info "PWA Features:"
    echo "  ✓ Pre-cache EVERYTHING on first install"
    echo "  ✓ Auto-detect ALL CDN resources (CSS, fonts, etc.)"
    echo "  ✓ Scan external CSS for fonts"
    echo "  ✓ Zero runtime caching needed"
    echo "  ✓ Full offline support immediately"
    echo "  ✓ HTTPS for local testing"
    echo "  ✓ Debug logging"
    echo ""

    # Get local IP for HTTPS access
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Quick Start${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "  Test both modes:"
    echo -e "     ${GREEN}npm run test${NC}"
    echo ""
    echo "  Then open:"
    echo "     http://localhost:3000 (dev)"
    echo "     https://localhost:3001 (prod with HTTPS)"
    if [ ! -z "$LOCAL_IP" ]; then
        echo "     https://$LOCAL_IP:3001 (from iPhone)"
    fi
    echo ""
    echo "  Build for deployment:"
    echo -e "     ${GREEN}npm run build${NC}"
    echo ""

    print_info "Testing PWA on iPhone:"
    echo "  1. Start prod server: npm run preview"
    if [ ! -z "$LOCAL_IP" ]; then
        echo "  2. iPhone Safari → https://$LOCAL_IP:3001"
    else
        echo "  2. iPhone Safari → https://YOUR_MAC_IP:3001"
    fi
    echo "  3. Accept certificate warning"
    echo "  4. Add to Home Screen"
    echo "  5. Open from home screen"
    echo "  6. Wait 30-60 seconds (caching EVERYTHING)"
    echo "  7. Full offline support!"
    echo ""

    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  🎉 EVERYTHING will be pre-cached on first PWA install!${NC}"
    echo -e "${GREEN}  No runtime caching - full functionality from first load!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${GREEN}Ready to start. Run 'npm run test' to begin.${NC}"
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
    echo -e "${BLUE}║         Unstablon PKM - Rollup Build System v4.6            ║${NC}"
    echo -e "${BLUE}║                                                              ║${NC}"
    echo -e "${BLUE}║   Full Offline PWA - Pre-cache EVERYTHING                   ║${NC}"
    echo -e "${BLUE}║   Auto-detect ALL CDN resources                              ║${NC}"
    echo -e "${BLUE}║                                                              ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    preflight_checks
    backup_existing_files
    generate_https_certificate
    create_cache_scan_config
    create_css_entry_generator
    create_cache_manifest_generator
    create_postcss_config
    create_rollup_config_js
    create_rollup_config_css
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
