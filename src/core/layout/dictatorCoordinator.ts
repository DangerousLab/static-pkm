/**
 * oracleCoordinator.ts
 *
 * A thin memory bridge connecting the Rust Backend, Layout Engine, and Layout Oracle.
 *
 * It stores the `NodeManifest` array for the currently open note.
 * When the window resizes or the sidebar is toggled, `useLayoutEngine` triggers
 * a synchronous layout recalculation. By holding the manifests here, the Oracle
 * can compute new text-wrapping heights instantly without requiring an async
 * IPC call back to Rust during the hot resize path.
 */

import type { NodeManifest } from '../../types/layout';

let currentManifests: NodeManifest[] = [];
let currentNoteId: string | null = null;

/**
 * Set the current manifests and noteId.
 */
export function setCurrentNoteContext(noteId: string, manifests: NodeManifest[]): void {
  currentNoteId = noteId;
  currentManifests = [...manifests];
}

/**
 * Retrieve the manifests currently in memory.
 */
export function getCurrentNoteManifests(): NodeManifest[] {
  return currentManifests;
}

/**
 * Retrieve the current noteId in memory.
 */
export function getCurrentNoteId(): string | null {
  return currentNoteId;
}

/**
 * Clear the manifests (usually called when a note is closed).
 */
export function clearCurrentManifests(): void {
  currentManifests = [];
  currentNoteId = null;
}
