//! Unstablon PKM - Native Backend
//!
//! Rust backend for the Unstablon Personal Knowledge Management application.
//! Provides file operations, SQLite indexing, and IPC commands.

mod commands;
mod db;
mod error;
mod models;
mod utils;

use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

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
        .invoke_handler(tauri::generate_handler![
            commands::fileops::read_file,
            commands::fileops::write_file,
            commands::fileops::list_directory,
            commands::fileops::get_navigation_tree,
            commands::search::search_content,
            commands::search::index_content,
            commands::search::rebuild_index,
        ])
        .setup(|app| {
            info!("[INFO] [lib] Application setup complete");

            // Initialize database
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::init_database(&app_handle).await {
                    tracing::error!("[ERROR] [lib] Failed to initialize database: {}", e);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
