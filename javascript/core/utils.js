/**
 * Utility functions
 * Helper functions used across multiple modules
 */

import { state } from './state.js';
import { loadFontAwesome } from '../utilities/dynamic-loader.js';  // ← ADDED

// Track if icons have been initialized
let iconsInitialized = false;  // ← ADDED

/**
 * Ensure FontAwesome is loaded before using icons
 * Call this before any function that uses getTypeIcon()
 */
export async function ensureIconsLoaded() {  // ← ADDED: New function
  if (iconsInitialized) return;
  
  console.log('[Utils] Ensuring icons are loaded for navigation');
  await loadFontAwesome();
  iconsInitialized = true;
}

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
 * Get icon for content type
 */
export function getTypeIcon(type) {
  switch (type) {
    case "module":
      return '<i class="fa-solid fa-gear"></i>';
    case "page":
      return '<i class="fa-regular fa-file"></i>';
    case "document":
      return '<i class="fa-regular fa-file-lines"></i>';
    case "folder":
      return '<i class="fa-regular fa-folder"></i>';
    case "back":
      return '<i class="fa-solid fa-caret-left"></i>';
    default:
      return '<i class="fa-solid fa-circle"></i>';
  }
}