/**
 * Markdown Parser Utility
 * Converts markdown to sanitized HTML using markdown-it + DOMPurify
 *
 * @module markdownParser
 */

import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({
  html: false,       // Disable raw HTML in source (security)
  xhtmlOut: false,   // Use HTML5 output
  breaks: true,      // Convert \n to <br> (matches Obsidian/CM6 soft-break behaviour)
  linkify: true,     // Auto-convert URLs to links
  typographer: true, // Enable smart quotes and typographic replacements
});

// ── Heading anchor IDs ────────────────────────────────────────────────────────
// Adds id="slug" to every heading so that [Title](#slug) anchor links work.
// markdown-it token stream: heading_open → inline → heading_close (always in order).
md.renderer.rules['heading_open'] = (tokens, idx, options, _env, self) => {
  const token = tokens[idx];
  const inlineToken = tokens[idx + 1];
  if (!token) return self.renderToken(tokens, idx, options);
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

    const sanitized = DOMPurify.sanitize(rawHtml, {
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
      ],
      ALLOWED_ATTR: ['href', 'class', 'id', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
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
