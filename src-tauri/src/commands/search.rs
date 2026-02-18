//! Search IPC commands

use tauri::State;
use tracing::info;

use crate::db::DbState;
use crate::models::SearchResult;
use crate::indexer;

/// Search content using FTS5
#[tauri::command]
pub async fn search_content(
    query: String,
    db: State<'_, DbState>,
) -> Result<Vec<SearchResult>, String> {
    info!("[INFO] [search] Searching for: {}", query);

    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    // Escape special FTS5 characters and create query
    let fts_query = format!("{}*", escape_fts_query(&query));

    db.0.search(&fts_query, 20)
}

/// Index a single content file
#[tauri::command]
pub async fn index_content(
    path: String,
    db: State<'_, DbState>,
) -> Result<(), String> {
    info!("[INFO] [search] Indexing: {}", path);

    indexer::index_file(&db.0, &path).await
}

/// Rebuild the entire search index
#[tauri::command]
pub async fn rebuild_index(
    home_path: String,
    db: State<'_, DbState>,
) -> Result<u32, String> {
    info!("[INFO] [search] Rebuilding index from: {}", home_path);

    indexer::rebuild_index(&db.0, &home_path).await
}

/// Escape special FTS5 query characters
fn escape_fts_query(query: &str) -> String {
    query
        .replace('"', "\"\"")
        .replace('*', "")
        .replace(':', " ")
        .replace('(', " ")
        .replace(')', " ")
        .replace('[', " ")
        .replace(']', " ")
        .trim()
        .to_string()
}
