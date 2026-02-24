//! Utility functions for Unstablon PKM

use std::path::Path;

/// Extract module ID from file path
/// Returns full filename WITH extension (matches OS behavior, eliminates collisions)
/// e.g., "Home/Tools/calcA.js" -> "calcA.js"
pub fn path_to_id(path: &str) -> String {
    Path::new(path)
        .file_name()  // Full filename WITH extension
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string()  // No character replacement
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

/// Extract title from file content
/// Priority:
/// 1) YAML frontmatter `title:` field (markdown)
/// 2) First `#` heading (markdown)
/// 3) First `<h1>` tag content (HTML/JavaScript)
/// 4) None (falls back to filename)
pub fn extract_title_from_content(content: &str) -> Option<String> {
    let mut in_frontmatter = false;
    let mut frontmatter_started = false;

    for line in content.lines() {
        let trimmed = line.trim();

        // Track YAML frontmatter bounds (---)
        if trimmed == "---" {
            if !frontmatter_started {
                frontmatter_started = true;
                in_frontmatter = true;
                continue;
            } else {
                in_frontmatter = false;
                continue;
            }
        }

        // YAML frontmatter title field
        if in_frontmatter && trimmed.starts_with("title:") {
            let value = trimmed[6..].trim().trim_matches(['\'', '"']);
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }

        // Markdown h1 heading (only outside frontmatter)
        if !in_frontmatter && trimmed.starts_with("# ") {
            let title = trimmed[2..].trim();
            if !title.is_empty() {
                return Some(title.to_string());
            }
        }

        // HTML <h1> tag - extract content between <h1> and </h1>
        if let Some(start) = trimmed.find("<h1") {
            // Find the closing > of the opening tag
            if let Some(tag_end) = trimmed[start..].find('>') {
                let after_tag = &trimmed[start + tag_end + 1..];
                // Find the closing </h1>
                if let Some(end) = after_tag.find("</h1>") {
                    let title = after_tag[..end].trim();
                    if !title.is_empty() {
                        return Some(title.to_string());
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_to_id() {
        assert_eq!(path_to_id("Home/Tools/calcA.js"), "calcA.js");
        assert_eq!(path_to_id("test-module.js"), "test-module.js");
        assert_eq!(path_to_id("test-markdown.md"), "test-markdown.md");
        assert_eq!(path_to_id("test_markdown.md"), "test_markdown.md");
    }

    #[test]
    fn test_path_to_title() {
        assert_eq!(path_to_title("Home/Tools/calcA.js"), "calcA");
        assert_eq!(path_to_title("test-markdown.md"), "test-markdown");
    }

    #[test]
    fn test_is_module_file() {
        assert!(is_module_file("test.js"));
        assert!(!is_module_file("test.min.js"));
        assert!(!is_module_file("test.ts"));
    }
}
