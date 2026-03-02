/**
 * nodeMeasurers.ts
 *
 * Pure layout formulas for dictating the exact pixel height of different NodeTypes
 * before any DOM paint.
 *
 * The Layout Dictator is the Single Source of Truth for geometry.
 */

import type { NodeManifest, LayoutDictatorConfig } from '../../types/layout';
import { measureTextWidth } from './fontMetricsCache';

// ── Shared Helpers ─────────────────────────────────────────────────────────────

function calculateWrappedLines(
  text: string,
  font: string,
  containerWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  if (!text) return 1;
  if (containerWidth <= 0) return 1;

  let totalLines = 0;
  const rawLines = text.split('\n');

  for (const rawLine of rawLines) {
    if (rawLine.trim() === '') {
      totalLines += 1;
      continue;
    }

    const words = rawLine.split(/(\s+)/);
    let currentLineWidth = 0;
    let linesForThisRawLine = 1;

    for (const word of words) {
      const wordWidth = measureTextWidth(word, font, ctx);

      if (currentLineWidth + wordWidth > containerWidth) {
        if (currentLineWidth > 0) {
          linesForThisRawLine += 1;
          currentLineWidth = wordWidth;
        } else {
          const overflowLines = Math.ceil(wordWidth / containerWidth);
          linesForThisRawLine += overflowLines;
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
  config: LayoutDictatorConfig,
  containerWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  const font = manifest.fontOverride || `${config.paragraph.fontSize}px ${config.defaultFont}`;
  const wrappedLines = calculateWrappedLines(manifest.textContent.trim(), font, containerWidth, ctx);
  
  return (wrappedLines * config.paragraph.lineHeight) + config.paragraph.marginTop + config.paragraph.marginBottom;
}

function measureHeading(
  manifest: NodeManifest,
  config: LayoutDictatorConfig,
  containerWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  const level = manifest.level || 1;
  const typeKey = `heading${Math.min(Math.max(level, 1), 6)}` as keyof LayoutDictatorConfig;
  const metrics = config[typeKey] as any; // Using any to index into BlockTypography
  
  const font = manifest.fontOverride || `600 ${metrics.fontSize}px ${config.defaultFont}`;
  const wrappedLines = calculateWrappedLines(manifest.textContent.trim(), font, containerWidth, ctx);
  
  return (wrappedLines * metrics.lineHeight) + metrics.marginTop + metrics.marginBottom;
}

function measureCodeBlock(
  manifest: NodeManifest,
  config: LayoutDictatorConfig,
): number {
  const lineCount = manifest.lineCount || 1;
  const padding = (config.codeBlock.paddingTop || 0) + (config.codeBlock.paddingBottom || 0);
  const borders = (config.codeBlock.borderWidth || 0) * 2;
  
  return (lineCount * config.codeBlock.lineHeight) + config.codeBlock.marginTop + config.codeBlock.marginBottom + padding + borders;
}

function measureTable(
  manifest: NodeManifest,
  config: LayoutDictatorConfig,
): number {
  const rows = manifest.lineCount || 2; 
  return (rows * config.table.rowHeight) + config.table.margins;
}

function measureList(
  manifest: NodeManifest,
  config: LayoutDictatorConfig,
  containerWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  const font = manifest.fontOverride || `${config.list.fontSize}px ${config.defaultFont}`;
  // Lists have indentation, reducing the wrap container width
  const indentPx = 24; 
  const availableWidth = Math.max(containerWidth - indentPx, 100);

  const wrappedLines = calculateWrappedLines(manifest.textContent.trim(), font, availableWidth, ctx);
  
  return (wrappedLines * config.list.lineHeight) + config.list.marginTop + config.list.marginBottom;
}

function measureBlockquote(
  manifest: NodeManifest,
  config: LayoutDictatorConfig,
  containerWidth: number,
  ctx: CanvasRenderingContext2D
): number {
  const font = manifest.fontOverride || `${config.blockquote.fontSize}px ${config.defaultFont}`;
  const indentPx = 20; 
  const availableWidth = Math.max(containerWidth - indentPx, 100);

  const wrappedLines = calculateWrappedLines(manifest.textContent.trim(), font, availableWidth, ctx);
  
  return (wrappedLines * config.blockquote.lineHeight) + config.blockquote.marginTop + config.blockquote.marginBottom;
}

function measureImage(
  manifest: NodeManifest,
  containerWidth: number
): number {
  if (manifest.imageDimensions) {
    const [w, h] = manifest.imageDimensions;
    if (w > 0) return (h / w) * containerWidth;
  }
  return 300; 
}

// ── Main Dispatcher ────────────────────────────────────────────────────────────

export function measureNode(
  manifest: NodeManifest,
  config: LayoutDictatorConfig,
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
      return measureTable(manifest, config);
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return measureList(manifest, config, safeWidth, ctx);
    case 'blockquote':
      return measureBlockquote(manifest, config, safeWidth, ctx);
    case 'horizontalRule':
      return 33;
    case 'image':
      return measureImage(manifest, safeWidth);
    case 'computeEmbed':
      return 200;
    case 'mathBlock':
      return 80;
    case 'frontmatter':
      return 0;
    default:
      return measureParagraph(manifest, config, safeWidth, ctx);
  }
}
