//! Database module for SQLite operations

use rusqlite::{Connection, Result as SqliteResult};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tracing::info;

/// Database state for Tauri
pub struct Database {
    pub conn: Mutex<Connection>,
}

/// Initialize the SQLite database
pub async fn init_database(app: &AppHandle) -> Result<(), String> {
    info!("[INFO] [db] Initializing database");

    // Get app data directory
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let db_path = app_data_dir.join("unstablon.db");
    info!("[INFO] [db] Database path: {:?}", db_path);

    // Open connection
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Create schema
    create_schema(&conn)
        .map_err(|e| format!("Failed to create schema: {}", e))?;

    info!("[INFO] [db] Database initialized successfully");
    Ok(())
}

/// Create database schema
fn create_schema(conn: &Connection) -> SqliteResult<()> {
    // Content table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS content (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL UNIQUE,
            title TEXT,
            type TEXT NOT NULL,
            body TEXT,
            modified_at INTEGER,
            indexed_at INTEGER
        )",
        [],
    )?;

    // Links table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY,
            source_id TEXT NOT NULL,
            target_id TEXT,
            target_path TEXT NOT NULL,
            link_type TEXT,
            FOREIGN KEY (source_id) REFERENCES content(id)
        )",
        [],
    )?;

    // Tags table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY,
            content_id TEXT NOT NULL,
            tag TEXT NOT NULL,
            FOREIGN KEY (content_id) REFERENCES content(id)
        )",
        [],
    )?;

    // Create indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_content_path ON content(path)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_path)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_tags_content ON tags(content_id)",
        [],
    )?;

    // Full-text search virtual table
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
            title,
            body,
            content='content',
            content_rowid='rowid'
        )",
        [],
    )?;

    info!("[INFO] [db] Schema created successfully");
    Ok(())
}
