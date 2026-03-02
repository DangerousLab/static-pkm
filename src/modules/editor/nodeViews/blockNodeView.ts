import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView, NodeView } from 'prosemirror-view';
import { applyDomCorrection, getHeight } from '../../../core/layout/layoutOracle';

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
    
    // The contentDOM is where ProseMirror will render the actual content of the node
    this.contentDOM = document.createElement(node.type.name === 'paragraph' ? 'p' : 'pre');
    this.dom.appendChild(this.contentDOM);

    // 2. Identify the nodeId (top-level index correlation)
    const pos = getPos();
    const nodeIndex = typeof pos === 'number' ? view.state.doc.content.cut(0, pos).childCount : 0;
    this.nodeId = String(nodeIndex);

    // 3. Apply initial height from Oracle
    const initialHeight = getHeight(this.nodeId);
    if (initialHeight) {
      this.dom.style.minHeight = `${initialHeight}px`;
    }

    // 4. Setup ResizeObserver for self-correction
    this.ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      
      const actualHeight = entry.contentRect.height;
      const oracleHeight = getHeight(this.nodeId) ?? 0;

      if (Math.abs(actualHeight - oracleHeight) > 2) {
        console.log(`[TELEMETRY] [VanillaNodeView] CORRECTION | noteId=${this.noteId} nodeId=${this.nodeId} type=${node.type.name} oracle=${oracleHeight.toFixed(1)} actual=${actualHeight.toFixed(1)}`);
        applyDomCorrection(this.noteId, this.nodeId, actualHeight);
      }
    });

    this.ro.observe(this.dom);
  }

  update(node: ProseMirrorNode) {
    return node.type.name === this.contentDOM.nodeName.toLowerCase() || 
           (node.type.name === 'paragraph' && this.contentDOM.nodeName === 'P') ||
           (node.type.name === 'codeBlock' && this.contentDOM.nodeName === 'PRE');
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
