/**
 * Utility functions
 * Helper functions used across multiple modules
 */

import { state } from './state.js';

/**
 * Find a node by its path in the navigation tree
 */
export function findNodeByPath(node, path) {
  if (node.path === path) return node;
  if (!node.children) return null;
  for (const child of node.children) {
    const found = findNodeByPath(child, path);
    if (found) return found;
  }
  return null;
}

/**
 * Find a leaf node (module/page/document) by its ID
 */
export function findLeafById(node, id) {
  if (!node) return null;
  if (
    (node.type === "module" ||
      node.type === "page" ||
      node.type === "document") &&
    node.id === id
  ) {
    return node;
  }
  if (!node.children) return null;
  for (const child of node.children) {
    const found = findLeafById(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Find the parent folder of a given node
 */
export function findParentFolder(node) {
  if (!node || !node.path) return state.navigationTree;

  const pathParts = node.path.split("/");
  if (pathParts.length <= 1) return state.navigationTree;

  const parentPath = pathParts.slice(0, -1).join("/");
  return findNodeByPath(state.navigationTree, parentPath) || state.navigationTree;
}

/**
 * Check if viewport is desktop or tablet size
 */
export function isDesktopOrTablet() {
  return window.innerWidth >= 841;
}

/**
 * Check if viewport is medium size (tablet range)
 */
export function isMediumViewport() {
  return window.innerWidth >= 841 && window.innerWidth <= 1470;
}

/**
 * Calculate if sidebar should auto-close on content click
 * Returns true if sidebar overlaps content when open
 * Computed dynamically based on viewport width and layout
 */
export function shouldAutoCloseSidebar() {
  // Always auto-close in landscape mode
  if (window.matchMedia('(max-height: 600px) and (orientation: landscape)').matches) {
    return true;
  }
  
  // Always auto-close on mobile (below tablet breakpoint)
  if (window.innerWidth < 841) {
    return true;
  }
  
  // Desktop/tablet: Calculate if sidebar overlaps centered content
  const sidebarWidth = state.baseSidebarWidth; // 240px by default
  const contentMaxWidth = state.contentMaxWidth; // from .page-root max-width in CSS
  const padding = 16; // Single side padding (var(--space-md))
  
  // Formula: content + (2 × sidebar) + (2 × padding)
  // Content stays centered, needs equal space on both sides
  const minWidthNoOverlap = contentMaxWidth + (2 * sidebarWidth) + (2 * padding);
  
  // If viewport is narrower than needed space, sidebar overlaps
  return window.innerWidth < minWidthNoOverlap;
}

/**
 * Convert file path to URL
 */
export function scriptUrlFromFile(filePath) {
  return "./" + filePath;
}

/**
 * Generate factory function name from module ID
 */
export function factoryNameFromId(id) {
  return "create" + id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Wait for a module factory to be registered
 */
export function waitForFactory(factoryName) {
  return new Promise((resolve) => {
    // Check if already available
    if (typeof window[factoryName] === "function") {
      resolve(window[factoryName]);
      return;
    }

    // Register callback to be notified when ready
    if (!state.moduleReadyCallbacks.has(factoryName)) {
      state.moduleReadyCallbacks.set(factoryName, []);
    }
    state.moduleReadyCallbacks.get(factoryName).push(resolve);
  });
}

/**
 * Notify that a module factory is ready
 */
export function notifyModuleReady(factoryName) {
  const callbacks = state.moduleReadyCallbacks.get(factoryName);
  if (callbacks) {
    const factory = window[factoryName];
    callbacks.forEach(cb => cb(factory));
    state.moduleReadyCallbacks.delete(factoryName);
  }
}

/**
 * Extract display name from module code without executing it
 * Looks for window.moduleInfo.displayName = "..." pattern
 * @param {string} code - Module source code
 * @returns {string|null} - Display name or null
 */
export function extractDisplayNameFromCode(code) {
  if (!code || typeof code !== 'string') {
    return null;
  }
  
  // Match: window.moduleInfo = { displayName: "Name" }
  const infoMatch = code.match(/window\.moduleInfo\s*=\s*\{[^}]*displayName\s*:\s*["']([^"']+)["']/);
  if (infoMatch) {
    return infoMatch[1];
  }
  
  // Fallback: Extract from function name (createMyModule → My Module)
  const factoryMatch = code.match(/function\s+(create\w+)/);
  if (factoryMatch) {
    return factoryMatch[1]
      .replace(/^create/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  }
  
  return null;
}
