import { Extension, Node, Mark } from '@tiptap/core';

export async function loadExtensions(requirements: Set<string>): Promise<(Extension | Node | Mark)[]> {
    const loaded: (Extension | Node | Mark)[] = [];

    // 1. Tiptap Markdown (Required for parsing)
    if (requirements.has('markdown')) {
        const { Markdown } = await import('tiptap-markdown');
        loaded.push(Markdown.configure({
            html: true, tightLists: true, bulletListMarker: '-',
            linkify: true, breaks: true, transformPastedText: true, transformCopiedText: true,
        }));
    }

    // 2. CodeBlock Shiki (Asynchronous highlight injection)
    if (requirements.has('code')) {
        const { DeferredCodeBlockShiki } = await import('../extensions/DeferredCodeBlockShiki');

        loaded.push(DeferredCodeBlockShiki.configure({
            defaultTheme: 'github-dark', // Base generic fallback
            themes: {
                // These must map closely to the app's CSS theme variables
                // Since our app uses explicit tokens, we can use clean shiki themes
                light: 'github-light',
                dark: 'github-dark',
            },
        }));
    }

    // 3. Tables
    if (requirements.has('table')) {
        const [
            { Table }, { default: TableRow }, { default: TableCell }, { default: TableHeader }
        ] = await Promise.all([
            import('@tiptap/extension-table'),
            import('@tiptap/extension-table-row'),
            import('@tiptap/extension-table-cell'),
            import('@tiptap/extension-table-header')
        ]);
        loaded.push(Table.configure({ resizable: true }), TableRow, TableCell, TableHeader);
    }

    // 4. Task Lists
    if (requirements.has('task')) {
        const [{ default: TaskList }, { default: TaskItem }] = await Promise.all([
            import('@tiptap/extension-task-list'),
            import('@tiptap/extension-task-item')
        ]);
        loaded.push(TaskList, TaskItem.configure({ nested: true }));
    }

    return loaded;
}
