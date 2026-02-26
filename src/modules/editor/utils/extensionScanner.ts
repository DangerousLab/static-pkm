import type { BlockType } from '@/types/blockstore';

type ExtensionKey = 'code' | 'table' | 'task' | 'markdown';

export function detectRequiredExtensions(markdown: string): Set<ExtensionKey> {
    const needs = new Set<ExtensionKey>();

    // tiptap-markdown is always needed for parsing the initial content, but we can still lazy load it!
    needs.add('markdown');

    if (markdown.includes('```')) needs.add('code');
    if (markdown.match(/\|.*\|/)) needs.add('table');
    if (markdown.includes('- [ ]') || markdown.includes('- [x]')) needs.add('task');

    return needs;
}

/**
 * Detect required extensions from ALL block types in the full document.
 *
 * The `DocumentHandle.blocks` array contains block-type metadata for every
 * block in the file — not just the initial viewport window. Using this ensures
 * that `CodeBlockLowlight` and the Table extensions are always registered at
 * mount time, even when the initial viewport contains only plain paragraphs.
 *
 * Tasks are detected inline within paragraphs via `detectRequiredExtensions`,
 * which continues to scan the visible markdown for `- [ ]` / `- [x]` syntax.
 */
export function detectFromBlockTypes(blockTypes: BlockType[]): Set<ExtensionKey> {
    const needs = new Set<ExtensionKey>();
    needs.add('markdown');

    for (const bt of blockTypes) {
        if (bt === 'codeFence') needs.add('code');
        if (bt === 'table') needs.add('table');
    }

    return needs;
}
