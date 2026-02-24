// src/lib/syntax/cmHighlight.ts
// CM6 syntax highlighting extension using project CSS variable color tokens.
// Import this in EditView.tsx and SourceView.tsx and add to the extensions array.

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * Maps CM6/Lezer highlight tags to --code-* CSS custom properties.
 * Values are hardcoded strings that reference CSS variables so they
 * respond to theme toggling automatically via the cascade.
 */
export const unstablonHighlightStyle = HighlightStyle.define([
  // ── Code-related (programming languages) ────────────────────────────────
  { tag: t.keyword,                       color: 'var(--code-keyword)' },
  { tag: t.string,                        color: 'var(--code-string)' },
  { tag: t.number,                        color: 'var(--code-number)' },
  { tag: t.comment,                       color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)],
                                          color: 'var(--code-function)' },
  { tag: [t.typeName, t.className, t.namespace],
                                          color: 'var(--code-type)' },
  { tag: t.operator,                      color: 'var(--code-operator)' },
  { tag: t.standard(t.variableName),      color: 'var(--code-builtin)' },
  { tag: t.variableName,                  color: 'var(--code-variable)' },
  { tag: t.attributeName,                 color: 'var(--code-attr)' },
  { tag: t.punctuation,                   color: 'var(--code-punctuation)' },
  { tag: t.tagName,                       color: 'var(--code-tag)' },
  { tag: t.self,                          color: 'var(--code-keyword)' },
  { tag: t.bool,                          color: 'var(--code-number)' },
  { tag: t.null,                          color: 'var(--code-number)' },
  { tag: t.atom,                          color: 'var(--code-number)' },
  { tag: t.regexp,                        color: 'var(--code-string)' },
  { tag: t.escape,                        color: 'var(--code-string)' },

  // ── Markdown-specific (Source mode) ──────────────────────────────────────

  // Headings: # Header text
  { tag: t.heading1,                      color: 'var(--code-keyword)', fontWeight: 'bold' },
  { tag: t.heading2,                      color: 'var(--code-keyword)', fontWeight: 'bold' },
  { tag: t.heading3,                      color: 'var(--code-keyword)', fontWeight: 'bold' },
  { tag: t.heading4,                      color: 'var(--code-keyword)', fontWeight: 'bold' },
  { tag: t.heading5,                      color: 'var(--code-keyword)', fontWeight: 'bold' },
  { tag: t.heading6,                      color: 'var(--code-keyword)', fontWeight: 'bold' },
  { tag: t.heading,                       color: 'var(--code-keyword)', fontWeight: 'bold' },

  // Emphasis: *italic* and **bold**
  { tag: t.emphasis,                      fontStyle: 'italic' },
  { tag: t.strong,                        fontWeight: 'bold' },
  { tag: t.strikethrough,                 textDecoration: 'line-through' },

  // Links: [text](url) and ![alt](src)
  { tag: t.link,                          color: 'var(--code-function)', textDecoration: 'underline' },
  { tag: t.url,                           color: 'var(--code-string)' },

  // Quotes: > blockquote text
  { tag: t.quote,                         color: 'var(--code-comment)', fontStyle: 'italic' },

  // Lists: - item, 1. item
  { tag: t.list,                          color: 'var(--code-operator)' },

  // Code: `inline` and ``` fenced
  { tag: t.monospace,                     fontFamily: 'var(--font-mono, monospace)' },

  // Markdown meta characters (# * - ` etc)
  { tag: t.processingInstruction,         color: 'var(--code-comment)' },
  { tag: t.meta,                          color: 'var(--code-comment)' },

  // Content info (language in fenced code)
  { tag: t.contentSeparator,              color: 'var(--code-punctuation)' },
  { tag: t.labelName,                     color: 'var(--code-attr)' },
]);

/** Drop-in CM6 extension. Add to EditView/SourceView extensions array. */
export const unstablonSyntaxHighlighting = syntaxHighlighting(unstablonHighlightStyle);
