/**
 * IPC command wrappers for Tauri backend communication
 * Type-safe wrappers around invoke() calls
 */

import { invoke } from '@tauri-apps/api/core';
import type { FileEntry, SearchResult } from '@/types/ipc';
import type { FolderNode } from '@/types/navigation';

/**
 * Read file contents from filesystem
 * @param path - Absolute path to file
 * @returns File contents as string
 */
export async function readFile(path: string): Promise<string> {
  console.log('[INFO] [IPC] readFile:', path);
  return invoke<string>('read_file', { path });
}

/**
 * Write content to file
 * @param path - Absolute path to file
 * @param content - Content to write
 */
export async function writeFile(path: string, content: string): Promise<void> {
  console.log('[INFO] [IPC] writeFile:', path);
  return invoke<void>('write_file', { path, content });
}

/**
 * List directory contents
 * @param path - Directory path
 * @returns Array of file entries
 */
export async function listDirectory(path: string): Promise<FileEntry[]> {
  console.log('[INFO] [IPC] listDirectory:', path);
  return invoke<FileEntry[]>('list_directory', { path });
}

/**
 * Get navigation tree from Home directory
 * @param homePath - Path to Home directory
 * @returns Navigation tree root node
 */
export async function getNavigationTree(homePath: string): Promise<FolderNode> {
  console.log('[INFO] [IPC] getNavigationTree:', homePath);
  return invoke<FolderNode>('get_navigation_tree', { homePath });
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

/**
 * Check if running in Tauri context
 * @returns true if Tauri APIs are available
 */
export function isTauriContext(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
