/**
 * Block store types for the Persistent Window Architecture.
 *
 * The block store splits a markdown document into paragraph-level blocks,
 * keeping only a viewport-sized window in TipTap at any time. Blocks outside
 * the viewport are held in the Rust backend's in-memory DocumentStore.
 *
 * @module blockstore
 */

// ── Block metadata ─────────────────────────────────────────────────────────────

/**
 * Semantic type of a block, determined by the Rust scanner.
 *
 * Code fences and tables use `overflow-x: auto` in CSS (no text wrapping),
 * so their estimated heights are viewport-independent and more accurate.
 * Headings carry explicit CSS-measured heights (font-size, margins, line-height).
 * Paragraphs, lists, and blockquotes can wrap; their heights are estimated from
 * line count and refined later by DOM measurement.
 *
 * v5.3: Added heading1-6, list, blockquote, horizontalRule variants.
 */
export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'list'
  | 'blockquote'
  | 'horizontalRule'
  | 'codeFence'
  | 'table'
  | 'frontmatter';

/** Metadata for a single content block (no markdown body). */
export interface BlockMeta {
  /** Zero-based sequential index. */
  id: number;
  /** First line number of this block in the source file (zero-based). */
  startLine: number;
  /** Last line number of this block in the source file (inclusive, zero-based). */
  endLine: number;
  /** Hex-encoded FNV-1a hash of the block content for change detection. */
  contentHash: string;
  /** Semantic block type — used for rendering hints and height estimation. */
  blockType: BlockType;
  
  // Oracle hint fields
  lineCount: number;
  rowCount: number | null;
  colCount: number | null;
  textContent: string;
  estimatedHeight?: number;
}

// ── Document handle ────────────────────────────────────────────────────────────

/**
 * Returned by `open_document`. Contains full block metadata but no content.
 * The frontend uses this to initialise the synthetic scrollbar and
 * ViewportCoordinator.
 */
export interface DocumentHandle {
  /** Unique document identifier (normalised absolute path). */
  docId: string;
  /** Absolute filesystem path to the source file. */
  path: string;
  /** Total number of blocks in the document. */
  totalBlocks: number;
  /** Metadata for every block in document order. */
  blocks: BlockMeta[];
}

// ── Block content ──────────────────────────────────────────────────────────────

/** A block with its markdown body — returned by `get_blocks`. */
export interface BlockContent {
  id: number;
  markdown: string;
}

// ── Edit sync ──────────────────────────────────────────────────────────────────

/** Result returned by `update_visible_window` after the backend re-scans. */
export interface WindowUpdateResult {
  /** New total block count after potential splits/merges. */
  newTotalBlocks: number;
  /** Updated block metadata (full document, for scrollbar recalibration). */
  blocks: BlockMeta[];
}

// ── Search ─────────────────────────────────────────────────────────────────────

/** A search match within the block store. */
export interface BlockSearchMatch {
  blockId: number;
  startLine: number;
  matchText: string;
}

// ── Viewport ───────────────────────────────────────────────────────────────────

/** Scroll mode — position-aware, no velocity classification. */
export type ScrollMode = 'smooth' | 'flyover' | 'settle';

/** Emitted by ViewportCoordinator on every scroll event. */
export interface ViewportUpdate {
  /** Index of the first block in the loaded window (may include buffer). */
  startBlock: number;
  /** Index past the last block in the loaded window. */
  endBlock: number;
  /** Scroll mode: smooth (content ready), flyover (outside loaded range), settle (stopped). */
  mode: ScrollMode;
  /** CSS translateY value for the editor anchor div (pixels). */
  translateY: number;
}

/** Visible block range used for edit-sync saves. */
export interface VisibleRange {
  startBlock: number;
  endBlock: number;
}
