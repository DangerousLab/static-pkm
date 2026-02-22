/**
 * ReadView
 * Read-only rendered markdown view. Wraps the existing MarkdownRenderer.
 *
 * @module ReadView
 */

import { MarkdownRenderer } from '@components/markdown/MarkdownRenderer';

interface ReadViewProps {
  content: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

export const ReadView: React.FC<ReadViewProps> = ({ content, scrollRef }) => {
  return (
    <div className="editor-read-view" ref={scrollRef}>
      <MarkdownRenderer content={content} />
    </div>
  );
};
