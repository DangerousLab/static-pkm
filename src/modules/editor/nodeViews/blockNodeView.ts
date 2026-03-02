import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView, NodeView } from 'prosemirror-view';
import { applyDomCorrection, getHeight } from '../../../core/layout/layoutDictator';
import { getWindowStartBlock } from '../../../core/layout/dictatorCoordinator';

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
    
    // 2. Resolve the correct semantic tag and metrics
    let tagName = 'div';
    let mt = 0;
    let mb = 0;

    if (node.type.name === 'paragraph') {
      tagName = 'p';
      mt = 0; mb = 0;
    } else if (node.type.name === 'codeBlock') {
      tagName = 'pre';
      mt = 16; mb = 16; // Match dictatorConfig defaults
    } else if (node.type.name === 'heading') {
      const level = node.attrs.level || 1;
      tagName = `h${level}`;
      // Map levels to dictator margins
      const margins = [
        { mt: 48, mb: 16 }, // H1
        { mt: 36, mb: 12 }, // H2
        { mt: 30, mb: 10 }, // H3
        { mt: 24, mb: 8 },  // H4
        { mt: 20, mb: 6 },  // H5
        { mt: 20, mb: 6 },  // H6
      ];
      const m = margins[Math.min(level - 1, 5)];
      if (m) { mt = m.mt; mb = m.mb; }
    }
    
    this.contentDOM = document.createElement(tagName);
    this.dom.appendChild(this.contentDOM);

    // 3. Identify the nodeId (top-level index correlation)
    const pos = getPos();
    const nodeIndex = typeof pos === 'number' ? view.state.doc.content.cut(0, pos).childCount : 0;
    const globalIndex = getWindowStartBlock() + nodeIndex;
    this.nodeId = String(globalIndex);

    // Margin collapse: first block in document loses top margin to match Dictator logic
    if (globalIndex === 0) {
      mt = 0;
    }

    this.dom.style.boxSizing = 'border-box';
    this.dom.style.paddingTop = `${mt}px`;
    this.dom.style.paddingBottom = `${mb}px`;

    // 4. Apply initial height from Dictator
    const initialHeight = getHeight(this.nodeId);
    
    console.log(`[TELEMETRY] [NodeView] MOUNT | index=${globalIndex} type=${node.type.name} height=${initialHeight}px`);

    if (initialHeight) {
      // The Dictator dictates exact geometry. We use min-height to allow
      // the ResizeObserver to detect if we need growth, but we keep the
      // container strictly managed.
      this.dom.style.minHeight = `${initialHeight}px`;
      this.dom.style.display = 'block';
    }

    // 5. Setup ResizeObserver for self-correction
    // We observe the contentDOM (the semantic tag) instead of the wrapper div.
    // This prevents the "min-height trap" where the wrapper cannot shrink 
    // below its initial estimate, preventing the ResizeObserver from 
    // ever detecting an over-estimation (e.g. if the line-height changed).
    this.ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      
      let contentHeight = 0;
      if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
        contentHeight = entry.borderBoxSize[0].blockSize;
      } else {
        contentHeight = entry.target.getBoundingClientRect().height;
      }

      // Total height is the content (including its padding/border) + the layout margins
      const actualTotalHeight = contentHeight + mt + mb;
      const dictatorHeight = getHeight(this.nodeId) ?? 0;

      if (Math.abs(actualTotalHeight - dictatorHeight) > 2) {
        console.log(`[TELEMETRY] [NodeView] CORRECTION | noteId=${this.noteId} nodeId=${this.nodeId} type=${node.type.name} dictator=${dictatorHeight.toFixed(1)} actual=${actualTotalHeight.toFixed(1)}`);
        
        // Update the wrapper's min-height to allow the new height to take effect
        this.dom.style.minHeight = `${actualTotalHeight}px`;
        
        applyDomCorrection(this.noteId, this.nodeId, actualTotalHeight);
      }
    });

    this.ro.observe(this.contentDOM);
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
