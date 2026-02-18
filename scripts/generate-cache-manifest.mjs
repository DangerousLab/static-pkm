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
