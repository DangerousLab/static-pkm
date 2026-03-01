/**
 * fontMetricsCache.ts
 *
 * Measures and caches character widths using an off-screen canvas context.
 * Used by the Layout Oracle to compute text-wrapping synchronously.
 *
 * This is a pure utility module. It does NOT own the canvas element
 * (the Oracle passes the context in) and it does NOT cache per-node data.
 * It caches per-font and per-character data for extreme speed.
 */

// Cache structure: Map<FontDescriptor, Map<char, width>>
const metricsCache = new Map<string, Map<string, number>>();

/**
 * Ensures the cache has an entry for the given font.
 */
function ensureFontCache(font: string): Map<string, number> {
  let cache = metricsCache.get(font);
  if (!cache) {
    cache = new Map<string, number>();
    metricsCache.set(font, cache);
  }
  return cache;
}

/**
 * Get the exact width of a character or word in a specific font.
 *
 * @param text The text to measure.
 * @param font The CSS font string (e.g., "16px 'Inter', sans-serif").
 * @param ctx The 2D rendering context of the Oracle's off-screen canvas.
 * @returns The width in pixels.
 */
export function measureTextWidth(text: string, font: string, ctx: CanvasRenderingContext2D): number {
  if (!text) return 0;

  // Set the context font if it's different from the current
  if (ctx.font !== font) {
    ctx.font = font;
  }

  // Fast path: single character (common case when measuring wrap boundaries)
  if (text.length === 1) {
    const cache = ensureFontCache(font);
    let width = cache.get(text);
    if (width === undefined) {
      width = ctx.measureText(text).width;
      cache.set(text, width);
    }
    return width;
  }

  // Fallback: Measure full string (used for words or short lines)
  // We don't cache full strings here because the combinatorial space is too large.
  // The Oracle caches the final height calculation per block ID instead.
  return ctx.measureText(text).width;
}

/**
 * Pre-warms the cache with common ASCII characters for a given font.
 * Call this once when the application boots or when a new standard font is loaded.
 */
export function warmupFonts(fonts: string[], ctx: CanvasRenderingContext2D): void {
  const commonChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?:;\"'()[]{}<>-=_+*&^%$#@|\\/~`";
  for (const font of fonts) {
    ctx.font = font;
    const cache = ensureFontCache(font);
    for (const char of commonChars) {
      if (!cache.has(char)) {
        cache.set(char, ctx.measureText(char).width);
      }
    }
  }
}
