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

    // 2. CodeBlock Lowlight
    if (requirements.has('code')) {
        const [{ default: CodeBlockLowlight }, { common, createLowlight }] = await Promise.all([
            import('@tiptap/extension-code-block-lowlight'),
            import('lowlight')
        ]);
        const lowlight = createLowlight(common);
        loaded.push(CodeBlockLowlight.configure({ lowlight }));
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
