//! Utility functions for Unstablon PKM

use std::path::Path;

/// Extract module ID from file path
/// Preserves original casing, replaces spaces and hyphens with underscores
/// e.g., "Home/Tools/calcA.js" -> "calcA"
pub fn path_to_id(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .replace([' ', '-'], "_")
}

/// Extract title from file name
/// e.g., "calcA.js" -> "CalcA"
pub fn path_to_title(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

/// Check if path is a JavaScript module
pub fn is_module_file(path: &str) -> bool {
    path.ends_with(".js") && !path.ends_with(".min.js")
}

/// Check if path is an HTML page
pub fn is_page_file(path: &str) -> bool {
    path.ends_with(".html") || path.ends_with(".htm")
}

/// Check if path is a document
pub fn is_document_file(path: &str) -> bool {
    path.ends_with(".md") || path.ends_with(".txt")
}

/// Normalize path separators to forward slashes
pub fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_to_id() {
        assert_eq!(path_to_id("Home/Tools/calcA.js"), "calca");
        assert_eq!(path_to_id("test-module.js"), "test_module");
    }

    #[test]
    fn test_path_to_title() {
        assert_eq!(path_to_title("Home/Tools/calcA.js"), "calcA");
    }

    #[test]
    fn test_is_module_file() {
        assert!(is_module_file("test.js"));
        assert!(!is_module_file("test.min.js"));
        assert!(!is_module_file("test.ts"));
    }
}
