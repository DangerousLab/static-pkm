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

    /// Execute a query that requires a mutable connection (e.g. transactions)
    pub fn execute_mut<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&mut Connection) -> Result<T, rusqlite::Error>,
    {
        let mut conn = self.conn.lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        f(&mut conn).map_err(|e| format!("Database error: {}", e))
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
pub fn create_schema(conn: &Connection) -> SqliteResult<()> {
    // 1. Content table
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

    // 2. Node Manifest table (Phase 2 Layout Oracle)
    // We use a specific expected SQL definition to verify the schema on disk.
    let node_manifest_sql = "CREATE TABLE node_manifest (
            note_id       TEXT NOT NULL,
            node_id       TEXT NOT NULL,
            node_type     TEXT NOT NULL,
            text_content  TEXT NOT NULL DEFAULT '',
            level         INTEGER,
            line_count    INTEGER,
            row_count     INTEGER,
            col_count     INTEGER,
            img_width     INTEGER,
            img_height    INTEGER,
            font_override TEXT,
            position      INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (note_id, node_id)
        )";
    
    validate_or_recreate_table(conn, "node_manifest", node_manifest_sql)?;

    // 3. Height Cache table (Phase 2 Layout Oracle)
    let height_cache_sql = "CREATE TABLE height_cache (
            note_id   TEXT NOT NULL,
            node_id   TEXT NOT NULL,
            height    REAL NOT NULL,
            source    TEXT NOT NULL DEFAULT 'estimated',
            timestamp INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (note_id, node_id)
        )";

    validate_or_recreate_table(conn, "height_cache", height_cache_sql)?;

    // 4. Links table
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

    // 5. Tags table
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
    conn.execute("CREATE INDEX IF NOT EXISTS idx_content_path ON content(path)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_node_manifest_note ON node_manifest(note_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_path)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tags_content ON tags(content_id)", [])?;

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

    info!("[INFO] [db] Schema initialized/verified successfully");
    Ok(())
}

/// Aggressively validates a table's schema by comparing its actual CREATE SQL 
/// against the expected definition. If they differ significantly (e.g. missing 
/// PRIMARY KEY columns), the table is dropped and recreated.
fn validate_or_recreate_table(
    conn: &Connection,
    table_name: &str,
    expected_sql: &str,
) -> SqliteResult<()> {
    let actual_sql: Option<String> = {
        let mut stmt = conn.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?1")?;
        let mut rows = stmt.query(params![table_name])?;
        rows.next()?.map(|row| row.get(0)).transpose()?
    }; // Statement and rows are dropped here, releasing the lock

    if let Some(actual_sql) = actual_sql {
        info!("[DEBUG] [db] Schema Check [{}]: actual='{}'", table_name, actual_sql.replace('\n', " "));

        // Normalized comparison: remove whitespace/newlines/case for robustness
        let normalize = |s: &str| s.replace('\n', " ").replace('\r', "").split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase();
        
        let n_actual = normalize(&actual_sql);
        let n_expected = normalize(expected_sql);

        if n_actual != n_expected {
            // Check for specific deal-breakers
            let has_composite_pk = n_actual.contains("primary key (note_id, node_id)") || n_actual.contains("primary key(note_id,node_id)");
            let has_timestamp = n_actual.contains("timestamp");
            let has_note_id = n_actual.contains("note_id");
            
            if !has_composite_pk || !has_timestamp || !has_note_id {
                info!("[INFO] [db] Table {} schema mismatch or missing constraints. DROPPING and recreating.", table_name);
                conn.execute(&format!("DROP TABLE IF EXISTS {}", table_name), [])?;
                conn.execute(expected_sql, [])?;
            } else {
                info!("[INFO] [db] Table {} schema differs but core constraints (PK, columns) are healthy.", table_name);
            }
        }
    } else {
        // Table doesn't exist at all
        info!("[INFO] [db] Creating new table {}", table_name);
        conn.execute(expected_sql, [])?;
    }

    Ok(())
}

/// Helper to check if a column exists and add it if not.
/// Since SQLite does not support IF NOT EXISTS in ALTER TABLE, we must check PRAGMA.
fn ensure_column_exists(
    conn: &Connection,
    table: &str,
    column: &str,
    type_def: &str,
) -> SqliteResult<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let columns = stmt.query_map([], |row| {
        let name: String = row.get(1)?;
        Ok(name)
    })?;

    let mut found = false;
    for col in columns {
        if col?.to_lowercase() == column.to_lowercase() {
            found = true;
            break;
        }
    }

    if !found {
        info!("[INFO] [db] Migrating {}: adding column {}", table, column);
        let sql = format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, type_def);
        conn.execute(&sql, [])?;
    }

    Ok(())
}
