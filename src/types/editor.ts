/**
 * Editor-related type definitions
 * Simplified for Obsidian-style always-auto-save approach
 */

/**
 * Optional document state for cursor/scroll restoration (UX enhancement)
 */
export interface DocumentState {
  /** Cursor position (character offset) */
  cursorPosition: number;
  /** Scroll position (pixels from top) */
  scrollPosition: number;
}
