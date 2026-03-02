import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView, NodeView } from 'prosemirror-view';
import { applyDomCorrection, getHeight } from '../../../core/layout/layoutDictator';

/**
 * BlockNodeView
 * 
 * A vanilla TypeScript ProseMirror NodeView that handles self-correction
 * for block-level nodes.
 */
export class BlockNodeView implements NodeView {
  public dom: HTMLElement;
  public contentDOM: HTMLElement;
  private ro: ResizeObserver;
  private nodeId: string;
  private noteId: string;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined, noteId: string) {
    this.noteId = noteId;
    
    // 1. Create the DOM structure
    this.dom = document.createElement('div');
    this.dom.className = `block-node block-node-${node.type.name}`;
    
    // 2. Resolve the correct semantic tag
    let tagName = 'div';
    if (node.type.name === 'paragraph') {
      tagName = 'p';
    } else if (node.type.name === 'codeBlock') {
      tagName = 'pre';
    } else if (node.type.name === 'heading') {
      const level = node.attrs.level || 1;
      tagName = `h${level}`;
    }
    
    this.contentDOM = document.createElement(tagName);
    this.dom.appendChild(this.contentDOM);

    // 3. Identify the nodeId (top-level index correlation)
    const pos = getPos();
    const nodeIndex = typeof pos === 'number' ? view.state.doc.content.cut(0, pos).childCount : 0;
    this.nodeId = String(nodeIndex);

    // 4. Apply initial height from Dictator
    const initialHeight = getHeight(this.nodeId);
    if (initialHeight) {
      // The Dictator dictates exact geometry. We do not use min-height for
      // text blocks, because the Canvas measurement is absolute.
      this.dom.style.height = `${initialHeight}px`;
      this.dom.style.overflow = 'hidden'; // Ensure content doesn't break out
    }

    // 5. Setup ResizeObserver for self-correction
    this.ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      
      const actualHeight = entry.contentRect.height;
      const dictatorHeight = getHeight(this.nodeId) ?? 0;

      if (Math.abs(actualHeight - dictatorHeight) > 2) {
        console.log(`[TELEMETRY] [VanillaNodeView] CORRECTION | noteId=${this.noteId} nodeId=${this.nodeId} type=${node.type.name} dictator=${dictatorHeight.toFixed(1)} actual=${actualHeight.toFixed(1)}`);
        applyDomCorrection(this.noteId, this.nodeId, actualHeight);
      }
    });

    this.ro.observe(this.dom);
  }

  update(node: ProseMirrorNode) {
    // Check if the node type or heading level has changed
    let expectedTag = 'DIV';
    if (node.type.name === 'paragraph') expectedTag = 'P';
    else if (node.type.name === 'codeBlock') expectedTag = 'PRE';
    else if (node.type.name === 'heading') expectedTag = `H${node.attrs.level || 1}`;

    if (node.type.name !== this.dom.className.replace('block-node block-node-', '') || 
        this.contentDOM.tagName !== expectedTag) {
      return false; // Force re-mount if structure changed
    }
    
    return true; 
  }

  destroy() {
    this.ro.disconnect();
  }
}

/**
 * Factory function for TipTap extension registration
 */
export function createBlockNodeView(noteId: string) {
  return (props: { node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined }) => 
    new BlockNodeView(props.node, props.view, props.getPos, noteId);
}
