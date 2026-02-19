//! File operation IPC commands

use crate::error::AppError;
use crate::models::{FileEntry, FolderNode, ModuleNode, NavigationNode, PageNode, DocumentNode};
use crate::utils;
use std::fs;
use std::path::Path;
use std::time::SystemTime;
use tracing::info;

/// Read file contents
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    info!("[INFO] [fileops] Reading file: {}", path);

    fs::read_to_string(&path)
        .map_err(|e| AppError::Io(e).to_string())
}

/// Write content to file
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    info!("[INFO] [fileops] Writing file: {}", path);

    // Ensure parent directory exists
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Io(e).to_string())?;
    }

    fs::write(&path, content)
        .map_err(|e| AppError::Io(e).to_string())
}

/// List directory contents
#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    info!("[INFO] [fileops] Listing directory: {}", path);

    let entries = fs::read_dir(&path)
        .map_err(|e| AppError::Io(e).to_string())?;

    let mut result = Vec::new();

    for entry in entries.flatten() {
        let metadata = entry.metadata().ok();
        let modified_at = metadata
            .as_ref()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let is_file = metadata.as_ref().map(|m| m.is_file()).unwrap_or(false);

        result.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: utils::normalize_path(&entry.path().to_string_lossy()),
            is_directory: is_dir,
            is_file,
            modified_at,
        });
    }

    // Sort: directories first, then by name
    result.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(result)
}

/// Get navigation tree from Home directory
#[tauri::command]
pub async fn get_navigation_tree(home_path: String) -> Result<FolderNode, String> {
    info!("[INFO] [fileops] Building navigation tree from: {}", home_path);

    let normalized_root = utils::normalize_path(&home_path);
    build_folder_node(&home_path, "Home", &normalized_root)
        .map_err(|e| e.to_string())
}

/// Recursively build a folder node from filesystem
/// vault_root is used to compute relative paths
fn build_folder_node(path: &str, name: &str, vault_root: &str) -> Result<FolderNode, AppError> {
    let entries = fs::read_dir(path)?;
    let mut children = Vec::new();

    for entry in entries.flatten() {
        let entry_path = entry.path();
        let entry_name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and special directories
        if entry_name.starts_with('.') || entry_name.starts_with('_') {
            continue;
        }

        let normalized_path = utils::normalize_path(&entry_path.to_string_lossy());

        // Compute relative path from vault root
        let relative_path = if normalized_path.starts_with(vault_root) {
            normalized_path[vault_root.len()..].trim_start_matches('/').to_string()
        } else {
            normalized_path.clone()
        };

        if entry_path.is_dir() {
            // Recurse into subdirectory
            match build_folder_node(&entry_path.to_string_lossy(), &entry_name, vault_root) {
                Ok(folder) => children.push(NavigationNode::Folder(folder)),
                Err(e) => tracing::warn!("[WARN] [fileops] Skipping directory {}: {}", entry_name, e),
            }
        } else if entry_path.is_file() {
            let file_path_str = normalized_path.clone();

            if utils::is_module_file(&file_path_str) {
                let title = if let Ok(content) = fs::read_to_string(&entry_path) {
                    utils::extract_title_from_content(&content)
                        .unwrap_or_else(|| utils::path_to_title(&file_path_str))
                } else {
                    utils::path_to_title(&file_path_str)
                };

                children.push(NavigationNode::Module(ModuleNode {
                    id: utils::path_to_id(&file_path_str),
                    name: entry_name.clone(),
                    path: relative_path.clone(),
                    title,
                    file: relative_path,
                    tags: Vec::new(),
                }));
            } else if utils::is_page_file(&file_path_str) {
                let title = if let Ok(content) = fs::read_to_string(&entry_path) {
                    utils::extract_title_from_content(&content)
                        .unwrap_or_else(|| utils::path_to_title(&file_path_str))
                } else {
                    utils::path_to_title(&file_path_str)
                };

                children.push(NavigationNode::Page(PageNode {
                    id: utils::path_to_id(&file_path_str),
                    name: entry_name.clone(),
                    path: relative_path.clone(),
                    title,
                    file: relative_path,
                }));
            } else if utils::is_document_file(&file_path_str) {
                let title = if let Ok(content) = fs::read_to_string(&entry_path) {
                    utils::extract_title_from_content(&content)
                        .unwrap_or_else(|| utils::path_to_title(&file_path_str))
                } else {
                    utils::path_to_title(&file_path_str)
                };

                children.push(NavigationNode::Document(DocumentNode {
                    id: utils::path_to_id(&file_path_str),
                    name: entry_name.clone(),
                    path: relative_path.clone(),
                    title,
                    file: relative_path,
                }));
            }
        }
    }

    // Sort children: folders first, then by name
    children.sort_by(|a, b| {
        let a_is_folder = matches!(a, NavigationNode::Folder(_));
        let b_is_folder = matches!(b, NavigationNode::Folder(_));

        match (a_is_folder, b_is_folder) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => {
                let a_name = match a {
                    NavigationNode::Folder(f) => &f.name,
                    NavigationNode::Module(m) => &m.name,
                    NavigationNode::Page(p) => &p.name,
                    NavigationNode::Document(d) => &d.name,
                };
                let b_name = match b {
                    NavigationNode::Folder(f) => &f.name,
                    NavigationNode::Module(m) => &m.name,
                    NavigationNode::Page(p) => &p.name,
                    NavigationNode::Document(d) => &d.name,
                };
                a_name.to_lowercase().cmp(&b_name.to_lowercase())
            }
        }
    });

    // Compute relative path for this folder
    let normalized_path = utils::normalize_path(path);
    let relative_path = if normalized_path.starts_with(vault_root) {
        normalized_path[vault_root.len()..].trim_start_matches('/').to_string()
    } else {
        normalized_path.clone()
    };

    Ok(FolderNode {
        node_type: "folder".to_string(),
        name: name.to_string(),
        path: if relative_path.is_empty() { "Home".to_string() } else { relative_path },
        children,
    })
}
