//! Database module for SQLite operations

use rusqlite::{Connection, Result as SqliteResult, params};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use tracing::{info, error};

use crate::models::{ContentIndexEntry, SearchResult};

/// Database connection wrapper
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Create a new database connection from path
    pub fn new(path: &PathBuf) -> Result<Self, String> {
        let conn = Connection::open(path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Create from an existing connection
    pub fn from_connection(conn: Connection) -> Self {
        Self {
            conn: Mutex::new(conn),
        }
    }

    /// Execute a query that modifies data
    pub fn execute<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
    {
        let conn = self.conn.lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        f(&conn).map_err(|e| format!("Database error: {}", e))
    }

    /// Index a content entry
    pub fn index_content(&self, entry: &ContentIndexEntry) -> Result<(), String> {
        self.execute(|conn| {
            // Insert or replace content
            conn.execute(
                "INSERT OR REPLACE INTO content (id, path, title, type, body, modified_at, indexed_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    entry.id,
                    entry.path,
                    entry.title,
                    entry.content_type,
                    entry.body,
                    entry.modified_at,
                    entry.indexed_at,
                ],
            )?;

            // Update FTS index
            conn.execute(
                "INSERT OR REPLACE INTO content_fts (rowid, title, body)
                 SELECT rowid, title, body FROM content WHERE id = ?1",
                params![entry.id],
            )?;

            Ok(())
        })
    }

    /// Search content using FTS5
    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
        self.execute(|conn| {
            let mut stmt = conn.prepare(
                "SELECT c.id, c.title, c.path, c.type,
                        bm25(content_fts) as score,
                        snippet(content_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
                 FROM content_fts
                 JOIN content c ON content_fts.rowid = c.rowid
                 WHERE content_fts MATCH ?1
                 ORDER BY bm25(content_fts)
                 LIMIT ?2"
            )?;

            let results = stmt.query_map(params![query, limit as i64], |row| {
                Ok(SearchResult {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    path: row.get(2)?,
                    content_type: row.get(3)?,
                    score: row.get::<_, f64>(4)?.abs(), // bm25 returns negative scores
                    snippet: row.get(5)?,
                })
            })?;

            results.collect::<Result<Vec<_>, _>>()
        })
    }

    /// Clear all indexed content
    pub fn clear_index(&self) -> Result<(), String> {
        self.execute(|conn| {
            conn.execute("DELETE FROM content_fts", [])?;
            conn.execute("DELETE FROM tags", [])?;
            conn.execute("DELETE FROM links", [])?;
            conn.execute("DELETE FROM content", [])?;
            Ok(())
        })
    }

    /// Get all indexed content IDs
    pub fn get_indexed_ids(&self) -> Result<Vec<String>, String> {
        self.execute(|conn| {
            let mut stmt = conn.prepare("SELECT id FROM content")?;
            let ids = stmt.query_map([], |row| row.get(0))?;
            ids.collect::<Result<Vec<_>, _>>()
        })
    }
}

/// Global database state
pub struct DbState(pub Arc<Database>);

/// Initialize the SQLite database
pub async fn init_database(app: &AppHandle) -> Result<Arc<Database>, String> {
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

    // Create database wrapper
    let db = Arc::new(Database {
        conn: Mutex::new(conn),
    });

    info!("[INFO] [db] Database initialized successfully");
    Ok(db)
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
