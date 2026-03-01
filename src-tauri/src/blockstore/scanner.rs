//! Markdown block scanner (Phase 2 Lexical Chunker).
//!
//! Splits a markdown document into top-level blocks at blank-line
//! boundaries, acting as a strict state machine to identify gross boundaries:
//!   - YAML frontmatter  (`---` ... `---` / `...`)
//!   - Fenced code blocks (`` ``` `` or `~~~`, any length ≥ 3)
//!   - Markdown tables   (consecutive lines starting with `|`)
//!
//! Each block carries byte offsets, line numbers, and a semantic type
//! to feed the TypeScript Layout Oracle. It does NOT attempt height estimation.

use serde::{Deserialize, Serialize};

// ── Public types ───────────────────────────────────────────────────────────────

/// The semantic type of a block, used by the Layout Oracle for rendering hints.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BlockType {
    Paragraph,
    Heading1,
    Heading2,
    Heading3,
    Heading4,
    Heading5,
    Heading6,
    List,
    Blockquote,
    HorizontalRule,
    CodeFence,
    Table,
    Frontmatter,
    // Note: computeEmbed, mathBlock, etc. are resolved by TipTap on the frontend.
    // The Rust scanner treats them as Paragraphs or CodeFences initially.
}

impl BlockType {
    pub fn as_str(&self) -> &'static str {
        match self {
            BlockType::Paragraph => "paragraph",
            BlockType::Heading1 | BlockType::Heading2 | BlockType::Heading3 |
            BlockType::Heading4 | BlockType::Heading5 | BlockType::Heading6 => "heading",
            BlockType::List => "bulletList", // Simplified for Oracle chunking
            BlockType::Blockquote => "blockquote",
            BlockType::HorizontalRule => "horizontalRule",
            BlockType::CodeFence => "codeBlock",
            BlockType::Table => "table",
            BlockType::Frontmatter => "frontmatter",
        }
    }
    
    pub fn level(&self) -> Option<u8> {
        match self {
            BlockType::Heading1 => Some(1),
            BlockType::Heading2 => Some(2),
            BlockType::Heading3 => Some(3),
            BlockType::Heading4 => Some(4),
            BlockType::Heading5 => Some(5),
            BlockType::Heading6 => Some(6),
            _ => None,
        }
    }
}

/// A single content block extracted from a markdown document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    /// Zero-based sequential index within the document.
    pub id: usize,
    /// Byte offset of the first character in the source string.
    pub start_byte: usize,
    /// Byte offset one past the last character in the source string.
    pub end_byte: usize,
    /// Zero-based first line number.
    pub start_line: usize,
    /// Zero-based last line number (inclusive).
    pub end_line: usize,
    /// Block content (lines joined with `\n`, no surrounding blank lines).
    pub markdown: String,
    /// Semantic type — used for layout hints.
    pub block_type: BlockType,
    /// FNV-1a 64-bit hash of `markdown` for cheap change detection.
    pub content_hash: u64,
    
    // Oracle hint fields
    pub line_count: u32,
    pub row_count: Option<u32>,
    pub col_count: Option<u32>,
}

impl Block {
    fn new(
        id: usize,
        start_byte: usize,
        end_byte: usize,
        start_line: usize,
        end_line: usize,
        markdown: String,
        block_type: BlockType,
    ) -> Self {
        let content_hash = fnv1a_hash(&markdown);
        let line_count = markdown.lines().count() as u32;
        
        let (row_count, col_count) = if block_type == BlockType::Table {
            let rows = line_count;
            // Count pipes in the first row to estimate cols (subtract 1 because standard tables have pipes on edges)
            let cols = markdown.lines().next().unwrap_or("").chars().filter(|&c| c == '|').count().saturating_sub(1) as u32;
            (Some(rows), Some(cols.max(1)))
        } else {
            (None, None)
        };

        Block {
            id,
            start_byte,
            end_byte,
            start_line,
            end_line,
            markdown,
            block_type,
            content_hash,
            line_count,
            row_count,
            col_count,
        }
    }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/// Scan `content` and return a list of blocks in document order.
pub fn scan(content: &str) -> Vec<Block> {
    let mut blocks: Vec<Block> = Vec::new();

    let mut block_lines: Vec<&str> = Vec::new();
    let mut block_start_byte: usize = 0;
    let mut block_start_line: usize = 0;
    let mut current_block_type = BlockType::Paragraph;

    let mut byte_offset: usize = 0;
    let mut line_index: usize = 0;

    let mut in_code_fence = false;
    let mut fence_char = '`';
    let mut fence_min_len: usize = 3;
    let mut in_frontmatter = false;
    let mut in_table = false;

    for raw_line in LineIter::new(content) {
        let trimmed = raw_line.trim_end_matches(['\r', '\n']);

        // ── YAML frontmatter (first line only) ──────────────────────────────
        if line_index == 0 && trimmed == "---" {
            in_frontmatter = true;
            current_block_type = BlockType::Frontmatter;
            block_start_byte = 0;
            block_start_line = 0;
            block_lines.push(trimmed);
            byte_offset += raw_line.len();
            line_index += 1;
            continue;
        }

        if in_frontmatter {
            block_lines.push(trimmed);
            if trimmed == "---" || trimmed == "..." {
                in_frontmatter = false;
                let end_byte = byte_offset + raw_line.len();
                let markdown = block_lines.join("\n");
                blocks.push(Block::new(
                    blocks.len(),
                    block_start_byte,
                    end_byte,
                    block_start_line,
                    line_index,
                    markdown,
                    BlockType::Frontmatter,
                ));
                block_lines.clear();
                current_block_type = BlockType::Paragraph;
            }
            byte_offset += raw_line.len();
            line_index += 1;
            continue;
        }

        // ── Code fence tracking ─────────────────────────────────────────────
        if !in_code_fence {
            if let Some((ch, len)) = detect_fence_open(trimmed) {
                in_code_fence = true;
                fence_char = ch;
                fence_min_len = len;
            }
        } else if is_fence_close(trimmed, fence_char, fence_min_len) {
            in_code_fence = false;
        }

        // ── Block splitting logic ───────────────────────────────────────────
        let is_blank = trimmed.is_empty();

        if in_table && !is_blank && !is_table_line(trimmed) {
            if !block_lines.is_empty() {
                let markdown = block_lines.join("\n");
                let end_byte = byte_offset;
                blocks.push(Block::new(
                    blocks.len(),
                    block_start_byte,
                    end_byte,
                    block_start_line,
                    line_index.saturating_sub(1),
                    markdown,
                    BlockType::Table,
                ));
                block_lines.clear();
            }
            in_table = false;
            current_block_type = BlockType::Paragraph;
        }

        if is_blank && !in_code_fence && !in_table {
            if !block_lines.is_empty() {
                let markdown = block_lines.join("\n");
                let end_byte = byte_offset;
                blocks.push(Block::new(
                    blocks.len(),
                    block_start_byte,
                    end_byte,
                    block_start_line,
                    line_index.saturating_sub(1),
                    markdown,
                    current_block_type,
                ));
                block_lines.clear();
                current_block_type = BlockType::Paragraph;
                in_table = false;
            }
        } else {
            if block_lines.is_empty() {
                block_start_byte = byte_offset;
                block_start_line = line_index;
                
                if in_code_fence {
                    current_block_type = BlockType::CodeFence;
                } else if is_table_line(trimmed) && !in_table {
                    in_table = true;
                    current_block_type = BlockType::Table;
                } else if is_table_line(trimmed) {
                    current_block_type = BlockType::Table;
                } else if let Some(bt) = classify_first_line(trimmed) {
                    current_block_type = bt;
                } else {
                    current_block_type = BlockType::Paragraph;
                }
            } else if !in_code_fence && !in_table && is_table_line(trimmed) {
                in_table = true;
                current_block_type = BlockType::Table;
            }
            block_lines.push(trimmed);
        }

        byte_offset += raw_line.len();
        line_index += 1;
    }

    if !block_lines.is_empty() {
        let markdown = block_lines.join("\n");
        blocks.push(Block::new(
            blocks.len(),
            block_start_byte,
            byte_offset,
            block_start_line,
            line_index.saturating_sub(1),
            markdown,
            current_block_type,
        ));
    }

    blocks
}

pub fn reassemble(blocks: &[Block]) -> String {
    if blocks.is_empty() {
        return String::new();
    }
    let mut out = blocks
        .iter()
        .map(|b| b.markdown.as_str())
        .collect::<Vec<_>>()
        .join("\n\n");
    out.push('\n');
    out
}

// ── Private helpers ────────────────────────────────────────────────────────────

fn classify_first_line(line: &str) -> Option<BlockType> {
    let trimmed = line.trim_start();

    if is_horizontal_rule(trimmed) {
        return Some(BlockType::HorizontalRule);
    }

    if let Some(level) = detect_heading_level(trimmed) {
        return Some(match level {
            1 => BlockType::Heading1,
            2 => BlockType::Heading2,
            3 => BlockType::Heading3,
            4 => BlockType::Heading4,
            5 => BlockType::Heading5,
            _ => BlockType::Heading6,
        });
    }

    if trimmed.starts_with("- ") || trimmed.starts_with("* ") || trimmed.starts_with("+ ") {
        return Some(BlockType::List);
    }

    let dot_pos = trimmed.find(". ").or_else(|| trimmed.find(") "));
    if let Some(pos) = dot_pos {
        if pos > 0 && trimmed[..pos].chars().all(|c| c.is_ascii_digit()) {
            return Some(BlockType::List);
        }
    }

    if trimmed.starts_with('>') {
        return Some(BlockType::Blockquote);
    }

    None
}

fn detect_heading_level(line: &str) -> Option<usize> {
    let n = line.chars().take_while(|&c| c == '#').count();
    if n >= 1 && n <= 6 && (line.len() == n || line[n..].starts_with(' ')) {
        Some(n)
    } else {
        None
    }
}

fn is_horizontal_rule(line: &str) -> bool {
    let chars: Vec<char> = line.chars().filter(|c| !c.is_whitespace()).collect();
    if chars.len() < 3 {
        return false;
    }
    let first = chars[0];
    (first == '-' || first == '*' || first == '_') && chars.iter().all(|&c| c == first)
}

fn is_table_line(line: &str) -> bool {
    line.trim_start().starts_with('|')
}

struct LineIter<'a> {
    remaining: &'a str,
}

impl<'a> LineIter<'a> {
    fn new(s: &'a str) -> Self {
        LineIter { remaining: s }
    }
}

impl<'a> Iterator for LineIter<'a> {
    type Item = &'a str;

    fn next(&mut self) -> Option<Self::Item> {
        if self.remaining.is_empty() {
            return None;
        }
        let end = self
            .remaining
            .as_bytes()
            .iter()
            .position(|&b| b == b'\n')
            .map(|p| p + 1)
            .unwrap_or(self.remaining.len());
        let line = &self.remaining[..end];
        self.remaining = &self.remaining[end..];
        Some(line)
    }
}

fn detect_fence_open(line: &str) -> Option<(char, usize)> {
    let s = line.trim_start();
    for ch in ['`', '~'] {
        if s.starts_with(ch) {
            let len = s.chars().take_while(|&c| c == ch).count();
            if len >= 3 {
                return Some((ch, len));
            }
        }
    }
    None
}

fn is_fence_close(line: &str, fence_char: char, min_len: usize) -> bool {
    let s = line.trim_start();
    let count = s.chars().take_while(|&c| c == fence_char).count();
    let rest = &s[count.min(s.len())..];
    count >= min_len && rest.trim().is_empty()
}

pub fn fnv1a_hash(s: &str) -> u64 {
    let mut hash: u64 = 14_695_981_039_346_656_037;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1_099_511_628_211);
    }
    hash
}
