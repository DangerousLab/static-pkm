// src/lib/syntax/highlightTheme.ts
// Utility: applies highlight.js to code blocks in rendered HTML.
// Called inside markdownParser.ts before DOMPurify sanitization.

import hljs from 'highlight.js';

/** highlight.js is imported for side effects (language registration) only here. */
export { hljs };

/**
 * Apply syntax highlighting to a raw HTML string containing <pre><code> blocks.
 * Called inside markdownParser.ts before DOMPurify sanitization.
 *
 * IMPORTANT: Call this on a DOM fragment, not raw HTML strings, to avoid
 * regex-based HTML manipulation. Use a temporary div.
 */
export function highlightCodeBlocks(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  div.querySelectorAll<HTMLElement>('pre code').forEach((block) => {
    // If the code block has a language class (class="language-python"), use it.
    // Otherwise attempt auto-detection.
    const langClass = Array.from(block.classList).find(c => c.startsWith('language-'));
    const lang = langClass ? langClass.replace('language-', '') : null;

    if (lang && hljs.getLanguage(lang)) {
      const result = hljs.highlight(block.textContent ?? '', { language: lang, ignoreIllegals: true });
      block.innerHTML = result.value;
    } else {
      // Auto-detect
      const result = hljs.highlightAuto(block.textContent ?? '');
      block.innerHTML = result.value;
    }
    block.classList.add('hljs');
  });

  return div.innerHTML;
}
