//! Unstablon PKM - Native Backend
//!
//! Rust backend for the Unstablon Personal Knowledge Management application.
//! Provides file operations, SQLite indexing, and IPC commands.

mod commands;
mod db;
mod error;
mod indexer;
mod models;
mod utils;
mod watcher;
mod write_tracker;

use std::sync::Arc;
use tauri::{Emitter, Manager, WindowEvent};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use db::DbState;

/// Initialize and run the Tauri application
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "unstablon_pkm=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("[INFO] [lib] Starting Unstablon PKM");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            info!("[INFO] [lib] Application setup starting");

            // Initialize database synchronously during setup
            let app_handle = app.handle().clone();

            // Get app data directory
            let app_data_dir = app_handle.path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            // Create directory if it doesn't exist
            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data dir");

            let db_path = app_data_dir.join("unstablon.db");
            info!("[INFO] [lib] Database path: {:?}", db_path);

            // Open connection and create schema
            let conn = rusqlite::Connection::open(&db_path)
                .expect("Failed to open database");

            // Create schema
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
            ).expect("Failed to create content table");

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
            ).expect("Failed to create links table");

            conn.execute(
                "CREATE TABLE IF NOT EXISTS tags (
                    id INTEGER PRIMARY KEY,
                    content_id TEXT NOT NULL,
                    tag TEXT NOT NULL,
                    FOREIGN KEY (content_id) REFERENCES content(id)
                )",
                [],
            ).expect("Failed to create tags table");

            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_content_path ON content(path)",
                [],
            ).ok();

            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id)",
                [],
            ).ok();

            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_path)",
                [],
            ).ok();

            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_tags_content ON tags(content_id)",
                [],
            ).ok();

            conn.execute(
                "CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
                    title,
                    body,
                    content='content',
                    content_rowid='rowid'
                )",
                [],
            ).expect("Failed to create FTS table");

            // Create database wrapper and manage state
            let database = Arc::new(db::Database::from_connection(conn));
            app.manage(DbState(database));

            info!("[INFO] [lib] Application setup complete");

            // Intercept OS window close button to allow frontend to handle unsaved changes
            let main_window = app.get_webview_window("main")
                .expect("Failed to get main window");
            let app_handle = app.handle().clone();
            main_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // Prevent default close so frontend can show unsaved-changes modal
                    api.prevent_close();
                    // Notify frontend to decide whether to show confirmation or close directly
                    app_handle
                        .get_webview_window("main")
                        .map(|w| w.emit("close-requested", ()));
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fileops::read_file,
            commands::fileops::write_file,
            commands::fileops::list_directory,
            commands::fileops::get_navigation_tree,
            commands::fileops::get_file_mtime,
            commands::fileops::start_watching_vault,
            commands::search::search_content,
            commands::search::index_content,
            commands::search::rebuild_index,
            force_close_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Force-close the main window after the frontend has handled unsaved-changes logic.
#[tauri::command]
async fn force_close_window(window: tauri::WebviewWindow) -> Result<(), String> {
    info!("[INFO] [lib] Force closing window");
    window.destroy().map_err(|e| e.to_string())
}
