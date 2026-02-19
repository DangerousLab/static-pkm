//! Data models for Unstablon PKM

use serde::{Deserialize, Serialize};

/// File entry returned by list_directory
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub is_file: bool,
    pub modified_at: Option<u64>,
}

/// Navigation node types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum NavigationNode {
    #[serde(rename = "folder")]
    Folder(FolderNode),
    #[serde(rename = "module")]
    Module(ModuleNode),
    #[serde(rename = "page")]
    Page(PageNode),
    #[serde(rename = "document")]
    Document(DocumentNode),
}

/// Folder node containing children
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderNode {
    #[serde(rename = "type")]
    pub node_type: String,
    pub name: String,
    pub path: String,
    pub children: Vec<NavigationNode>,
}

/// Module node (JavaScript file)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleNode {
    pub id: String,
    pub name: String,
    pub path: String,
    pub title: String,
    pub file: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// Page node (HTML file)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageNode {
    pub id: String,
    pub name: String,
    pub path: String,
    pub title: String,
    pub file: String,
}

/// Document node (Markdown/text file)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentNode {
    pub id: String,
    pub name: String,
    pub path: String,
    pub title: String,
    pub file: String,
}

/// Search result from FTS5 query
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub path: String,
    #[serde(rename = "type")]
    pub content_type: String,
    pub score: f64,
    pub snippet: Option<String>,
}

/// Content index entry for SQLite
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentIndexEntry {
    pub id: String,
    pub path: String,
    pub title: String,
    #[serde(rename = "type")]
    pub content_type: String,
    pub body: Option<String>,
    pub modified_at: u64,
    pub indexed_at: u64,
}
