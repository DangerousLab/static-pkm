//! Block store IPC commands for the Persistent Window Architecture.
//!
//! All commands take `State<'_, DocumentStore>` and delegate to the
//! [`DocumentStore`] methods. Return types are serialised as JSON over IPC.

use tauri::State;
use tracing::info;

use crate::blockstore::{
    BlockContent, BlockSearchMatch, BlockUpdate, DocumentHandle, DocumentStore,
    WindowUpdateResult,
};

/// Open a document: read from disk, scan into blocks, cache in memory.
///
/// Returns full block metadata (no content) so the frontend can initialise
/// the synthetic scrollbar and ViewportCoordinator.
#[tauri::command]
pub async fn open_document(
    path: String,
    store: State<'_, DocumentStore>,
) -> Result<DocumentHandle, String> {
    info!("[INFO] [blockstore_cmd] open_document: {}", path);
    store.open_document(&path)
}

/// Return markdown content for blocks `[start, end)`.
#[tauri::command]
pub async fn get_blocks(
    doc_id: String,
    start: usize,
    end: usize,
    store: State<'_, DocumentStore>,
) -> Result<Vec<BlockContent>, String> {
    info!(
        "[INFO] [blockstore_cmd] get_blocks: {} [{}, {})",
        doc_id, start, end
    );
    store.get_blocks(&doc_id, start, end)
}

/// Apply individual block updates (content-only, no count change).
#[tauri::command]
pub async fn update_blocks(
    doc_id: String,
    updates: Vec<BlockUpdate>,
    store: State<'_, DocumentStore>,
) -> Result<(), String> {
    info!(
        "[INFO] [blockstore_cmd] update_blocks: {} ({} updates)",
        doc_id,
        updates.len()
    );
    store.update_blocks(&doc_id, updates)
}

/// Replace the visible block range with a re-scan of `window_markdown`.
///
/// Handles block splits (user added blank line) and merges (user deleted
/// blank line) by splicing the in-memory block array.
///
/// Returns updated full block metadata so the frontend can recalibrate the
/// synthetic scrollbar.
#[tauri::command]
pub async fn update_visible_window(
    doc_id: String,
    start_block: usize,
    end_block: usize,
    window_markdown: String,
    store: State<'_, DocumentStore>,
) -> Result<WindowUpdateResult, String> {
    info!(
        "[INFO] [blockstore_cmd] update_visible_window: {} [{}, {})",
        doc_id, start_block, end_block
    );
    store.update_visible_window(&doc_id, start_block, end_block, &window_markdown)
}

/// Reassemble all blocks and write the document to disk.
#[tauri::command]
pub async fn save_document(
    doc_id: String,
    store: State<'_, DocumentStore>,
) -> Result<(), String> {
    info!("[INFO] [blockstore_cmd] save_document: {}", doc_id);
    store.save_document(&doc_id)
}

/// Remove a document from the in-memory store (called on document close or
/// mode switch to source view).
#[tauri::command]
pub async fn close_document(
    doc_id: String,
    store: State<'_, DocumentStore>,
) -> Result<(), String> {
    info!("[INFO] [blockstore_cmd] close_document: {}", doc_id);
    store.close_document(&doc_id)
}

/// Case-insensitive search across all blocks in a document.
#[tauri::command]
pub async fn search_blocks(
    doc_id: String,
    query: String,
    store: State<'_, DocumentStore>,
) -> Result<Vec<BlockSearchMatch>, String> {
    info!(
        "[INFO] [blockstore_cmd] search_blocks: {} query='{}'",
        doc_id, query
    );
    store.search_blocks(&doc_id, &query)
}
