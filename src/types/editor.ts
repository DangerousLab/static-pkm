/**
 * Editor-related type definitions
 * Simplified for Obsidian-style always-auto-save approach
 */

/**
 * Optional document state for cursor/scroll restoration (UX enhancement)
 * Simplified to scroll percentage only - works reliably across modes
 */
export interface DocumentState {
  /** Scroll percentage (0-1) - primary cross-mode coordinate */
  scrollPercentage: number;
}
