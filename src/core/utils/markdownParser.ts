/**
 * Markdown Parser Utility
 * Converts markdown to sanitized HTML using markdown-it + DOMPurify
 *
 * @module markdownParser
 */

import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { highlightCodeBlocks } from '@/lib/syntax/highlightTheme';

const md = new MarkdownIt({
  html: false,       // Disable raw HTML in source (security)
  xhtmlOut: false,   // Use HTML5 output
  breaks: true,      // Convert \n to <br> (matches Obsidian/CM6 soft-break behaviour)
  linkify: true,     // Auto-convert URLs to links
  typographer: true, // Enable smart quotes and typographic replacements
});

// ── Helper: emit data-source-line on block open tokens ───────────────────────
// markdown-it tokens have a .map property: [startLine, endLine] (0-indexed)
function addLineAttr(token: any, self: any): string {
  if (token.map) {
    token.attrSet('data-source-line', String(token.map[0] + 1)); // 1-indexed
  }
  return self.renderToken([token], 0, {});
}

// ── Heading anchor IDs + source line ──────────────────────────────────────────
// Adds id="slug" and data-source-line to every heading.
// markdown-it token stream: heading_open → inline → heading_close (always in order).
md.renderer.rules['heading_open'] = (tokens, idx, options, _env, self) => {
  const token = tokens[idx];
  const inlineToken = tokens[idx + 1];
  if (!token) return self.renderToken(tokens, idx, options);

  // Add source line number
  if (token.map) {
    token.attrSet('data-source-line', String(token.map[0] + 1));
  }

  // Add anchor ID
  if (inlineToken?.type === 'inline' && inlineToken.children) {
    const text = inlineToken.children
      .filter(t => t.type === 'text' || t.type === 'code_inline')
      .map(t => t.content)
      .join('');
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    if (slug) token.attrSet('id', slug);
  }
  return self.renderToken(tokens, idx, options);
};

// ── Source line attributes for block elements ────────────────────────────────
md.renderer.rules['paragraph_open'] = (tokens, idx, _options, _env, self) => addLineAttr(tokens[idx]!, self);
md.renderer.rules['bullet_list_open'] = (tokens, idx, _options, _env, self) => addLineAttr(tokens[idx]!, self);
md.renderer.rules['ordered_list_open'] = (tokens, idx, _options, _env, self) => addLineAttr(tokens[idx]!, self);
md.renderer.rules['blockquote_open'] = (tokens, idx, _options, _env, self) => addLineAttr(tokens[idx]!, self);

// Fence (code blocks) - custom renderer to add data-source-line and syntax highlighting
md.renderer.rules['fence'] = (tokens, idx) => {
  const token = tokens[idx]!;
  const lang = token.info.trim().split(/\s+/)[0] ?? '';
  const lineAttr = token.map ? ` data-source-line="${token.map[0]! + 1}"` : '';
  const langClass = lang ? ` class="language-${lang}"` : '';
  // Note: highlight.js will process this in highlightCodeBlocks()
  return `<pre${lineAttr}><code${langClass}>${md.utils.escapeHtml(token.content)}</code></pre>\n`;
};

// ── Scrollable table wrapper ───────────────────────────────────────────────────
// Wraps every <table> in <div class="markdown-table-wrapper"> so that wide
// tables scroll horizontally within their own box instead of overflowing
// the card / viewport (mirrors how <pre> uses overflow-x: auto).
md.renderer.rules['table_open'] = () => '<div class="markdown-table-wrapper"><table>\n';
md.renderer.rules['table_close'] = () => '</table></div>\n';

/**
 * Parse markdown to sanitized HTML.
 *
 * Handles headings (H1–H6), bold, italic, inline code, code blocks,
 * ordered/unordered lists, links, blockquotes, horizontal rules, and tables.
 * Output is sanitized by DOMPurify to prevent XSS.
 *
 * @param content - Raw markdown string
 * @returns Sanitized HTML string
 */
export function parseBasicMarkdown(content: string): string {
  if (!content || content.trim() === '') {
    return '<p class="markdown-empty">Empty document</p>';
  }

  try {
    const rawHtml = md.render(content);

    // Apply syntax highlighting to code blocks
    const highlighted = highlightCodeBlocks(rawHtml);

    const sanitized = DOMPurify.sanitize(highlighted, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'strong', 'em', 'del', 's',
        'code', 'pre',
        'ul', 'ol', 'li',
        'blockquote', 'hr',
        'a',
        // div is required for the markdown-table-wrapper
        'div',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        // span is required for highlight.js token wrapping
        'span',
      ],
      ALLOWED_ATTR: ['href', 'class', 'id', 'target', 'rel', 'data-source-line'],
      ALLOW_DATA_ATTR: true,
      FORCE_BODY: true,
    });

    return sanitized;
  } catch (error) {
    console.error('[ERROR] [markdownParser] Failed to parse markdown:', error);
    return '<p class="markdown-error">Failed to render content</p>';
  }
}

/**
 * Access the underlying markdown-it instance for advanced use (e.g. adding plugins).
 */
export function getMarkdownItInstance(): MarkdownIt {
  return md;
}
