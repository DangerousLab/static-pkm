//! Persistent block store for large document editing.
//!
//! Manages in-memory document state split into paragraph-level [`Block`]s.
//! Exposes [`DocumentStore`] as Tauri application state, wrapped in a
//! `Mutex` for safe concurrent access from async IPC handlers.

pub mod scanner;

use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use scanner::{fnv1a_hash, reassemble, scan, Block, BlockType};

// ── IPC-serialisable data types ────────────────────────────────────────────────

/// Block metadata returned to the frontend — no markdown body.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockMeta {
    pub id: usize,
    pub start_line: usize,
    pub end_line: usize,
    /// Hex-encoded FNV-1a hash for change detection.
    pub content_hash: String,
    /// Semantic block type — used for rendering hints.
    pub block_type: BlockType,
    pub line_count: u32,
    pub row_count: Option<u32>,
    pub col_count: Option<u32>,
    pub text_content: String,
}

impl BlockMeta {
    fn from_block(b: &Block) -> Self {
        BlockMeta {
            id: b.id,
            start_line: b.start_line,
            end_line: b.end_line,
            content_hash: format!("{:x}", b.content_hash),
            block_type: b.block_type,
            line_count: b.line_count,
            row_count: b.row_count,
            col_count: b.col_count,
            text_content: b.markdown.clone(),
        }
    }
}

/// Returned by `open_document`.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentHandle {
    pub doc_id: String,
    pub path: String,
    pub total_blocks: usize,
    pub blocks: Vec<BlockMeta>,
}

/// Block with markdown content — returned by `get_blocks`.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockContent {
    pub id: usize,
    pub markdown: String,
}

/// Block update sent from frontend after user edits.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockUpdate {
    pub id: usize,
    pub markdown: String,
}

/// Result returned by `update_visible_window`.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowUpdateResult {
    pub new_total_blocks: usize,
    pub blocks: Vec<BlockMeta>,
}

/// A search match within the block store.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockSearchMatch {
    pub block_id: usize,
    pub start_line: usize,
    pub match_text: String,
}

// ── Internal document state ────────────────────────────────────────────────────

struct DocumentData {
    path: String,
    blocks: Vec<Block>,
    dirty: bool,
}

// ── DocumentStore ──────────────────────────────────────────────────────────────

/// In-memory store for all currently open documents.
///
/// Registered as Tauri application state so every IPC handler can access it
/// via `State<'_, DocumentStore>`.
pub struct DocumentStore {
    documents: Mutex<HashMap<String, DocumentData>>,
}

impl DocumentStore {
    pub fn new() -> Self {
        DocumentStore {
            documents: Mutex::new(HashMap::new()),
        }
    }

    // ── open / close ──────────────────────────────────────────────────────────

    /// Read `path` from disk, scan into blocks, and cache in memory.
    pub fn open_document(&self, path: &str) -> Result<DocumentHandle, String> {
        info!("[INFO] [blockstore] Opening document: {}", path);

        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;

        let blocks = scan(&content);
        let total_blocks = blocks.len();
        let block_metas: Vec<BlockMeta> = blocks.iter().map(BlockMeta::from_block).collect();

        let doc_id = normalize_doc_id(path);

        let data = DocumentData {
            path: path.to_string(),
            blocks,
            dirty: false,
        };

        self.documents
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?
            .insert(doc_id.clone(), data);

        info!(
            "[INFO] [blockstore] Opened '{}' ({} blocks)",
            doc_id, total_blocks
        );

        Ok(DocumentHandle {
            doc_id,
            path: path.to_string(),
            total_blocks,
            blocks: block_metas,
        })
    }

    /// Remove a document from the in-memory store.
    pub fn close_document(&self, doc_id: &str) -> Result<(), String> {
        self.documents
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?
            .remove(doc_id);

        info!("[INFO] [blockstore] Closed document: {}", doc_id);
        Ok(())
    }

    // ── block reads ───────────────────────────────────────────────────────────

    /// Return markdown content for blocks `[start, end)`.
    pub fn get_blocks(
        &self,
        doc_id: &str,
        start: usize,
        end: usize,
    ) -> Result<Vec<BlockContent>, String> {
        let docs = self
            .documents
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        let doc = docs
            .get(doc_id)
            .ok_or_else(|| format!("Document not found: {}", doc_id))?;

        let end_clamped = end.min(doc.blocks.len());
        Ok(doc.blocks[start..end_clamped]
            .iter()
            .map(|b| BlockContent {
                id: b.id,
                markdown: b.markdown.clone(),
            })
            .collect())
    }

    // ── block writes ──────────────────────────────────────────────────────────

    /// Apply individual block updates (no block count change).
    ///
    /// Used when the user edits within blocks without causing splits or merges.
    pub fn update_blocks(
        &self,
        doc_id: &str,
        updates: Vec<BlockUpdate>,
    ) -> Result<(), String> {
        let mut docs = self
            .documents
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        let doc = docs
            .get_mut(doc_id)
            .ok_or_else(|| format!("Document not found: {}", doc_id))?;

        for upd in updates {
            if let Some(block) = doc.blocks.get_mut(upd.id) {
                block.markdown = upd.markdown.clone();
                block.line_count = block.markdown.lines().count() as u32;
                block.content_hash = fnv1a_hash(&block.markdown);
                doc.dirty = true;
            } else {
                warn!(
                    "[WARN] [blockstore] Block {} not found in {}",
                    upd.id, doc_id
                );
            }
        }

        Ok(())
    }

    /// Replace blocks `[start_block, end_block)` with a re-scan of
    /// `window_markdown`. Handles block splits and merges automatically.
    ///
    /// Returns updated metadata for the whole document so the frontend can
    /// recalibrate the synthetic scrollbar.
    pub fn update_visible_window(
        &self,
        doc_id: &str,
        start_block: usize,
        end_block: usize,
        window_markdown: &str,
    ) -> Result<WindowUpdateResult, String> {
        let mut docs = self
            .documents
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        let doc = docs
            .get_mut(doc_id)
            .ok_or_else(|| format!("Document not found: {}", doc_id))?;

        // Re-scan the visible window content into blocks
        let mut new_blocks = scan(window_markdown);

        // Re-index IDs starting from start_block
        for (i, b) in new_blocks.iter_mut().enumerate() {
            b.id = start_block + i;
        }

        // Splice into the document block array
        let end_clamped = end_block.min(doc.blocks.len());
        doc.blocks.splice(start_block..end_clamped, new_blocks);

        // Re-index all blocks after the splice point to keep IDs contiguous
        for (i, b) in doc.blocks.iter_mut().enumerate() {
            b.id = i;
        }

        doc.dirty = true;

        let new_total_blocks = doc.blocks.len();
        let block_metas: Vec<BlockMeta> = doc.blocks.iter().map(BlockMeta::from_block).collect();

        info!(
            "[INFO] [blockstore] Window updated for '{}': {} total blocks",
            doc_id, new_total_blocks
        );

        Ok(WindowUpdateResult {
            new_total_blocks,
            blocks: block_metas,
        })
    }

    /// Refine the estimated render height for a single block from a DOM measurement.

    // ── save ──────────────────────────────────────────────────────────────────

    /// Reassemble all blocks and write the full file to disk.
    ///
    /// Records the write with `write_tracker` first so the file watcher
    /// ignores the resulting filesystem event.
    pub fn save_document(&self, doc_id: &str) -> Result<(), String> {
        // Clone the content and path while holding the lock, then release it
        // before doing I/O so other handlers aren't blocked.
        let (path, content, is_dirty) = {
            let docs = self
                .documents
                .lock()
                .map_err(|e| format!("Lock error: {}", e))?;

            let doc = docs
                .get(doc_id)
                .ok_or_else(|| format!("Document not found: {}", doc_id))?;

            (doc.path.clone(), reassemble(&doc.blocks), doc.dirty)
        };

        if !is_dirty {
            info!(
                "[INFO] [blockstore] Document '{}' not dirty, skipping save",
                doc_id
            );
            return Ok(());
        }

        info!(
            "[INFO] [blockstore] Saving '{}' ({} bytes)",
            path,
            content.len()
        );

        // Notify write tracker BEFORE writing (watcher must see this first)
        crate::write_tracker::record_write(&path);

        // Ensure parent directory exists
        if let Some(parent) = std::path::Path::new(&path).parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent dir: {}", e))?;
        }

        std::fs::write(&path, &content)
            .map_err(|e| format!("Failed to write '{}': {}", path, e))?;

        // Mark clean
        if let Ok(mut docs) = self.documents.lock() {
            if let Some(doc) = docs.get_mut(doc_id) {
                doc.dirty = false;
            }
        }

        info!("[INFO] [blockstore] Saved: {}", path);
        Ok(())
    }

    // ── search ────────────────────────────────────────────────────────────────

    /// Case-insensitive substring search across all blocks.
    pub fn search_blocks(
        &self,
        doc_id: &str,
        query: &str,
    ) -> Result<Vec<BlockSearchMatch>, String> {
        let docs = self
            .documents
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;

        let doc = docs
            .get(doc_id)
            .ok_or_else(|| format!("Document not found: {}", doc_id))?;

        let query_lower = query.to_lowercase();
        let mut matches = Vec::new();

        for block in &doc.blocks {
            let content_lower = block.markdown.to_lowercase();
            if let Some(pos) = content_lower.find(&query_lower) {
                let match_text = block
                    .markdown
                    .get(pos..pos + query.len())
                    .unwrap_or(query)
                    .to_string();

                matches.push(BlockSearchMatch {
                    block_id: block.id,
                    start_line: block.start_line,
                    match_text,
                });
            }
        }

        Ok(matches)
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/// Normalise a filesystem path to a stable document ID.
fn normalize_doc_id(path: &str) -> String {
    path.replace('\\', "/")
}
