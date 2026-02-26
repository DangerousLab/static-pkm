//! Markdown block scanner.
//!
//! Splits a markdown document into paragraph-level blocks at blank-line
//! boundaries, respecting:
//!   - YAML frontmatter  (`---` ... `---` / `...`)
//!   - Fenced code blocks (`` ``` `` or `~~~`, any length ≥ 3)
//!
//! Each block carries byte offsets, line numbers, estimated render height,
//! and an FNV-1a content hash for cheap change detection.

use serde::{Deserialize, Serialize};

// ── Public types ───────────────────────────────────────────────────────────────

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
    /// Estimated render height in pixels (`line_count × 24`).
    pub estimated_height: f64,
    /// FNV-1a 64-bit hash of `markdown` for cheap change detection.
    pub content_hash: u64,
}

impl Block {
    fn new(
        id: usize,
        start_byte: usize,
        end_byte: usize,
        start_line: usize,
        end_line: usize,
        markdown: String,
    ) -> Self {
        let line_count = markdown.lines().count().max(1);
        let estimated_height = line_count as f64 * 24.0;
        let content_hash = fnv1a_hash(&markdown);
        Block {
            id,
            start_byte,
            end_byte,
            start_line,
            end_line,
            markdown,
            estimated_height,
            content_hash,
        }
    }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/// Scan `content` and return a list of blocks in document order.
///
/// Blocks are delineated by one or more blank lines. Code fences and YAML
/// frontmatter are never split.
pub fn scan(content: &str) -> Vec<Block> {
    let mut blocks: Vec<Block> = Vec::new();

    // Current in-progress block accumulator
    let mut block_lines: Vec<&str> = Vec::new();
    let mut block_start_byte: usize = 0;
    let mut block_start_line: usize = 0;

    // Running counters
    let mut byte_offset: usize = 0;
    let mut line_index: usize = 0;

    // Parser state
    let mut in_code_fence = false;
    let mut fence_char = '`';
    let mut fence_min_len: usize = 3;
    let mut in_frontmatter = false;

    for raw_line in LineIter::new(content) {
        // `trimmed` is the line without its trailing newline characters.
        let trimmed = raw_line.trim_end_matches(['\r', '\n']);

        // ── YAML frontmatter (first line only) ──────────────────────────────
        if line_index == 0 && trimmed == "---" {
            in_frontmatter = true;
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
                // Flush frontmatter as a single block
                let end_byte = byte_offset + raw_line.len();
                let markdown = block_lines.join("\n");
                blocks.push(Block::new(
                    blocks.len(),
                    block_start_byte,
                    end_byte,
                    block_start_line,
                    line_index,
                    markdown,
                ));
                block_lines.clear();
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

        if is_blank && !in_code_fence {
            // Blank line outside a code fence → flush accumulated block
            if !block_lines.is_empty() {
                let markdown = block_lines.join("\n");
                // end_byte does not include the blank line itself
                let end_byte = byte_offset;
                blocks.push(Block::new(
                    blocks.len(),
                    block_start_byte,
                    end_byte,
                    block_start_line,
                    line_index.saturating_sub(1),
                    markdown,
                ));
                block_lines.clear();
            }
        } else {
            // Non-blank line (or blank inside a fence) → accumulate
            if block_lines.is_empty() {
                block_start_byte = byte_offset;
                block_start_line = line_index;
            }
            block_lines.push(trimmed);
        }

        byte_offset += raw_line.len();
        line_index += 1;
    }

    // Flush the final block if content does not end with a blank line
    if !block_lines.is_empty() {
        let markdown = block_lines.join("\n");
        blocks.push(Block::new(
            blocks.len(),
            block_start_byte,
            byte_offset,
            block_start_line,
            line_index.saturating_sub(1),
            markdown,
        ));
    }

    blocks
}

/// Reassemble a slice of blocks into a complete markdown document.
///
/// Blocks are joined with `\n\n`; a trailing `\n` is appended.
/// This normalises multiple consecutive blank lines to a single blank line.
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

/// Iterator that yields raw line slices (including their `\n` / `\r\n`).
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
            .map(|p| p + 1) // include the `\n`
            .unwrap_or(self.remaining.len()); // no trailing newline
        let line = &self.remaining[..end];
        self.remaining = &self.remaining[end..];
        Some(line)
    }
}

/// Detect whether `line` opens a code fence.
/// Returns `(fence_char, min_closing_length)` if it does.
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

/// Return `true` if `line` closes an open fence of `(fence_char, min_len)`.
fn is_fence_close(line: &str, fence_char: char, min_len: usize) -> bool {
    let s = line.trim_start();
    let count = s.chars().take_while(|&c| c == fence_char).count();
    let rest = &s[count.min(s.len())..];
    count >= min_len && rest.trim().is_empty()
}

/// FNV-1a 64-bit hash — deterministic, dependency-free.
pub fn fnv1a_hash(s: &str) -> u64 {
    let mut hash: u64 = 14_695_981_039_346_656_037;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1_099_511_628_211);
    }
    hash
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_paragraphs() {
        let content = "Hello world\n\nSecond paragraph\n\nThird\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 3);
        assert_eq!(blocks[0].markdown, "Hello world");
        assert_eq!(blocks[1].markdown, "Second paragraph");
        assert_eq!(blocks[2].markdown, "Third");
    }

    #[test]
    fn test_code_fence_not_split() {
        let content = "Before\n\n```rust\nfn main() {\n\n    println!(\"hello\");\n}\n```\n\nAfter\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 3, "blocks: {:#?}", blocks);
        assert!(blocks[1].markdown.contains("fn main()"));
        assert_eq!(blocks[2].markdown, "After");
    }

    #[test]
    fn test_tilde_fence() {
        let content = "Before\n\n~~~python\nx = 1\n\ny = 2\n~~~\n\nAfter\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 3);
        assert!(blocks[1].markdown.contains("x = 1"));
    }

    #[test]
    fn test_yaml_frontmatter() {
        let content = "---\ntitle: Test\ndate: 2026\n---\n\n# Heading\n\nBody\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 3, "blocks: {:#?}", blocks);
        assert!(blocks[0].markdown.starts_with("---"));
        assert_eq!(blocks[1].markdown, "# Heading");
        assert_eq!(blocks[2].markdown, "Body");
    }

    #[test]
    fn test_empty_file() {
        let blocks = scan("");
        assert_eq!(blocks.len(), 0);
    }

    #[test]
    fn test_single_line_no_trailing_newline() {
        let blocks = scan("Hello");
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].markdown, "Hello");
    }

    #[test]
    fn test_reassemble_simple_roundtrip() {
        let original = "# Title\n\nParagraph one\n\nParagraph two\n";
        let blocks = scan(original);
        let reassembled = reassemble(&blocks);
        assert_eq!(reassembled, original);
    }

    #[test]
    fn test_block_ids_sequential() {
        let content = "A\n\nB\n\nC\n";
        let blocks = scan(content);
        for (i, b) in blocks.iter().enumerate() {
            assert_eq!(b.id, i);
        }
    }

    #[test]
    fn test_multiple_blank_lines_normalised() {
        // Multiple blank lines between paragraphs are treated as a single separator.
        let content = "A\n\n\n\nB\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].markdown, "A");
        assert_eq!(blocks[1].markdown, "B");
    }
}
