/**
 * IPC command wrappers for Tauri backend communication
 * Type-safe wrappers around invoke() calls
 * With PWA fallback implementations
 */

import { invoke } from '@tauri-apps/api/core';
import type { FileEntry, SearchResult } from '@/types/ipc';
import type { FolderNode } from '@/types/navigation';
import { isTauriContext } from './platform';

/**
 * Read file contents from filesystem
 * @param path - Absolute path to file
 * @returns File contents as string
 */
export async function readFile(path: string): Promise<string> {
  console.log('[INFO] [IPC] readFile:', path);

  // Tauri mode - use native backend
  if (isTauriContext()) {
    return invoke<string>('read_file', { path });
  }

  // Browser/PWA mode - fetch from static files
  const response = await fetch('./' + path);
  if (!response.ok) {
    throw new Error(`Failed to read file: ${path}`);
  }
  return response.text();
}

/**
 * Write content to file
 * @param path - Absolute path to file
 * @param content - Content to write
 */
export async function writeFile(path: string, content: string): Promise<void> {
  console.log('[INFO] [IPC] writeFile:', path);

  // Only supported in Tauri mode
  if (isTauriContext()) {
    return invoke<void>('write_file', { path, content });
  }

  throw new Error('Write operations not supported in PWA/browser mode (read-only)');
}

/**
 * List directory contents
 * @param path - Directory path
 * @returns Array of file entries
 */
export async function listDirectory(path: string): Promise<FileEntry[]> {
  console.log('[INFO] [IPC] listDirectory:', path);

  // Only supported in Tauri mode
  if (isTauriContext()) {
    return invoke<FileEntry[]>('list_directory', { path });
  }

  // PWA mode - not supported, use tree.json instead
  console.warn('[WARN] [IPC] listDirectory not supported in PWA mode, use getNavigationTree instead');
  return [];
}

/**
 * Get navigation tree from Home directory
 * @param homePath - Path to Home directory
 * @returns Navigation tree root node
 */
export async function getNavigationTree(homePath: string): Promise<FolderNode> {
  console.log('[INFO] [IPC] getNavigationTree:', homePath);

  // Tauri mode - generate tree from filesystem
  if (isTauriContext()) {
    return invoke<FolderNode>('get_navigation_tree', { homePath });
  }

  // Browser/PWA mode - fetch pre-generated tree.json
  const response = await fetch('./tree.json');
  if (!response.ok) {
    throw new Error('Failed to load navigation tree');
  }
  return response.json();
}

/**
 * Search content using FTS5
 * @param query - Search query string
 * @returns Search results sorted by relevance
 */
export async function searchContent(query: string): Promise<SearchResult[]> {
  console.log('[INFO] [IPC] searchContent:', query);
  return invoke<SearchResult[]>('search_content', { query });
}

/**
 * Index a content file for search
 * @param path - Path to content file
 */
export async function indexContent(path: string): Promise<void> {
  console.log('[INFO] [IPC] indexContent:', path);
  return invoke<void>('index_content', { path });
}

/**
 * Rebuild the entire search index
 * @param homePath - Path to Home directory
 * @returns Number of files indexed
 */
export async function rebuildIndex(homePath: string): Promise<number> {
  console.log('[INFO] [IPC] rebuildIndex:', homePath);
  return invoke<number>('rebuild_index', { homePath });
}

// Re-export platform detection utilities
export { isTauriContext, isPWAInstalled, getPlatformMode, isPWABuild } from './platform';
