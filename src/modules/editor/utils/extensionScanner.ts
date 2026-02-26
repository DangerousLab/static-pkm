export function detectRequiredExtensions(markdown: string): Set<'code' | 'table' | 'task' | 'markdown'> {
    const needs = new Set<'code' | 'table' | 'task' | 'markdown'>();

    // tiptap-markdown is always needed for parsing the initial content, but we can still lazy load it!
    needs.add('markdown');

    if (markdown.includes('```')) needs.add('code');
    if (markdown.match(/\|.*\|/)) needs.add('table');
    if (markdown.includes('- [ ]') || markdown.includes('- [x]')) needs.add('task');

    return needs;
}
