#!/usr/bin/env node

/**
 * Dynamic CSS Entry Point Generator
 * Auto-discovers CSS source files recursively and creates main.css import file
 *
 * Features:
 * - Recursive directory scanning (core/, layout/, components/)
 * - Dependency-ordered imports (variables → resets → layout → components)
 * - No hardcoding - scans css/ directory
 * - Excludes build outputs (*.min.css, *.map)
 * - Excludes itself (main.css)
 */

import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const CSS_DIR = 'css';
const OUTPUT_FILE = 'main.css';

// Canonical import order (dependency-based)
const IMPORT_ORDER = [
  'core/variables.css',      // CSS variables first
  'core/reset.css',          // Then resets
  'core/safe-areas.css',     // Then mobile safe areas
  'layout/app-shell.css',    // Layout structure
  'layout/header.css',
  'layout/animations.css',
  'layout/responsive.css',
  'components/sidebar.css',  // Components
  'components/navigation.css',
  'components/search.css',
  'components/content.css',
  'modules.css',             // Shared patterns
  'styles.css',              // Legacy/theme (last)
];

console.log('[CSS Entry] Auto-discovering CSS files recursively...');

/**
 * Recursively find all CSS files in a directory
 */
function findCssFiles(dir, baseDir = dir) {
  const files = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Recurse into subdirectories
        files.push(...findCssFiles(fullPath, baseDir));
      } else if (entry.endsWith('.css')) {
        // Get relative path from base directory
        const relativePath = relative(baseDir, fullPath);

        // Exclude the output file itself
        if (entry === OUTPUT_FILE) continue;

        // Exclude minified files
        if (entry.endsWith('.min.css')) continue;

        // Exclude source maps
        if (entry.endsWith('.css.map')) continue;

        files.push(relativePath);
      }
    }
  } catch (error) {
    console.error(`[CSS Entry] ⚠️  Failed to read directory ${dir}:`, error.message);
  }

  return files;
}

// Discover all CSS files recursively
const discoveredFiles = findCssFiles(CSS_DIR);

if (discoveredFiles.length === 0) {
  console.error('[CSS Entry] ❌ No CSS source files found in css/ directory');
  process.exit(1);
}

console.log(`[CSS Entry] ✅ Discovered ${discoveredFiles.length} CSS file(s):`);

/**
 * Sort files by dependency order
 */
function sortByImportOrder(files) {
  const ordered = [];
  const remaining = [...files];

  // Normalize paths for comparison (convert backslashes to forward slashes)
  const normalizedRemaining = remaining.map(f => f.replace(/\\/g, '/'));

  // First, add files in canonical order
  for (const orderedFile of IMPORT_ORDER) {
    const index = normalizedRemaining.indexOf(orderedFile);
    if (index !== -1) {
      ordered.push(remaining[index]);
      remaining.splice(index, 1);
      normalizedRemaining.splice(index, 1);
    }
  }

  // Then add any remaining files alphabetically
  remaining.sort();
  ordered.push(...remaining);

  return ordered;
}

const sortedFiles = sortByImportOrder(discoveredFiles);

// Log discovered files
sortedFiles.forEach((file, index) => {
  const normalizedFile = file.replace(/\\/g, '/');
  const inOrder = IMPORT_ORDER.includes(normalizedFile) ? '✓' : '•';
  console.log(`[CSS Entry]    ${inOrder} ${file}`);
});

// Generate import statements
const imports = sortedFiles
  .map(file => `@import './${file.replace(/\\/g, '/')}';`)
  .join('\n');

const content = `/**
 * Auto-generated CSS Entry Point - DO NOT EDIT
 * Generated: ${new Date().toISOString()}
 *
 * This file is dynamically created by scripts/generate-css-entry.mjs
 * It imports all CSS source files in dependency order for bundling
 *
 * Import Order:
 * 1. Core (variables, reset, safe-areas)
 * 2. Layout (app-shell, header, animations, responsive)
 * 3. Components (sidebar, navigation, search, content)
 * 4. Shared patterns (modules.css)
 * 5. Legacy/theme (styles.css)
 *
 * Discovered ${sortedFiles.length} CSS source file(s)
 */

${imports}
`;

// Write the file
const outputPath = join(CSS_DIR, OUTPUT_FILE);
writeFileSync(outputPath, content, 'utf-8');

console.log(`[CSS Entry] ✅ Generated ${CSS_DIR}/${OUTPUT_FILE}`);
console.log('[CSS Entry] Ready for Vite/PostCSS bundling');
