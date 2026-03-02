//! Markdown block scanner (Phase 2 Robust Lexical Chunker).
//!
//! Splits a markdown document into top-level blocks using semantic boundaries
//! (Headings, Fences, Tables, Lists) rather than just blank lines.
//! 
//! This ensures that "composite" blocks like a heading followed immediately
//! by code are split into two distinct nodes for perfect Oracle prediction.

use serde::{Deserialize, Serialize};

// ── Public types ───────────────────────────────────────────────────────────────

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
}

impl BlockType {
    pub fn as_str(&self) -> &'static str {
        match self {
            BlockType::Paragraph => "paragraph",
            BlockType::Heading1 | BlockType::Heading2 | BlockType::Heading3 |
            BlockType::Heading4 | BlockType::Heading5 | BlockType::Heading6 => "heading",
            BlockType::List => "bulletList",
            BlockType::Blockquote => "blockquote",
            BlockType::HorizontalRule => "horizontalRule",
            BlockType::CodeFence => "codeBlock",
            BlockType::Table => "table",
            BlockType::Frontmatter => "frontmatter",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub id: usize,
    pub start_byte: usize,
    pub end_byte: usize,
    pub start_line: usize,
    pub end_line: usize,
    pub markdown: String,
    pub block_type: BlockType,
    pub content_hash: u64,
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
        let mut line_count = markdown.lines().count() as u32;
        
        // Oracle Calibration: Subtract fences from line count so math is pure content
        if block_type == BlockType::CodeFence && line_count >= 2 {
            line_count -= 2;
        }

        let (row_count, col_count) = if block_type == BlockType::Table {
            let rows = line_count;
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

pub fn scan(content: &str) -> Vec<Block> {
    let mut blocks: Vec<Block> = Vec::new();
    let mut current_lines: Vec<&str> = Vec::new();
    
    let mut block_start_byte: usize = 0;
    let mut block_start_line: usize = 0;
    let mut byte_offset: usize = 0;
    let mut current_block_type = BlockType::Paragraph;

    let mut in_code_fence = false;
    let mut in_table = false;
    let mut fence_char = '`';
    let mut fence_min_len = 3;

    for (line_index, raw_line) in LineIter::new(content).enumerate() {
        let trimmed = raw_line.trim_end_matches(['\r', '\n']);
        let clean = trimmed.trim_start();

        // 1. Detect stateful boundaries (Code Fences)
        if !in_code_fence {
            if let Some((ch, len)) = detect_fence_open(clean) {
                // If we were accumulating a paragraph, flush it BEFORE starting the fence
                if !current_lines.is_empty() {
                    flush_block(&mut blocks, &mut current_lines, &mut block_start_byte, &mut block_start_line, byte_offset, line_index, current_block_type);
                }
                in_code_fence = true;
                fence_char = ch;
                fence_min_len = len;
                current_block_type = BlockType::CodeFence;
                block_start_byte = byte_offset;
                block_start_line = line_index;
            }
        } else if is_fence_close(clean, fence_char, fence_min_len) {
            current_lines.push(trimmed);
            byte_offset += raw_line.len();
            in_code_fence = false;
            flush_block(&mut blocks, &mut current_lines, &mut block_start_byte, &mut block_start_line, byte_offset, line_index + 1, BlockType::CodeFence);
            current_block_type = BlockType::Paragraph;
            continue;
        }

        if in_code_fence {
            current_lines.push(trimmed);
            byte_offset += raw_line.len();
            continue;
        }

        // 2. Detect atomic boundaries (Headings, Horizontal Rules, Lists)
        let is_blank = clean.is_empty();
        let is_heading = detect_heading_level(clean).is_some();
        let is_hr = is_horizontal_rule(clean);
        let is_list = clean.starts_with("- ") || clean.starts_with("* ") || clean.starts_with("+ ") || is_ordered_list_start(clean);
        let is_table = clean.starts_with('|');

        // Logic: if current line starts a "major" element, flush previous block
        if (is_heading || is_hr || is_list || is_table || is_blank) && !current_lines.is_empty() {
            flush_block(&mut blocks, &mut current_lines, &mut block_start_byte, &mut block_start_line, byte_offset, line_index, current_block_type);
        }

        if is_blank {
            byte_offset += raw_line.len();
            continue;
        }

        // Start a new block if we are empty
        if current_lines.is_empty() {
            block_start_byte = byte_offset;
            block_start_line = line_index;
            if is_heading {
                current_block_type = match detect_heading_level(clean).unwrap_or(1) {
                    1 => BlockType::Heading1, 2 => BlockType::Heading2, 3 => BlockType::Heading3,
                    4 => BlockType::Heading4, 5 => BlockType::Heading5, _ => BlockType::Heading6,
                };
            } else if is_hr { current_block_type = BlockType::HorizontalRule; }
            else if is_list { current_block_type = BlockType::List; }
            else if is_table { current_block_type = BlockType::Table; in_table = true; }
            else { current_block_type = BlockType::Paragraph; }
        }

        current_lines.push(trimmed);
        
        // Special case: Headings and HRs are always 1-line blocks
        if is_heading || is_hr {
            byte_offset += raw_line.len();
            flush_block(&mut blocks, &mut current_lines, &mut block_start_byte, &mut block_start_line, byte_offset, line_index + 1, current_block_type);
            continue;
        }

        // Special case: Table exit
        if in_table && !is_table {
            in_table = false; // logic above will flush on the NEXT non-table line
        }

        byte_offset += raw_line.len();
    }

    if !current_lines.is_empty() {
        flush_block(&mut blocks, &mut current_lines, &mut block_start_byte, &mut block_start_line, byte_offset, 9999, current_block_type);
    }

    blocks
}

fn flush_block(
    blocks: &mut Vec<Block>,
    lines: &mut Vec<&str>,
    start_byte: &mut usize,
    start_line: &mut usize,
    end_byte: usize,
    end_line: usize,
    block_type: BlockType,
) {
    if lines.is_empty() { return; }
    let markdown = lines.join("\n");
    blocks.push(Block::new(blocks.len(), *start_byte, end_byte, *start_line, end_line.saturating_sub(1), markdown, block_type));
    lines.clear();
}

pub fn reassemble(blocks: &[Block]) -> String {
    blocks.iter().map(|b| b.markdown.as_str()).collect::<Vec<_>>().join("\n\n")
}

// ── Helpers ────────────────────────────────────────────────────────────────────

fn detect_heading_level(line: &str) -> Option<usize> {
    let n = line.chars().take_while(|&c| c == '#').count();
    if n >= 1 && n <= 6 && (line.len() == n || line[n..].starts_with(' ')) { Some(n) } else { None }
}

fn is_horizontal_rule(line: &str) -> bool {
    let chars: Vec<char> = line.chars().filter(|c| !c.is_whitespace()).collect();
    if chars.len() < 3 { return false; }
    let first = chars[0];
    (first == '-' || first == '*' || first == '_') && chars.iter().all(|&c| c == first)
}

fn is_ordered_list_start(line: &str) -> bool {
    let dot_pos = line.find(". ").or_else(|| line.find(") "));
    if let Some(pos) = dot_pos {
        pos > 0 && line[..pos].chars().all(|c| c.is_ascii_digit())
    } else { false }
}

fn detect_fence_open(line: &str) -> Option<(char, usize)> {
    for ch in ['`', '~'] {
        if line.starts_with(ch) {
            let len = line.chars().take_while(|&c| c == ch).count();
            if len >= 3 { return Some((ch, len)); }
        }
    }
    None
}

fn is_fence_close(line: &str, fence_char: char, min_len: usize) -> bool {
    let count = line.chars().take_while(|&c| c == fence_char).count();
    count >= min_len && line[count..].trim().is_empty()
}

pub fn fnv1a_hash(s: &str) -> u64 {
    let mut hash: u64 = 14_695_981_039_346_656_037;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1_099_511_628_211);
    }
    hash
}

struct LineIter<'a> { remaining: &'a str }
impl<'a> LineIter<'a> { fn new(s: &'a str) -> Self { Self { remaining: s } } }
impl<'a> Iterator for LineIter<'a> {
    type Item = &'a str;
    fn next(&mut self) -> Option<Self::Item> {
        if self.remaining.is_empty() { return None; }
        let end = self.remaining.as_bytes().iter().position(|&b| b == b'\n').map(|p| p + 1).unwrap_or(self.remaining.len());
        let line = &self.remaining[..end];
        self.remaining = &self.remaining[end..];
        Some(line)
    }
}
