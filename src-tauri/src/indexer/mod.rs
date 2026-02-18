//! Content indexer for search functionality

use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{info, warn, error};

use crate::db::Database;
use crate::models::ContentIndexEntry;
use crate::utils;

/// Index a single file
pub async fn index_file(db: &Database, path: &str) -> Result<(), String> {
    let path_obj = Path::new(path);

    if !path_obj.exists() {
        return Err(format!("File not found: {}", path));
    }

    if !path_obj.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    let entry = parse_file(path)?;
    db.index_content(&entry)?;

    info!("[INFO] [indexer] Indexed: {}", path);
    Ok(())
}

/// Rebuild the entire search index from a directory
pub async fn rebuild_index(db: &Database, home_path: &str) -> Result<u32, String> {
    info!("[INFO] [indexer] Starting full index rebuild from: {}", home_path);

    // Clear existing index
    db.clear_index()?;

    // Recursively index all files
    let count = index_directory(db, home_path)?;

    info!("[INFO] [indexer] Index rebuild complete: {} files indexed", count);
    Ok(count)
}

/// Recursively index a directory
fn index_directory(db: &Database, dir_path: &str) -> Result<u32, String> {
    let mut count = 0u32;

    let entries = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory {}: {}", dir_path, e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and special directories
        if name.starts_with('.') || name.starts_with('_') {
            continue;
        }

        if path.is_dir() {
            // Recurse into subdirectory
            match index_directory(db, &path.to_string_lossy()) {
                Ok(sub_count) => count += sub_count,
                Err(e) => warn!("[WARN] [indexer] Failed to index directory {:?}: {}", path, e),
            }
        } else if path.is_file() {
            let path_str = utils::normalize_path(&path.to_string_lossy());

            // Only index supported file types
            if utils::is_module_file(&path_str) ||
               utils::is_page_file(&path_str) ||
               utils::is_document_file(&path_str) {
                match parse_file(&path_str) {
                    Ok(entry) => {
                        if let Err(e) = db.index_content(&entry) {
                            warn!("[WARN] [indexer] Failed to index {}: {}", path_str, e);
                        } else {
                            count += 1;
                        }
                    }
                    Err(e) => warn!("[WARN] [indexer] Failed to parse {}: {}", path_str, e),
                }
            }
        }
    }

    Ok(count)
}

/// Parse a file and create an index entry
fn parse_file(path: &str) -> Result<ContentIndexEntry, String> {
    let path_obj = Path::new(path);

    // Get file metadata
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to get metadata: {}", e))?;

    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let indexed_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // Read file content
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Determine content type
    let content_type = if utils::is_module_file(path) {
        "module"
    } else if utils::is_page_file(path) {
        "page"
    } else {
        "document"
    };

    // Extract title and body based on content type
    let (title, body) = extract_content(path, &content, content_type)?;

    let id = utils::path_to_id(path);

    Ok(ContentIndexEntry {
        id,
        path: utils::normalize_path(path),
        title,
        content_type: content_type.to_string(),
        body: Some(body),
        modified_at,
        indexed_at,
    })
}

/// Extract title and body from file content
fn extract_content(path: &str, content: &str, content_type: &str) -> Result<(String, String), String> {
    match content_type {
        "module" => extract_module_content(path, content),
        "page" => extract_html_content(path, content),
        "document" => extract_document_content(path, content),
        _ => Ok((utils::path_to_title(path), content.to_string())),
    }
}

/// Extract content from JavaScript module
fn extract_module_content(path: &str, content: &str) -> Result<(String, String), String> {
    let mut title = utils::path_to_title(path);

    // Try to extract displayName from moduleInfo
    if let Some(start) = content.find("displayName") {
        if let Some(quote_start) = content[start..].find(['\'', '"']) {
            let remaining = &content[start + quote_start + 1..];
            if let Some(quote_end) = remaining.find(['\'', '"']) {
                title = remaining[..quote_end].to_string();
            }
        }
    }

    // For body, extract comments and string literals as searchable content
    let body = extract_js_searchable_text(content);

    Ok((title, body))
}

/// Extract searchable text from JavaScript
fn extract_js_searchable_text(content: &str) -> String {
    let mut searchable = Vec::new();

    // Extract single-line comments
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("//") {
            searchable.push(trimmed[2..].trim().to_string());
        }
    }

    // Extract string literals (simple approach)
    let mut in_string = false;
    let mut string_char = ' ';
    let mut current_string = String::new();

    for ch in content.chars() {
        if in_string {
            if ch == string_char {
                if current_string.len() > 3 {
                    searchable.push(current_string.clone());
                }
                current_string.clear();
                in_string = false;
            } else {
                current_string.push(ch);
            }
        } else if ch == '\'' || ch == '"' {
            in_string = true;
            string_char = ch;
        }
    }

    searchable.join(" ")
}

/// Extract content from HTML page
fn extract_html_content(path: &str, content: &str) -> Result<(String, String), String> {
    let mut title = utils::path_to_title(path);

    // Try to extract title from <title> tag
    if let Some(start) = content.find("<title>") {
        if let Some(end) = content[start..].find("</title>") {
            title = content[start + 7..start + end].trim().to_string();
        }
    }

    // Strip HTML tags for body
    let body = strip_html_tags(content);

    Ok((title, body))
}

/// Strip HTML tags from content
fn strip_html_tags(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;

    for ch in html.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            in_tag = false;
            result.push(' ');
        } else if !in_tag {
            result.push(ch);
        }
    }

    // Normalize whitespace
    result.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Extract content from markdown/text document
fn extract_document_content(path: &str, content: &str) -> Result<(String, String), String> {
    let mut title = utils::path_to_title(path);

    // Try to extract title from first heading or YAML frontmatter
    let lines: Vec<&str> = content.lines().collect();

    for line in &lines {
        let trimmed = line.trim();

        // Markdown heading
        if trimmed.starts_with("# ") {
            title = trimmed[2..].trim().to_string();
            break;
        }

        // YAML frontmatter title
        if trimmed.starts_with("title:") {
            let value = trimmed[6..].trim().trim_matches(['\'', '"']);
            title = value.to_string();
            break;
        }
    }

    Ok((title, content.to_string()))
}
