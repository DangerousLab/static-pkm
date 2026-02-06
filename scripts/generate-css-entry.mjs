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