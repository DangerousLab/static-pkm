import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView, NodeView } from 'prosemirror-view';
import { applyDomCorrection, getHeight } from '../../../core/layout/layoutOracle';

/**
 * BlockNodeView
 * 
 * A vanilla TypeScript ProseMirror NodeView that handles self-correction
 * for block-level nodes.
 * 
 * Architecture:
 * 1. Creates a minimal DOM wrapper.
 * 2. Sets initial min-height from Layout Oracle.
 * 3. Uses ResizeObserver to report actual rendered height back to Oracle.
 * 4. Satisfies Phase 2 mandate to avoid React in the editor performance path.
 */
export class BlockNodeView implements NodeView {
  public dom: HTMLElement;
  public contentDOM: HTMLElement;
  private ro: ResizeObserver;
  private nodeId: string;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) {
    // 1. Create the DOM structure
    // We use a div as the wrapper and let the node's internal content render inside contentDOM
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
        console.log(`[TELEMETRY] [VanillaNodeView] CORRECTION | nodeId=${this.nodeId} type=${node.type.name} oracle=${oracleHeight.toFixed(1)} actual=${actualHeight.toFixed(1)}`);
        applyDomCorrection(this.nodeId, actualHeight);
      }
    });

    this.ro.observe(this.dom);
  }

  // Allow ProseMirror to handle updates normally
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
export function createBlockNodeView() {
  return (props: any) => new BlockNodeView(props.node, props.view, props.getPos);
}
