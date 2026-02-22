/**
 * CodeMirror 6 Live Preview Plugin
 *
 * Implements Obsidian-style inline markdown rendering:
 * - Lines NOT containing the cursor → their text glyphs are replaced by a
 *   rendered HTML widget using Decoration.replace() with block:false.
 *   The widget renders inside the existing .cm-line div, invisibly replacing
 *   the raw text characters.
 * - The line containing the cursor → no decoration, raw markdown is shown.
 *
 * KEY CM6 INSIGHT: Decoration.replace({ block: false }) replaces the *rendered
 * glyphs* of a range within a .cm-line element. Spanning line.from→line.to
 * (without the trailing newline) replaces all visible characters on that line,
 * while the widget is rendered in their place — exactly how Obsidian's live
 * preview works.
 *
 * DO NOT use block:true. Block widgets are inserted *between* lines and do not
 * replace the line's own text, causing both the raw syntax and the widget to
 * appear simultaneously.
 *
 * @module livePreviewPlugin
 */

import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  WidgetType,
  EditorView,
  ViewUpdate,
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';

// ── Helpers ────────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Widget ─────────────────────────────────────────────────────────────────────

/**
 * Replaces a line's text glyphs with rendered HTML.
 * Rendered inside the .cm-line div via Decoration.replace (block: false).
 */
class HtmlWidget extends WidgetType {
  constructor(private readonly html: string) {
    super();
  }

  eq(other: HtmlWidget): boolean {
    return other.html === this.html;
  }

  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-lp-widget';
    el.innerHTML = this.html;
    return el;
  }

  // Allow click/mousedown through to CM6 so cursor placement works
  ignoreEvent(event: Event): boolean {
    return !(event.type === 'mousedown' || event.type === 'click');
  }
}

// ── Inline markdown renderer ───────────────────────────────────────────────────

/**
 * Converts inline markdown to HTML. Applied to text that will become a widget.
 * Patterns ordered longest/most-specific first to avoid partial matches.
 */
function renderInline(text: string): string {
  return text
    // Inline code  `code`
    .replace(/`([^`]+)`/g, (_, c: string) =>
      `<code class="cm-lp-code">${escHtml(c)}</code>`
    )
    // Bold + italic  ***text***
    .replace(/\*{3}(.+?)\*{3}/g, (_, t: string) =>
      `<strong><em>${escHtml(t)}</em></strong>`
    )
    // Bold  **text** or __text__
    .replace(/(\*\*|__)(.+?)\1/g, (_, _d: string, t: string) =>
      `<strong>${escHtml(t)}</strong>`
    )
    // Italic  *text* or _text_  (not adjacent to another * or _)
    .replace(/(?<![*_])([*_])(?![*_\s])(.+?)(?<![*_\s])\1(?![*_])/g, (_, _d: string, t: string) =>
      `<em>${escHtml(t)}</em>`
    )
    // Strikethrough  ~~text~~
    .replace(/~~(.+?)~~/g, (_, t: string) =>
      `<del>${escHtml(t)}</del>`
    )
    // Image  ![alt](url)  — must come before link
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, url: string) =>
      `<img src="${escAttr(url)}" alt="${escAttr(alt)}" class="cm-lp-img" />`
    )
    // Link  [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, url: string) =>
      `<a href="${escAttr(url)}" class="cm-lp-link" target="_blank" rel="noopener noreferrer">${escHtml(label)}</a>`
    );
}

// ── Block-level line renderer ──────────────────────────────────────────────────

/**
 * Tries to render a line as a block markdown element.
 * Returns a Decoration.replace Range (block:false) or null if not a block pattern.
 *
 * IMPORTANT: we use block:false here. The range spans line.from→line.to,
 * which replaces the line's rendered characters with the widget, while leaving
 * the newline (and thus the .cm-line structure) intact.
 *
 * @param isTableHeader - true when this table row is immediately before a separator row
 */
function decorateBlockLine(
  lineText: string,
  lineFrom: number,
  lineTo: number,
  isTableHeader = false
): Range<Decoration> | null {
  // ── Heading: # … ######
  const headingMatch = /^(#{1,6})\s+(.+)$/.exec(lineText);
  if (headingMatch) {
    const level = (headingMatch[1] ?? '#').length;
    const inner = renderInline(headingMatch[2] ?? '');
    const html = `<h${level} class="cm-lp-heading cm-lp-h${level}">${inner}</h${level}>`;
    return Decoration.replace({ widget: new HtmlWidget(html) }).range(lineFrom, lineTo);
  }

  // ── Horizontal rule: --- / *** / ___ (3+ chars)
  if (/^(\s*[-*_]){3,}\s*$/.test(lineText)) {
    return Decoration.replace({
      widget: new HtmlWidget('<hr class="cm-lp-hr" />'),
    }).range(lineFrom, lineTo);
  }

  // ── Blockquote: > text
  const bqMatch = /^>\s?(.*)$/.exec(lineText);
  if (bqMatch) {
    const inner = renderInline(bqMatch[1] ?? '');
    return Decoration.replace({
      widget: new HtmlWidget(`<span class="cm-lp-blockquote">${inner}</span>`),
    }).range(lineFrom, lineTo);
  }

  // ── Task list: - [ ] / - [x]  (must come before ul)
  const taskMatch = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/.exec(lineText);
  if (taskMatch) {
    const indent = (taskMatch[1] ?? '').length;
    const checked = (taskMatch[2] ?? '').toLowerCase() === 'x';
    const inner = renderInline(taskMatch[3] ?? '');
    const html =
      `<span class="cm-lp-li cm-lp-task" style="padding-left:${indent * 8}px">` +
      `<input type="checkbox" ${checked ? 'checked' : ''} disabled class="cm-lp-checkbox" />` +
      `<span class="${checked ? 'cm-lp-done' : ''}">${inner}</span></span>`;
    return Decoration.replace({ widget: new HtmlWidget(html) }).range(lineFrom, lineTo);
  }

  // ── Unordered list: - item / * item / + item
  const ulMatch = /^(\s*)[-*+]\s+(.+)$/.exec(lineText);
  if (ulMatch) {
    const indent = (ulMatch[1] ?? '').length;
    const inner = renderInline(ulMatch[2] ?? '');
    const html =
      `<span class="cm-lp-li" style="padding-left:${indent * 8 + 4}px">` +
      `<span class="cm-lp-bullet">•</span> ${inner}</span>`;
    return Decoration.replace({ widget: new HtmlWidget(html) }).range(lineFrom, lineTo);
  }

  // ── Ordered list: 1. item
  const olMatch = /^(\s*)(\d+)\.\s+(.+)$/.exec(lineText);
  if (olMatch) {
    const indent = (olMatch[1] ?? '').length;
    const num = olMatch[2] ?? '1';
    const inner = renderInline(olMatch[3] ?? '');
    const html =
      `<span class="cm-lp-li" style="padding-left:${indent * 8 + 4}px">` +
      `<span class="cm-lp-bullet">${num}.</span> ${inner}</span>`;
    return Decoration.replace({ widget: new HtmlWidget(html) }).range(lineFrom, lineTo);
  }

  // ── Table separator row: | :--- | :--- |  → hidden spacer
  if (/^\|[\s|:-]+\|$/.test(lineText)) {
    return Decoration.replace({
      widget: new HtmlWidget('<span class="cm-lp-tr-sep"></span>'),
    }).range(lineFrom, lineTo);
  }

  // ── Table data/header row: | cell | cell |
  if (lineText.startsWith('|') && lineText.endsWith('|')) {
    const cells = lineText.split('|').filter((_, i, a) => i > 0 && i < a.length - 1);
    const trClass = isTableHeader ? 'cm-lp-tr cm-lp-tr-header' : 'cm-lp-tr';
    const html =
      `<div class="${trClass}">` +
      cells.map((c) => `<span class="cm-lp-td">${renderInline(c.trim())}</span>`).join('') +
      '</div>';
    return Decoration.replace({ widget: new HtmlWidget(html) }).range(lineFrom, lineTo);
  }

  return null;
}

/**
 * Applies inline patterns to a plain paragraph line.
 * Returns a Decoration.replace Range only if the line actually contains markdown.
 */
function decorateInlineLine(
  lineText: string,
  lineFrom: number,
  lineTo: number
): Range<Decoration> | null {
  if (!/[`*_~!\[]/.test(lineText)) return null;
  const rendered = renderInline(lineText);
  if (rendered === lineText) return null;
  return Decoration.replace({ widget: new HtmlWidget(rendered) }).range(lineFrom, lineTo);
}

// ── ViewPlugin ────────────────────────────────────────────────────────────────

class LivePreviewPlugin {
  decorations: DecorationSet = Decoration.none;
  private lastActiveLine = -1;

  update(update: ViewUpdate): void {
    const activeLineNum = update.state.doc
      .lineAt(update.state.selection.main.head)
      .number;

    if (
      update.docChanged ||
      update.viewportChanged ||
      update.selectionSet ||
      activeLineNum !== this.lastActiveLine
    ) {
      this.lastActiveLine = activeLineNum;
      this.decorations = this.buildDecorations(update.view, activeLineNum);
    }
  }

  private buildDecorations(view: EditorView, activeLine: number): DecorationSet {
    const { state } = view;
    const ranges: Range<Decoration>[] = [];

    // Ranges of FencedCode nodes — content inside is left undecorated
    const fencedRanges = this.getFencedCodeRanges(view);

    // Pre-scan: collect line numbers of GFM table separator rows (| :--- | --- |)
    // Used to detect which table rows are header rows (immediately before a separator).
    const sepLineNums = new Set<number>();
    for (const { from, to } of view.visibleRanges) {
      let pos = from;
      while (pos <= to) {
        const line = state.doc.lineAt(pos);
        if (/^\|[\s|:-]+\|$/.test(line.text)) {
          sepLineNums.add(line.number);
        }
        pos = line.to + 1;
      }
    }

    for (const { from, to } of view.visibleRanges) {
      let pos = from;

      while (pos <= to) {
        const line = state.doc.lineAt(pos);

        // ── Skip: cursor is on this line (show raw syntax)
        if (line.number === activeLine) {
          pos = line.to + 1;
          continue;
        }

        const lineText = line.text;

        // ── Skip: empty line
        if (lineText.trim() === '') {
          pos = line.to + 1;
          continue;
        }

        // ── Fenced code block: render body lines as styled monospace
        const inFence = fencedRanges.some(([s, e]) => line.from >= s && line.to <= e);
        if (inFence) {
          const escaped = escHtml(lineText);
          ranges.push(Decoration.replace({
            widget: new HtmlWidget(`<span class="cm-lp-fence-line">${escaped}</span>`),
          }).range(line.from, line.to));
          pos = line.to + 1;
          continue;
        }

        // ── Fence delimiter line (``` or ~~~): render as language badge or closing bar
        if (/^(`{3,}|~{3,})/.test(lineText)) {
          const langMatch = /^[`~]+(\w*)/.exec(lineText);
          const lang = langMatch?.[1] ?? '';
          const widget = lang
            ? `<span class="cm-lp-fence-open">${escHtml(lang)}</span>`
            : `<span class="cm-lp-fence-delim"></span>`;
          ranges.push(Decoration.replace({ widget: new HtmlWidget(widget) }).range(line.from, line.to));
          pos = line.to + 1;
          continue;
        }

        // ── Try block-level first
        // Pass isTableHeader=true when the NEXT line is a separator row
        const isTableHeader = sepLineNums.has(line.number + 1);
        const blockDeco = decorateBlockLine(lineText, line.from, line.to, isTableHeader);
        if (blockDeco) {
          ranges.push(blockDeco);
          pos = line.to + 1;
          continue;
        }

        // ── Try inline-only
        const inlineDeco = decorateInlineLine(lineText, line.from, line.to);
        if (inlineDeco) {
          ranges.push(inlineDeco);
        }

        pos = line.to + 1;
      }
    }

    // CM6 requires a sorted, non-overlapping RangeSet
    ranges.sort((a, b) => a.from - b.from);
    return Decoration.set(ranges, true);
  }

  /** Collect [from, to] of every FencedCode syntax node in the visible tree. */
  private getFencedCodeRanges(view: EditorView): [number, number][] {
    const tree = syntaxTree(view.state);
    const result: [number, number][] = [];
    tree.iterate({
      enter(node) {
        if (node.name === 'FencedCode') {
          result.push([node.from, node.to]);
        }
      },
    });
    return result;
  }
}

export const livePreviewPlugin = ViewPlugin.fromClass(LivePreviewPlugin, {
  decorations: (v) => v.decorations,
});

// ── Base theme for widget styles ───────────────────────────────────────────────

export const livePreviewTheme = EditorView.baseTheme({
  // The span wrapper that replaces each line's glyphs
  '.cm-lp-widget': {
    display: 'inline-block',
    width: '100%',
    verticalAlign: 'top',
    lineHeight: 'inherit',
  },

  // Headings
  '.cm-lp-heading': {
    display: 'block',
    fontWeight: '700',
    lineHeight: '1.3',
    color: 'var(--text-main)',
  },
  '.cm-lp-h1': { fontSize: '1.75em', marginTop: '0.1em' },
  '.cm-lp-h2': { fontSize: '1.45em', marginTop: '0.1em' },
  '.cm-lp-h3': { fontSize: '1.2em' },
  '.cm-lp-h4': { fontSize: '1.05em' },
  '.cm-lp-h5': { fontSize: '1em', fontWeight: '600' },
  '.cm-lp-h6': { fontSize: '0.9em', fontWeight: '600', color: 'var(--text-muted)' },

  // Horizontal rule
  '.cm-lp-hr': {
    display: 'block',
    border: 'none',
    borderTop: '2px solid var(--border-medium, #ccc)',
    width: '100%',
    margin: '0.1em 0',
  },

  // Blockquote
  '.cm-lp-blockquote': {
    display: 'inline-block',
    width: '100%',
    borderLeft: '3px solid var(--accent-gold, #888)',
    paddingLeft: '0.75em',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    boxSizing: 'border-box',
  },

  // Inline code
  '.cm-lp-code': {
    fontFamily: 'var(--font-mono, monospace)',
    background: 'var(--bg-deep, rgba(0,0,0,0.06))',
    borderRadius: '3px',
    padding: '0.1em 0.3em',
    fontSize: '0.88em',
  },

  // Links
  '.cm-lp-link': {
    color: 'var(--accent-gold)',
    textDecoration: 'underline',
    cursor: 'pointer',
  },

  // Images
  '.cm-lp-img': {
    maxWidth: '100%',
    borderRadius: '4px',
    verticalAlign: 'middle',
  },

  // List items
  '.cm-lp-li': {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.4em',
    width: '100%',
    boxSizing: 'border-box',
  },
  '.cm-lp-bullet': {
    flexShrink: '0',
    color: 'var(--text-muted)',
    userSelect: 'none',
  },
  '.cm-lp-task': {
    alignItems: 'center',
  },
  '.cm-lp-checkbox': {
    flexShrink: '0',
    cursor: 'default',
    pointerEvents: 'none',
  },
  '.cm-lp-done': {
    textDecoration: 'line-through',
    color: 'var(--text-muted)',
  },

  // Table rows and cells — styled to match markdown.css read mode table
  '.cm-lp-tr': {
    display: 'flex',
    width: '100%',
    borderBottom: '1px solid var(--border-subtle)',
    borderLeft: '1px solid var(--border-medium)',
    borderRight: '1px solid var(--border-medium)',
    boxSizing: 'border-box',
  },
  // Header row (immediately before the | --- | separator line)
  '.cm-lp-tr-header': {
    background: 'var(--bg-panel)',
    fontWeight: '600',
    borderTop: '1px solid var(--border-medium)',
    borderRadius: '6px 6px 0 0',
  },
  '.cm-lp-td': {
    flex: '1',
    padding: '0.75rem',    // matches markdown.css th/td padding
    minWidth: '4em',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  '.cm-lp-tr-sep': {
    display: 'none',
  },

  // Fenced code block — styled to match markdown.css read mode pre/code
  '.cm-lp-fence-line': {
    display: 'block',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.875em',          // matches markdown.css pre code font-size
    background: 'var(--bg-panel)', // matches markdown.css pre background (was: --bg-deep)
    padding: '0 1rem',            // matches markdown.css pre padding (was: 0 0.75em)
    width: '100%',
    boxSizing: 'border-box',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    lineHeight: '1.5',            // matches markdown.css pre code line-height
    color: 'var(--text-main)',
    borderLeft: '1px solid var(--border-subtle)',   // side borders to complete the box
    borderRight: '1px solid var(--border-subtle)',
  },
  // Opening fence delimiter — shows language tag; forms the top of the code box
  '.cm-lp-fence-open': {
    display: 'block',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.75em',
    color: 'var(--text-muted)',
    background: 'var(--bg-panel)', // matches markdown.css pre (was: --bg-deep)
    padding: '0.5rem 1rem 0',
    borderRadius: '6px 6px 0 0',  // matches markdown.css pre border-radius
    border: '1px solid var(--border-subtle)', // matches markdown.css pre border
    borderBottom: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  // Closing fence delimiter — forms the bottom of the code box
  '.cm-lp-fence-delim': {
    display: 'block',
    height: '0.75rem',
    background: 'var(--bg-panel)', // was: --bg-deep
    width: '100%',
    borderRadius: '0 0 6px 6px',
    border: '1px solid var(--border-subtle)',
    borderTop: 'none',
    boxSizing: 'border-box',
  },
});
