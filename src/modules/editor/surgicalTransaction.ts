/**
 * surgicalTransaction
 *
 * Surgical ProseMirror transactions for the Persistent Window Architecture.
 *
 * Instead of calling setContent() — which replaces the entire document and
 * forces ProseMirror to rebuild all 300+ DOM nodes — these helpers dispatch
 * two separate targeted transactions that only touch ONE end of the document
 * each, preserving the surviving nodes' DOM elements completely.
 *
 * Root cause of the old stutter:
 *   setContent() → tr.replaceRangeWith(0, doc.content.size, newDoc)
 *   ProseMirror's updateChildren() calls preMatch() which walks backwards
 *   from the END using `===` identity checks. Since the new doc is freshly
 *   parsed, no nodes match — ProseMirror destroys and recreates ALL nodes.
 *
 * Why a single transaction with delete+insert also fails:
 *   With delete(0,X) + insert(end, fragment) in one tr, the resulting doc
 *   is [Surviving..., Added...] while the DOM has [Removed..., Surviving...].
 *   preMatch compares from the end: Surviving_m vs Added_n → MISMATCH →
 *   breaks with 0 matches. findNodeMatch only scans 5 children forward, so
 *   it cannot locate surviving nodes shifted by 50+ positions. Full rebuild.
 *
 * Two-dispatch approach (implemented here):
 *   Dispatch 1 changes only ONE end → preMatch or forward-scan matches ALL
 *   surviving nodes by `===` identity. Dispatch 2 then adds the other end.
 *   Each dispatch touches only the nodes that actually changed.
 *
 *   CASE A (down): dispatch delete-top → preMatch matches all surviving from
 *                  end. dispatch insert-bottom → forward scan matches all.
 *   CASE B (up):   dispatch delete-bottom → forward scan matches all surviving.
 *                  dispatch insert-top → preMatch matches all from end.
 *
 * @module surgicalTransaction
 */

import type { Editor } from '@tiptap/core';
import { DOMParser as PMDOMParser, Fragment } from '@tiptap/pm/model';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { BlockContent } from '@/types/blockstore';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Parse an array of BlockContent items into a ProseMirror Fragment,
 * replicating exactly the two-step pipeline that setContent() uses:
 *
 *   1. editor.storage.markdown.parser.parse(markdown) → HTML string
 *      (tiptap-markdown: markdown-it render + DOM normalization)
 *   2. PMDOMParser.fromSchema(schema).parse(element) → PM doc Node
 *   3. Extract doc.content → Fragment of top-level nodes
 *
 * This guarantees identical output to setContent() for the same markdown.
 *
 * @param editor  The Tiptap editor (provides schema + markdown parser)
 * @param blocks  Block content items to parse
 * @returns       A Fragment of top-level ProseMirror nodes
 */
export function parseBlocksToFragment(
  editor: Editor,
  blocks: BlockContent[],
): Fragment {
  if (blocks.length === 0) return Fragment.empty;

  const markdown = blocks.map((b) => b.markdown).join('\n\n');

  // Step 1: markdown → HTML string via tiptap-markdown parser
  const storage = editor.storage as {
    markdown?: { parser: { parse: (content: string) => string } };
  };
  const parser = storage.markdown?.parser;
  if (!parser) {
    throw new Error('[surgicalTransaction] tiptap-markdown parser not in editor.storage');
  }
  const html = parser.parse(markdown);

  // Step 2: HTML string → ProseMirror doc node
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  const pmParser = PMDOMParser.fromSchema(editor.schema);
  const doc = pmParser.parse(wrapper);

  // Step 3: Return the content fragment (strip the outer doc wrapper)
  return doc.content;
}

/**
 * Compute the position just after the first `count` top-level nodes of `doc`.
 *
 * ProseMirror positions for a document's direct children:
 *   - Position 0: just inside the doc (before first child)
 *   - Each top-level node occupies `node.nodeSize` positions
 *   - Position doc.content.size: just inside the doc (after last child)
 *
 * @param doc    The ProseMirror doc node to measure
 * @param count  Number of top-level children to skip past
 * @returns      The position immediately after the `count`-th child
 */
function posAfterTopLevelNodes(doc: PMNode, count: number): number {
  let pos = 0;
  const childCount = doc.content.childCount;
  const n = Math.min(count, childCount);
  for (let i = 0; i < n; i++) {
    pos += doc.content.child(i).nodeSize;
  }
  return pos;
}

// ── Surgical shift functions ───────────────────────────────────────────────────

/**
 * Surgical viewport shift for downward scrolling (CASE A).
 *
 * Removes `removeCount` top-level nodes from the beginning of the document
 * and appends `addedFragment` at the end. Surviving nodes in the middle are
 * never touched — their DOM elements remain completely intact.
 *
 * Uses two separate dispatches so ProseMirror's view updater only sees ONE
 * changed end per cycle:
 *
 *   Dispatch 1 — delete(0, endOfRemoved):
 *     New doc has [Surviving...]. Old DOM has [Removed..., Surviving...].
 *     preMatch walks backward from end: Surviving_m === Surviving_m → all
 *     surviving nodes match by identity. Only removed nodes are destroyed.
 *
 *   Dispatch 2 — insert(docEnd, addedFragment):
 *     New doc has [Surviving..., Added...]. DOM now has [Surviving...].
 *     Forward scan: Surviving_1 === Surviving_1 → all match. Only added
 *     nodes are created fresh.
 *
 * @param editor         Tiptap editor instance
 * @param removeCount    Number of top-level nodes to remove from the start
 * @param addedFragment  Fragment of new top-level nodes to append at the end
 */
export function shiftViewportDown(
  editor: Editor,
  removeCount: number,
  addedFragment: Fragment,
): void {
  let del1Ms = 0;
  let ins2Ms = 0;

  // Dispatch 1: Delete from the top.
  // preMatch (backward from end) matches all surviving nodes by === identity.
  if (removeCount > 0) {
    const tr1 = editor.state.tr;
    const deleteEndPos = posAfterTopLevelNodes(editor.state.doc, removeCount);
    if (deleteEndPos > 0) {
      tr1.delete(0, deleteEndPos);
      tr1.setMeta('addToHistory', false);
      tr1.setMeta('viewportShift', true);
      const d1s = performance.now();
      editor.view.dispatch(tr1);
      del1Ms = performance.now() - d1s;
    }
  }

  // Dispatch 2: Insert at the bottom.
  // editor.state now reflects the post-delete document.
  // Forward scan matches all surviving nodes by === identity.
  if (addedFragment.childCount > 0) {
    const tr2 = editor.state.tr;
    tr2.insert(tr2.doc.content.size, addedFragment);
    tr2.setMeta('addToHistory', false);
    tr2.setMeta('viewportShift', true);
    const d2s = performance.now();
    editor.view.dispatch(tr2);
    ins2Ms = performance.now() - d2s;
  }

  console.log(
    `[DEBUG] [ST] shiftDown | del=${del1Ms.toFixed(1)}ms ins=${ins2Ms.toFixed(1)}ms`,
  );
}

/**
 * Surgical viewport shift for upward scrolling (CASE B).
 *
 * Inserts `addedFragment` at the beginning of the document and removes
 * `removeCount` top-level nodes from the end. Surviving nodes in the middle
 * are never touched — their DOM elements remain completely intact.
 *
 * Uses two separate dispatches so ProseMirror's view updater only sees ONE
 * changed end per cycle:
 *
 *   Dispatch 1 — delete(deleteStart, docEnd):
 *     New doc has [Surviving...]. Old DOM has [Surviving..., Removed...].
 *     Forward scan: Surviving_1 === Surviving_1 → all match by identity.
 *     Only removed nodes at the end are destroyed.
 *
 *   Dispatch 2 — insert(0, addedFragment):
 *     New doc has [Added..., Surviving...]. DOM now has [Surviving...].
 *     preMatch walks backward from end: Surviving_m === Surviving_m → all
 *     surviving nodes match. Only added nodes at the top are created fresh.
 *
 * @param editor         Tiptap editor instance
 * @param addedFragment  Fragment of new top-level nodes to prepend at the start
 * @param removeCount    Number of top-level nodes to remove from the end
 */
export function shiftViewportUp(
  editor: Editor,
  addedFragment: Fragment,
  removeCount: number,
): void {
  let del1Ms = 0;
  let ins2Ms = 0;

  // Dispatch 1: Delete from the bottom.
  // Forward scan matches all surviving nodes by === identity.
  if (removeCount > 0) {
    const tr1 = editor.state.tr;
    const totalChildren = editor.state.doc.content.childCount;
    const keepCount = totalChildren - removeCount;

    if (keepCount >= 0) {
      const deleteStartPos = posAfterTopLevelNodes(editor.state.doc, keepCount);
      const deleteEndPos = editor.state.doc.content.size;

      if (deleteStartPos < deleteEndPos) {
        tr1.delete(deleteStartPos, deleteEndPos);
        tr1.setMeta('addToHistory', false);
        tr1.setMeta('viewportShift', true);
        const d1s = performance.now();
        editor.view.dispatch(tr1);
        del1Ms = performance.now() - d1s;
      }
    }
  }

  // Dispatch 2: Insert at the top.
  // editor.state now reflects the post-delete document.
  // preMatch (backward from end) matches all surviving nodes by === identity.
  if (addedFragment.childCount > 0) {
    const tr2 = editor.state.tr;
    tr2.insert(0, addedFragment);
    tr2.setMeta('addToHistory', false);
    tr2.setMeta('viewportShift', true);
    const d2s = performance.now();
    editor.view.dispatch(tr2);
    ins2Ms = performance.now() - d2s;
  }

  console.log(
    `[DEBUG] [ST] shiftUp | del=${del1Ms.toFixed(1)}ms ins=${ins2Ms.toFixed(1)}ms`,
  );
}
