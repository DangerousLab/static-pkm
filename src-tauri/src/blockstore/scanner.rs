//! Markdown block scanner.
//!
//! Splits a markdown document into paragraph-level blocks at blank-line
//! boundaries, respecting:
//!   - YAML frontmatter  (`---` ... `---` / `...`)
//!   - Fenced code blocks (`` ``` `` or `~~~`, any length ≥ 3)
//!   - Markdown tables   (consecutive lines starting with `|`)
//!
//! Each block carries byte offsets, line numbers, estimated render height,
//! and an FNV-1a content hash for cheap change detection.

use serde::{Deserialize, Serialize};

// ── Public types ───────────────────────────────────────────────────────────────

/// The semantic type of a block, used for type-aware height estimation.
///
/// Code fences and tables use `overflow-x: auto` in CSS so their heights are
/// viewport-independent (no text wrapping). Paragraphs can wrap so their
/// height is estimated coarsely and refined later by DOM measurement.
/// Headings, lists, blockquotes, and horizontal rules carry their own CSS
/// metrics and are estimated independently of line count where applicable.
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
    /// Semantic type — used for height estimation and rendering hints.
    pub block_type: BlockType,
    /// Estimated render height in pixels (viewport-accurate for code/tables).
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
        block_type: BlockType,
    ) -> Self {
        let line_count = markdown.lines().count().max(1);
        let estimated_height = estimate_height(line_count, block_type);
        let content_hash = fnv1a_hash(&markdown);
        Block {
            id,
            start_byte,
            end_byte,
            start_line,
            end_line,
            markdown,
            block_type,
            estimated_height,
            content_hash,
        }
    }
}

// ── Height estimation ──────────────────────────────────────────────────────────

/// Estimate the rendered pixel height of a block given its line count and type.
///
/// Values are derived from tiptap.css and variables.css:
///   --font-size-base: 1rem (16px)
///   --line-height-relaxed: 1.75  →  16px × 1.75 = 28px per paragraph line
///
/// ProseMirror resets <p> margin to 0, so paragraphs have no vertical margin.
/// Headings, lists, and blockquotes have explicit tiptap.css margins (em-based).
/// Code fences and tables use overflow-x: auto and never wrap — their heights
/// are viewport-independent. Paragraphs can wrap; the estimate is coarse and
/// can be refined later via DOM measurements with `update_block_height`.
pub fn estimate_height(line_count: usize, block_type: BlockType) -> f64 {
    match block_type {
        // 16px × 1.75 line-height = 28px/line. ProseMirror <p> margin = 0.
        BlockType::Paragraph => line_count as f64 * 28.0,

        // tiptap.css: h1-h4 { font-family; font-weight: 600; margin-top: 1.5em;
        //                     margin-bottom: 0.5em; line-height: 1.3 }
        // h1: font-size 2em = 32px → lh 41.6, mt 48, mb 16  → total ≈ 106px
        BlockType::Heading1 => 106.0,
        // h2: font-size 1.5em = 24px → lh 31.2, mt 36, mb 12 → total ≈ 79px
        BlockType::Heading2 => 79.0,
        // h3: font-size 1.25em = 20px → lh 26, mt 30, mb 10 → total ≈ 66px
        BlockType::Heading3 => 66.0,
        // h4-h6: font-size 1em = 16px → lh 20.8, mt 24, mb 8 → total ≈ 53px
        // (h5/h6 are not styled in tiptap.css; inherit browser defaults ≈ h4)
        BlockType::Heading4 | BlockType::Heading5 | BlockType::Heading6 => 53.0,

        // tiptap.css: ul, ol { margin: 0.5rem 0 } = 8px × 2 = 16px total margin
        // li line-height same as paragraph (28px per item line)
        BlockType::List => line_count as f64 * 28.0 + 16.0,

        // tiptap.css: blockquote { margin: 1rem 0; padding-left: 1rem }
        // 16px × 2 = 32px total vertical margin; line-height same as paragraph
        BlockType::Blockquote => line_count as f64 * 28.0 + 32.0,

        // Browser default hr + surrounding margins. tiptap.css has no hr rule.
        // Estimated: ~1px border + ~32px margin (1rem top + 1rem bottom).
        BlockType::HorizontalRule => 33.0,

        // CSS (tiptap.css): pre { padding: 0.75rem 1rem; border: 1px; overflow-x: auto }
        //                   pre code { white-space: pre } — no wrapping
        // Mono line-height ≈ 20px. Padding: 0.75rem × 2 ≈ 24px. Border: 2px.
        BlockType::CodeFence => (line_count as f64 * 20.0) + 26.0,

        // CSS (tiptap.css): table { overflow-x: auto; display: block; width: max-content }
        //                   th/td { padding: 0.5rem 0.75rem } — no wrapping
        // Row height ≈ 36px (content + vertical padding). Margin: 1rem × 2 = 32px.
        BlockType::Table => (line_count as f64 * 36.0) + 32.0,

        BlockType::Frontmatter => 0.0,
    }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/// Scan `content` and return a list of blocks in document order.
///
/// Blocks are delineated by one or more blank lines. Code fences, YAML
/// frontmatter, and markdown tables are treated as atomic and never split.
pub fn scan(content: &str) -> Vec<Block> {
    let mut blocks: Vec<Block> = Vec::new();

    // Current in-progress block accumulator
    let mut block_lines: Vec<&str> = Vec::new();
    let mut block_start_byte: usize = 0;
    let mut block_start_line: usize = 0;
    let mut current_block_type = BlockType::Paragraph;

    // Running counters
    let mut byte_offset: usize = 0;
    let mut line_index: usize = 0;

    // Parser state
    let mut in_code_fence = false;
    let mut fence_char = '`';
    let mut fence_min_len: usize = 3;
    let mut in_frontmatter = false;
    let mut in_table = false;

    for raw_line in LineIter::new(content) {
        // `trimmed` is the line without its trailing newline characters.
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

        // Table exit: a non-blank, non-table line ends the table block.
        // We flush the accumulated table block and restart with the current line.
        //
        // NOTE: we intentionally do NOT check `!in_code_fence` here. The code
        // fence tracker above already ran and may have set `in_code_fence = true`
        // for this very line (e.g. "```python" immediately after table rows).
        // If we excluded code-fence openers, the fence line would be absorbed
        // into the table block instead of starting a new CodeFence block.
        if in_table && !is_blank && !is_table_line(trimmed) {
            // Flush the accumulated table block
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
            // Reset type so the next block starts fresh as Paragraph
            // (or CodeFence if in_code_fence is now true — handled in the else branch below)
            current_block_type = BlockType::Paragraph;
            // Fall through — this line starts a new block below
        }

        if is_blank && !in_code_fence && !in_table {
            // Blank line outside a code fence or table → flush accumulated block
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
            // Non-blank line (or blank inside a fence/table) → accumulate
            if block_lines.is_empty() {
                block_start_byte = byte_offset;
                block_start_line = line_index;
                // Classify the block type at the moment it starts.
                // Code-fence and table detection are stateful (tracked above);
                // everything else is classified from the opening line alone.
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
                // A table starting within an existing non-table block is unusual
                // but treat it as a table continuation rather than splitting here.
                in_table = true;
                current_block_type = BlockType::Table;
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
            current_block_type,
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

/// Classify the semantic block type from the **first line** of a new block.
///
/// Called only when `block_lines` is empty (i.e., at the start of a new block).
/// Returns `None` if no special pattern is recognised (falls back to `Paragraph`).
/// Code-fence and table detection is handled separately in the main scan loop
/// because they require stateful tracking — this function only handles the
/// single-line patterns that can be identified from the opening line alone.
fn classify_first_line(line: &str) -> Option<BlockType> {
    let trimmed = line.trim_start();

    // Horizontal rule: ---, ***, or ___ (3+ of the same char, optional spaces).
    // Checked first so "---" is never mistaken for a list item.
    if is_horizontal_rule(trimmed) {
        return Some(BlockType::HorizontalRule);
    }

    // Heading: #{1,6} followed by a space (ATX heading syntax).
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

    // Unordered list: -, *, or + followed by a space.
    // The horizontal-rule check above ensures "---" never reaches here.
    if trimmed.starts_with("- ") || trimmed.starts_with("* ") || trimmed.starts_with("+ ") {
        return Some(BlockType::List);
    }

    // Ordered list: one or more digits followed by ". " or ") ".
    let dot_pos = trimmed.find(". ").or_else(|| trimmed.find(") "));
    if let Some(pos) = dot_pos {
        if pos > 0 && trimmed[..pos].chars().all(|c| c.is_ascii_digit()) {
            return Some(BlockType::List);
        }
    }

    // Blockquote: line starts with >.
    if trimmed.starts_with('>') {
        return Some(BlockType::Blockquote);
    }

    None
}

/// Detect the ATX heading level (1–6) from a line.
///
/// Returns `Some(n)` when the line starts with exactly 1–6 `#` characters
/// followed by a space or end-of-string. Returns `None` otherwise.
fn detect_heading_level(line: &str) -> Option<usize> {
    let n = line.chars().take_while(|&c| c == '#').count();
    if n >= 1 && n <= 6 && (line.len() == n || line[n..].starts_with(' ')) {
        Some(n)
    } else {
        None
    }
}

/// Return `true` if `line` is a thematic break (horizontal rule).
///
/// A horizontal rule is 3 or more identical characters (`-`, `*`, or `_`),
/// optionally separated by spaces and nothing else.
fn is_horizontal_rule(line: &str) -> bool {
    let chars: Vec<char> = line.chars().filter(|c| !c.is_whitespace()).collect();
    if chars.len() < 3 {
        return false;
    }
    let first = chars[0];
    (first == '-' || first == '*' || first == '_') && chars.iter().all(|&c| c == first)
}

/// Returns `true` if the line is part of a markdown table (starts with `|`).
fn is_table_line(line: &str) -> bool {
    line.trim_start().starts_with('|')
}

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

    // ── Existing tests (updated for new Block fields) ─────────────────────────

    #[test]
    fn test_simple_paragraphs() {
        let content = "Hello world\n\nSecond paragraph\n\nThird\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 3);
        assert_eq!(blocks[0].markdown, "Hello world");
        assert_eq!(blocks[1].markdown, "Second paragraph");
        assert_eq!(blocks[2].markdown, "Third");
        assert!(blocks.iter().all(|b| b.block_type == BlockType::Paragraph));
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
        let content = "A\n\n\n\nB\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].markdown, "A");
        assert_eq!(blocks[1].markdown, "B");
    }

    // ── Block type tests ──────────────────────────────────────────────────────

    #[test]
    fn test_code_fence_block_type() {
        let content = "Text\n\n```rust\nlet x = 1;\n```\n\nMore\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 3, "blocks: {:#?}", blocks);
        assert_eq!(blocks[0].block_type, BlockType::Paragraph);
        assert_eq!(blocks[1].block_type, BlockType::CodeFence);
        assert_eq!(blocks[2].block_type, BlockType::Paragraph);
    }

    #[test]
    fn test_frontmatter_block_type() {
        let content = "---\ntitle: Test\n---\n\nBody\n";
        let blocks = scan(content);
        assert_eq!(blocks[0].block_type, BlockType::Frontmatter);
        assert_eq!(blocks[1].block_type, BlockType::Paragraph);
    }

    #[test]
    fn test_table_block_type() {
        let content = "Intro\n\n| Col 1 | Col 2 |\n|-------|-------|\n| A | B |\n\nOutro\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 3, "blocks: {:#?}", blocks);
        assert_eq!(blocks[0].block_type, BlockType::Paragraph);
        assert_eq!(blocks[1].block_type, BlockType::Table);
        assert_eq!(blocks[2].block_type, BlockType::Paragraph);
        assert!(blocks[1].markdown.contains("Col 1"));
        assert!(blocks[1].markdown.contains("| A | B |"));
    }

    #[test]
    fn test_table_atomic_with_blank_line_inside() {
        // A blank line within a table block should NOT split it.
        let content = "Before\n\n| H1 | H2 |\n|----|----|\n\n| A  | B  |\n\nAfter\n";
        let blocks = scan(content);
        // The blank line between separator and data row is inside the table,
        // so the table must remain a single block.
        let table_blocks: Vec<_> = blocks
            .iter()
            .filter(|b| b.block_type == BlockType::Table)
            .collect();
        assert_eq!(table_blocks.len(), 1, "Table split unexpectedly: {:#?}", blocks);
        assert!(table_blocks[0].markdown.contains("| H1 | H2 |"));
        assert!(table_blocks[0].markdown.contains("| A  | B  |"));
    }

    #[test]
    fn test_table_followed_immediately_by_paragraph() {
        // No blank line between table and following paragraph — table must end
        // when the first non-table line is encountered.
        let content = "| H1 | H2 |\n|----|----|\n| A  | B  |\nSome text after\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 2, "blocks: {:#?}", blocks);
        assert_eq!(blocks[0].block_type, BlockType::Table);
        assert_eq!(blocks[1].block_type, BlockType::Paragraph);
        assert_eq!(blocks[1].markdown, "Some text after");
    }

    #[test]
    fn test_mixed_content_types() {
        let content = concat!(
            "# Introduction\n\n",
            "| Name | Value |\n|------|-------|\n| Foo  | 42    |\n\n",
            "```python\nprint('hello')\n```\n\n",
            "Conclusion\n"
        );
        let blocks = scan(content);
        assert_eq!(blocks.len(), 4, "blocks: {:#?}", blocks);
        assert_eq!(blocks[0].block_type, BlockType::Heading1); // was Paragraph before v5.3
        assert_eq!(blocks[1].block_type, BlockType::Table);
        assert_eq!(blocks[2].block_type, BlockType::CodeFence);
        assert_eq!(blocks[3].block_type, BlockType::Paragraph);
    }

    #[test]
    fn test_height_estimates_differ_by_type() {
        let content = "Paragraph text\n\n| H |\n|---|\n| A |\n\n```\ncode\n```\n";
        let blocks = scan(content);
        let para = blocks.iter().find(|b| b.block_type == BlockType::Paragraph).unwrap();
        let table = blocks.iter().find(|b| b.block_type == BlockType::Table).unwrap();
        let code = blocks.iter().find(|b| b.block_type == BlockType::CodeFence).unwrap();
        // Table and code heights must exceed the 28px/line paragraph estimate (v5.3: was 24)
        assert!(
            table.estimated_height > para.estimated_height,
            "table height {} should exceed paragraph height {}",
            table.estimated_height,
            para.estimated_height
        );
        assert!(
            code.estimated_height > para.estimated_height,
            "code height {} should exceed paragraph height {}",
            code.estimated_height,
            para.estimated_height
        );
    }

    // ── v5.3: New block type tests ────────────────────────────────────────────

    #[test]
    fn test_paragraph_height_28px() {
        // Paragraph line-height corrected from 24px to 28px in v5.3
        let content = "Line one\nLine two\nLine three\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].block_type, BlockType::Paragraph);
        assert_eq!(blocks[0].estimated_height, 84.0); // 3 lines × 28px
    }

    #[test]
    fn test_heading_block_types() {
        let content = "# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 6, "blocks: {:#?}", blocks);
        assert_eq!(blocks[0].block_type, BlockType::Heading1);
        assert_eq!(blocks[1].block_type, BlockType::Heading2);
        assert_eq!(blocks[2].block_type, BlockType::Heading3);
        assert_eq!(blocks[3].block_type, BlockType::Heading4);
        assert_eq!(blocks[4].block_type, BlockType::Heading5);
        assert_eq!(blocks[5].block_type, BlockType::Heading6);
    }

    #[test]
    fn test_heading_height_estimates() {
        let content = "# Big Title\n\n## Subtitle\n\n### Section\n\n#### Subsection\n";
        let blocks = scan(content);
        assert_eq!(blocks[0].estimated_height, 106.0, "h1 height");
        assert_eq!(blocks[1].estimated_height, 79.0, "h2 height");
        assert_eq!(blocks[2].estimated_height, 66.0, "h3 height");
        assert_eq!(blocks[3].estimated_height, 53.0, "h4 height");
    }

    #[test]
    fn test_heading_no_space_is_paragraph() {
        // "#hashtag" has no space after # — must NOT be classified as heading
        let content = "#hashtag\n\n##also-not-heading\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].block_type, BlockType::Paragraph);
        assert_eq!(blocks[1].block_type, BlockType::Paragraph);
    }

    #[test]
    fn test_list_unordered_block_type() {
        let content = "Intro\n\n- item 1\n- item 2\n- item 3\n\nOutro\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 3, "blocks: {:#?}", blocks);
        assert_eq!(blocks[0].block_type, BlockType::Paragraph);
        assert_eq!(blocks[1].block_type, BlockType::List);
        assert_eq!(blocks[2].block_type, BlockType::Paragraph);
        // 3 lines × 28px + 16px margin = 100px
        assert_eq!(blocks[1].estimated_height, 100.0);
    }

    #[test]
    fn test_list_ordered_block_type() {
        let content = "1. First\n2. Second\n3. Third\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].block_type, BlockType::List);
        // 3 lines × 28px + 16px margin = 100px
        assert_eq!(blocks[0].estimated_height, 100.0);
    }

    #[test]
    fn test_blockquote_block_type() {
        let content = "Text\n\n> Quote line 1\n> Quote line 2\n\nMore text\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 3, "blocks: {:#?}", blocks);
        assert_eq!(blocks[1].block_type, BlockType::Blockquote);
        // 2 lines × 28px + 32px margin = 88px
        assert_eq!(blocks[1].estimated_height, 88.0);
    }

    #[test]
    fn test_horizontal_rule_block_type() {
        let content = "Above\n\n---\n\nBelow\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 3, "blocks: {:#?}", blocks);
        assert_eq!(blocks[0].block_type, BlockType::Paragraph);
        assert_eq!(blocks[1].block_type, BlockType::HorizontalRule);
        assert_eq!(blocks[2].block_type, BlockType::Paragraph);
        assert_eq!(blocks[1].estimated_height, 33.0);
    }

    #[test]
    fn test_horizontal_rule_variants() {
        // All three HR syntaxes (document must not start with --- to avoid frontmatter)
        let content = "Text\n\n---\n\n***\n\n___\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 4, "blocks: {:#?}", blocks);
        assert_eq!(blocks[1].block_type, BlockType::HorizontalRule);
        assert_eq!(blocks[2].block_type, BlockType::HorizontalRule);
        assert_eq!(blocks[3].block_type, BlockType::HorizontalRule);
    }

    #[test]
    fn test_dash_list_vs_horizontal_rule() {
        // "- item" is a List; "---" is a HorizontalRule — must not be confused
        let content = "- item 1\n- item 2\n\n---\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 2, "blocks: {:#?}", blocks);
        assert_eq!(blocks[0].block_type, BlockType::List);
        assert_eq!(blocks[1].block_type, BlockType::HorizontalRule);
    }

    #[test]
    fn test_yaml_frontmatter_heading_body() {
        // --- at line 0 is frontmatter; # Heading is then Heading1
        let content = "---\ntitle: Test\ndate: 2026\n---\n\n# Heading\n\nBody\n";
        let blocks = scan(content);
        assert_eq!(blocks.len(), 3, "blocks: {:#?}", blocks);
        assert!(blocks[0].markdown.starts_with("---"));
        assert_eq!(blocks[0].block_type, BlockType::Frontmatter);
        assert_eq!(blocks[1].block_type, BlockType::Heading1);
        assert_eq!(blocks[2].block_type, BlockType::Paragraph);
    }

    #[test]
    fn test_frontmatter_height_is_zero() {
        let content = "---\ntitle: Test\n---\n\nBody\n";
        let blocks = scan(content);
        assert_eq!(blocks[0].estimated_height, 0.0);
    }
}
