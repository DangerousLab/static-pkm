/**
 * IPC command and response types for Tauri backend communication
 */

import type { NavigationNode } from './navigation';

/** File entry returned by list_directory */
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  modifiedAt?: number;
}

/** Search result from backend */
export interface SearchResult {
  id: string;
  title: string;
  path: string;
  type: 'module' | 'page' | 'document';
  score: number;
  snippet?: string;
}

/** Navigation tree response */
export interface NavigationTreeResponse {
  root: NavigationNode;
}

/** Generic IPC error response */
export interface IpcError {
  message: string;
  code?: string;
}

/** Content index entry for SQLite */
export interface ContentIndexEntry {
  id: string;
  path: string;
  title: string;
  type: 'module' | 'page' | 'document';
  body?: string;
  modifiedAt: number;
  indexedAt: number;
}
