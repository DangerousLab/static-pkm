/**
 * nodeMeasurers.ts
 *
 * Pure layout formulas for estimating the pixel height of different NodeTypes
 * before any DOM paint.
 *
 * This module knows NOTHING about React, the DOM (except the provided Canvas
 * context), or application state. It only takes a NodeManifest, a configuration
 * object, and the available width, and returns a number.
 */

import type { NodeManifest, LayoutOracleConfig } from '../../types/layout';
import { measureTextWidth } from './fontMetricsCache';

// ── Shared Helpers ─────────────────────────────────────────────────────────────

/**
 * Calculates how many lines of text will be produced when wrapping `text`
 * within `containerWidth`.
 */
function calculateWrappedLines(
  text: string,
  font: string,
  containerWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  if (!text) return 1; // Empty paragraphs still take up one line height
  if (containerWidth <= 0) return 1;

  let totalLines = 0;
  const rawLines = text.split('\n'); // Split explicitly authored newlines

  for (const rawLine of rawLines) {
    if (rawLine.trim() === '') {
      totalLines += 1;
      continue;
    }

    const words = rawLine.split(/(\s+)/); // Keep whitespace as separate tokens for accurate wrapping
    let currentLineWidth = 0;
    let linesForThisRawLine = 1;

    for (const word of words) {
      const wordWidth = measureTextWidth(word, font, ctx);

      if (currentLineWidth + wordWidth > containerWidth) {
        // If the word itself is wider than the container, it will force a break mid-word
        // but for estimation purposes, we just count it as forcing a new line.
        if (currentLineWidth > 0) {
          linesForThisRawLine += 1;
          currentLineWidth = wordWidth;
        } else {
          // A single massive word on a new line that overflows.
          // Rough estimate: how many times does it wrap?
          const overflowLines = Math.ceil(wordWidth / containerWidth);
          linesForThisRawLine += overflowLines;
          // currentLineWidth is irrelevant because it already wrapped multiple times
          currentLineWidth = 0; 
        }
      } else {
        currentLineWidth += wordWidth;
      }
    }
    totalLines += linesForThisRawLine;
  }

  return totalLines;
}

// ── Node-Specific Measurers ────────────────────────────────────────────────────

function measureParagraph(
  manifest: NodeManifest,
  config: LayoutOracleConfig,
  containerWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  const font = manifest.fontOverride || `${config.baseFontSize}px ${config.defaultFont}`;
  const lineHeightPx = config.baseFontSize * config.baseLineHeight;
  const wrappedLines = calculateWrappedLines(manifest.textContent, font, containerWidth, ctx);
  
  // TipTap/ProseMirror paragraphs usually have no margin (reset in our CSS)
  return wrappedLines * lineHeightPx;
}

function measureHeading(
  manifest: NodeManifest,
  config: LayoutOracleConfig,
  containerWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  const level = manifest.level || 1;
  const scaleIndex = Math.min(Math.max(level - 1, 0), 5); // 0-5 for H1-H6
  const scaleMultiplier = config.headingScales[scaleIndex] || 1.0;
  
  const fontSize = config.baseFontSize * scaleMultiplier;
  const font = manifest.fontOverride || `600 ${fontSize}px ${config.defaultFont}`; // Bold headings
  const lineHeightPx = fontSize * 1.3; // Standard heading line height

  const wrappedLines = calculateWrappedLines(manifest.textContent, font, containerWidth, ctx);
  
  // Margins derived from tiptap.css/markdown.css logic
  // e.g., H1: 1.5em top, 0.5em bottom
  const marginTop = fontSize * 1.5;
  const marginBottom = fontSize * 0.5;

  return (wrappedLines * lineHeightPx) + marginTop + marginBottom;
}

function measureCodeBlock(
  manifest: NodeManifest,
  config: LayoutOracleConfig,
): number {
  const lineCount = manifest.lineCount || 1;
  const lineHeightPx = config.baseFontSize * config.codeLineHeight;
  
  // Padding: 0.75rem top/bottom (12px * 2) + 2px borders
  const paddingAndBorder = 26; 

  // Code blocks use overflow-x: auto, so they don't wrap based on containerWidth.
  return (lineCount * lineHeightPx) + paddingAndBorder;
}

function measureTable(
  manifest: NodeManifest,
): number {
  // We use the raw line count from the Rust lexer.
  // Tables use overflow-x: auto and don't wrap.
  const rows = manifest.lineCount || 2; 
  const estimatedRowHeightPx = 36; // 1rem text + 0.5rem padding top/bottom + borders
  const margins = 32; // 1rem top/bottom margin

  return (rows * estimatedRowHeightPx) + margins;
}

function measureList(
  manifest: NodeManifest,
  config: LayoutOracleConfig,
  containerWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  const font = manifest.fontOverride || `${config.baseFontSize}px ${config.defaultFont}`;
  const lineHeightPx = config.baseFontSize * config.baseLineHeight;
  
  // Lists have indentation, reducing the wrap container width
  const indentPx = 24; 
  const availableWidth = Math.max(containerWidth - indentPx, 100);

  const wrappedLines = calculateWrappedLines(manifest.textContent, font, availableWidth, ctx);
  
  // Margin: 0.5rem top/bottom (8px * 2) = 16px
  const margins = 16;

  return (wrappedLines * lineHeightPx) + margins;
}

function measureBlockquote(
  manifest: NodeManifest,
  config: LayoutOracleConfig,
  containerWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  const font = manifest.fontOverride || `${config.baseFontSize}px ${config.defaultFont}`;
  const lineHeightPx = config.baseFontSize * config.baseLineHeight;
  
  // Blockquotes have left padding + border
  const indentPx = 20; 
  const availableWidth = Math.max(containerWidth - indentPx, 100);

  const wrappedLines = calculateWrappedLines(manifest.textContent, font, availableWidth, ctx);
  
  // Margin: 1rem top/bottom (16px * 2) = 32px
  const margins = 32;

  return (wrappedLines * lineHeightPx) + margins;
}

function measureImage(
  manifest: NodeManifest,
  containerWidth: number
): number {
  if (manifest.imageDimensions) {
    const [w, h] = manifest.imageDimensions;
    if (w > 0) {
      // Aspect ratio scaling
      return (h / w) * containerWidth;
    }
  }
  // Placeholder height until image loads and NodeView triggers ResizeObserver
  return 300; 
}

// ── Main Dispatcher ────────────────────────────────────────────────────────────

/**
 * Given a generic block manifest from Rust, estimate its rendered height in pixels.
 *
 * @param manifest The block metadata from Rust.
 * @param config The global Oracle configuration.
 * @param containerWidth The available width for text wrapping (clamped > 100px).
 * @param ctx The off-screen canvas context for measuring fonts.
 */
export function measureNode(
  manifest: NodeManifest,
  config: LayoutOracleConfig,
  containerWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  const safeWidth = Math.max(containerWidth, 100);

  switch (manifest.nodeType) {
    case 'paragraph':
      return measureParagraph(manifest, config, safeWidth, ctx);
    case 'heading':
      return measureHeading(manifest, config, safeWidth, ctx);
    case 'codeBlock':
      return measureCodeBlock(manifest, config);
    case 'table':
      return measureTable(manifest);
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return measureList(manifest, config, safeWidth, ctx);
    case 'blockquote':
      return measureBlockquote(manifest, config, safeWidth, ctx);
    case 'horizontalRule':
      return 33; // Fixed height (border + margins)
    case 'image':
      return measureImage(manifest, safeWidth);
    case 'computeEmbed':
      return 200; // Skeleton height. Actual height will be reported by ResizeObserver post-execution.
    case 'mathBlock':
      return 80; // Skeleton height for unrendered LaTeX. ResizeObserver will correct this.
    case 'frontmatter':
      return 0; // Frontmatter is usually hidden in the editor, or handled specially.
    default:
      // Fallback
      return measureParagraph(manifest, config, safeWidth, ctx);
  }
}
