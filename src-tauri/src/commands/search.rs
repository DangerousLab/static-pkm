//! Search IPC commands

use crate::models::SearchResult;
use tracing::info;

// TODO: Import db module when implementing FTS5 search
// use crate::db;

/// Search content using FTS5
#[tauri::command]
pub async fn search_content(query: String) -> Result<Vec<SearchResult>, String> {
    info!("[INFO] [search] Searching for: {}", query);

    // TODO: Implement FTS5 search when database is fully set up
    // For now, return empty results
    Ok(Vec::new())
}

/// Index a single content file
#[tauri::command]
pub async fn index_content(path: String) -> Result<(), String> {
    info!("[INFO] [search] Indexing: {}", path);

    // TODO: Parse file and add to SQLite index
    Ok(())
}

/// Rebuild the entire search index
#[tauri::command]
pub async fn rebuild_index() -> Result<(), String> {
    info!("[INFO] [search] Rebuilding index");

    // TODO: Scan all files and rebuild index
    Ok(())
}
